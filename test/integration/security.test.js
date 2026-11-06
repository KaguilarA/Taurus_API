import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../../app.js";
import {
  sessionExpired,
  enforceSessionLifetime,
  SESSION_IDLE_MS,
  SESSION_ABSOLUTE_MS,
} from "../../services/session-policy.js";
import { assertPasswordRepresentation } from "../../config/runtime.js";
import actionLog from "../../middlewares/actionLog/actionLog.js";
import { EventEmitter } from "node:events";

test("límites de sesión distinguen actividad HTTP, expiración absoluta y WebSocket", () => {
  const now = Date.now();
  assert.equal(
    sessionExpired(
      {
        userId: "owner",
        authenticatedAt: now - SESSION_ABSOLUTE_MS,
        lastActivityAt: now,
      },
      now,
    ),
    true,
  );
  assert.equal(
    sessionExpired(
      {
        userId: "owner",
        authenticatedAt: now,
        lastActivityAt: now - SESSION_IDLE_MS,
      },
      now,
    ),
    true,
  );
  assert.equal(
    sessionExpired(
      { userId: "owner", authenticatedAt: now, lastActivityAt: now },
      now,
    ),
    false,
  );
  assert.equal(
    sessionExpired({ userId: "owner", authenticatedAt: NaN }, now),
    true,
  );
  const legacy = { userId: "owner" };
  let calls = 0;
  enforceSessionLifetime({ session: legacy }, {}, () => calls++);
  assert.equal(calls, 1);
  assert.ok(legacy.authenticatedAt <= Date.now());
  assert.equal(sessionExpired(legacy), false);
  const activity = legacy.lastActivityAt;
  sessionExpired(legacy, now + 1000);
  assert.equal(
    legacy.lastActivityAt,
    activity,
    "Verificar sockets no renueva actividad",
  );
});

test("sesión vencida se destruye antes de consultar datos privados", async () => {
  let destroyed = false;
  const app = createApp({
    origin: "https://bar.example",
    sessionMiddleware(req, res, next) {
      req.session = {
        userId: "owner",
        authenticatedAt: Date.now() - SESSION_ABSOLUTE_MS,
        destroy(done) {
          destroyed = true;
          done();
        },
      };
      next();
    },
  });
  await request(app)
    .get("/api/admin/state")
    .expect(401)
    .expect("Cache-Control", "no-store");
  assert.equal(destroyed, true);
});

test("CSRF rechaza Fetch Metadata cross-site incluso sin Origin", async () => {
  const app = createApp({
    origin: "https://bar.example",
    sessionMiddleware(req, res, next) {
      next();
    },
  });
  await request(app)
    .post("/api/auth/login")
    .set("Sec-Fetch-Site", "cross-site")
    .send({})
    .expect(403);
  await request(app)
    .get("/api/health")
    .set("Sec-Fetch-Site", "cross-site")
    .expect(200);
});

test("nuevas contraseñas no aceptan hashes ni truncamiento UTF-8 de bcrypt", () => {
  for (const prefix of ["$2a$", "$2b$", "$2y$"])
    assert.throws(() =>
      assertPasswordRepresentation(prefix + "12$" + "a".repeat(53)),
    );
  assert.throws(() => assertPasswordRepresentation("é".repeat(37)));
  assert.doesNotThrow(() => assertPasswordRepresentation("é".repeat(36)));
});

test("auditoría registra una sola respuesta y omite secretos, tokens y facturas", async () => {
  const records = [];
  const response = new EventEmitter();
  response.statusCode = 200;
  actionLog({
    actionLogModel: {
      async save(value) {
        records.push(value);
      },
    },
  })(
    {
      session: { userId: "owner" },
      permission: { _id: "permission" },
      method: "POST",
      route: { path: "/bills/:token" },
      originalUrl: "/bills/private-token?secret=private",
      body: { password: "private", invoice: "private" },
      params: { token: "private-token" },
      query: { secret: "private" },
    },
    response,
    () => {},
  );
  response.emit("finish");
  response.emit("finish");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(records.length, 1);
  assert.equal(records[0].metadata.route, "/bills/:token");
  assert.doesNotMatch(JSON.stringify(records), /private|password|invoice/);
});
