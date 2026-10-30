import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, dirname, basename } from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { io } from "socket.io-client";

const release = resolve(process.argv[2] || "");
const manifest = JSON.parse(
  await readFile(join(release, "release-manifest.json"), "utf8"),
);
const split = manifest.files.some(
  (entry) => entry.file === "backend/package.json",
);
for (const entry of manifest.files) {
  const content = await readFile(join(release, entry.file));
  assert.equal(
    createHash("sha256").update(content).digest("hex"),
    entry.sha256,
  );
}
let directory, replica, child, exited, socket;
try {
  directory = await mkdtemp(join(tmpdir(), "felos-production-smoke-"));
  await cp(release, directory, { recursive: true });
  const runtimeDirectory = split ? join(directory, "backend") : directory;
  execFileSync(
    process.execPath,
    [
      process.env.npm_execpath,
      "ci",
      "--omit=dev",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ],
    { cwd: runtimeDirectory, stdio: "inherit" },
  );
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const origin = "https://production-smoke.example";
  const password = randomBytes(24).toString("hex");
  child = spawn(process.execPath, ["index.js"], {
    cwd: runtimeDirectory,
    env: {
      ...process.env,
      ENV_FILE: "",
      NODE_ENV: "production",
      HOST: "0.0.0.0",
      PORT: String(port),
      TRUST_PROXY: "1",
      FRONTEND_URL: origin,
      FRONTEND_DIST: split ? "" : "./web",
      LOCAL_MONGO_AUTOSTART: "false",
      DB_HOST: replica.getUri("wrong-default"),
      DB_NAME: "smoke",
      SESSION_SECRET: randomBytes(32).toString("hex"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  exited = once(child, "exit");
  let logs = "";
  child.stdout.on("data", (chunk) => {
    logs += chunk;
  });
  child.stderr.on("data", (chunk) => {
    logs += chunk;
  });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      ready = (
        await fetch(base + "/api/ready", { signal: AbortSignal.timeout(1000) })
      ).ok;
    } catch {}
    if (ready) break;
    if (child.exitCode !== null)
      throw new Error(
        "El servidor de producción terminó antes de estar listo.",
      );
    await delay(250);
  }
  assert.ok(ready, "El servidor de producción debe estar listo.");
  for (const route of ["/", "/admin"]) {
    const response = await fetch(base + route);
    assert.equal(response.status, split ? 404 : 200);
    if (!split) assert.match(await response.text(), /<app-root/);
  }
  if (split) {
    assert.match(
      await readFile(join(directory, "frontend/index.html"), "utf8"),
      /<app-root/,
    );
    assert.ok(
      !manifest.files.some((entry) => entry.file.startsWith("backend/web/")),
    );
  }
  const missing = await fetch(base + "/api/missing");
  assert.equal(missing.status, 404);
  assert.match(missing.headers.get("content-type"), /json/);
  assert.equal(
    (await (await fetch(base + "/api/setup/status")).json()).required,
    true,
  );
  const registration = await fetch(base + "/api/setup/admin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      "X-Forwarded-Proto": "https",
    },
    body: JSON.stringify({
      username: "smoke-admin",
      password,
      passwordConfirmation: password,
    }),
  });
  assert.equal(registration.status, 201);
  assert.match(registration.headers.get("set-cookie"), /Secure/);
  assert.equal(
    (await (await fetch(base + "/api/setup/status")).json()).required,
    false,
  );
  const login = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      "X-Forwarded-Proto": "https",
    },
    body: JSON.stringify({ username: "smoke-admin", password }),
  });
  assert.equal(login.status, 200);
  assert.match(login.headers.get("set-cookie"), /Secure/);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  async function send(route, body, method = "POST", staff = true) {
    const response = await fetch(base + route, {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        "X-Forwarded-Proto": "https",
        ...(staff ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    });
    assert.ok(response.ok, `${route}: ${response.status}`);
    return response.json();
  }
  assert.equal((await (await fetch(base + "/api/setup/status")).json()).businessRequired, true);
  const profile = { name: "Smoke business", subtitle: "Test kitchen", currency: "USD", accent: "#445566", servings: { large: 90, small: 60, shot: 30 } };
  await send("/api/admin/settings", profile, "PUT");
  assert.equal((await (await fetch(base + "/api/setup/status")).json()).businessRequired, false);
  assert.equal((await (await fetch(base + "/api/public")).json()).settings.name, profile.name);
  const food = await send("/api/admin/products", {
    name: "Smoke food",
    category: "food",
    inventory: "none",
    price: 100,
  });
  const table = await send("/api/admin/tables", { name: "Smoke table" });
  const bill = await send(
    `/api/public/tables/${table.token}/join`,
    {},
    "POST",
    false,
  );
  const order = await send(
    `/api/public/bills/${bill.token}/orders`,
    {
      requestId: "production-smoke-order",
      items: [{ productId: food._id, quantity: 1 }],
    },
    "POST",
    false,
  );
  socket = io(base, {
    path: "/api/socket.io",
    transports: ["websocket"],
    autoConnect: false,
    reconnection: false,
    auth: { kind: "bill", token: bill.token },
    extraHeaders: { Origin: origin },
  });
  function update() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("No llegó el evento de pedidos.")),
        10000,
      );
      socket.once("orders:changed", (value) => {
        clearTimeout(timer);
        resolve(value);
      });
      socket.once("connect_error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }
  const initial = update();
  socket.connect();
  await initial;
  const changed = update();
  await send(
    `/api/admin/orders/${order._id}`,
    { status: "preparing" },
    "PATCH",
  );
  await changed;
  const account = await (
    await fetch(base + `/api/public/bills/${bill.token}`)
  ).json();
  assert.equal(account.orders[0].orderStatus, "preparing");
  assert.equal(account.balance, 100);
  console.log(
    "Paquete verificado: instalación limpia, Angular, login HTTPS, pedido, cuenta y WebSocket. Solo se usó una base temporal.",
  );
} finally {
  socket?.disconnect();
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    await exited;
  }
  if (replica) await replica.stop();
  if (directory) {
    const target = await realpath(directory);
    assert.equal(dirname(target), await realpath(tmpdir()));
    assert.ok(basename(target).startsWith("felos-production-smoke-"));
    await rm(target, { recursive: true, force: true });
  }
}
