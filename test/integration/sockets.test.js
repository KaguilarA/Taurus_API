import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import mongoose from "mongoose";
import session from "express-session";
import request from "supertest";
import { io } from "socket.io-client";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createApp } from "../../app.js";
import { seed } from "../fixtures/seed.js";
import { Accounts, Product, Bill } from "../../models/models.js";
import {
  attachOrderSockets,
  ORDER_SOCKET_PATH,
} from "../../services/sockets.js";
import { rotatePassword } from "../../services/production-accounts.js";

let replica,
  app,
  admin,
  servers,
  layers,
  origins,
  cookie,
  kitchenCookie,
  waiterCookie;
let first,
  second,
  firstOrder,
  secondOrder,
  food,
  guestClient,
  adminClient,
  kitchenClient,
  waiterClient;
const clients = new Set();
const origin = "http://localhost:4200";
const password = "12345678";
const deadline = () => AbortSignal.timeout(10000);
function event(socket, name, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(name, listener);
      reject(new Error(`No se recibió ${name}.`));
    }, 10000);
    const listener = (value) => {
      if (!predicate(value)) return;
      clearTimeout(timer);
      socket.off(name, listener);
      resolve(value);
    };
    socket.on(name, listener);
  });
}
function client(auth, options = {}) {
  const socket = io(origins[options.server ?? 0], {
    path: ORDER_SOCKET_PATH,
    transports: ["websocket"],
    autoConnect: false,
    reconnection: false,
    auth,
    extraHeaders: {
      Origin: options.origin ?? origin,
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
  });
  clients.add(socket);
  return socket;
}
async function subscribe(auth, options) {
  const socket = client(auth, options);
  const ready = event(socket, "orders:changed");
  socket.connect();
  await ready;
  return socket;
}
async function denied(auth, options = {}) {
  const socket = client(auth, options);
  const failure = event(socket, "connect_error");
  socket.connect();
  const error = await failure;
  socket.disconnect();
  return error;
}
async function delivered(id) {
  for (const status of ["preparing", "ready", "delivered"])
    await admin.patch(`/api/admin/orders/${id}`).send({ status }).expect(200);
}

before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replica.getUri("socket-tests"));
  await seed({
    email: "admin@socket.local",
    username: "admin",
    password,
    demo: true,
  });
  await Accounts.save({
    email: "kitchen@socket.local",
    username: "kitchen",
    role: "kitchen",
    password,
  });
  await Accounts.save({
    email: "waiter@socket.local",
    username: "waiter",
    role: "waiter",
    password,
  });
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.init()),
  );
  const sessions = session({
    secret: "socket-tests-secret-with-more-than-32-chars",
    resave: false,
    saveUninitialized: false,
  });
  app = createApp({ sessionMiddleware: sessions, origin });
  const otherApp = createApp({ sessionMiddleware: sessions, origin });
  servers = [createServer(app), createServer(otherApp)];
  layers = servers.map((server) =>
    attachOrderSockets(server, {
      sessionMiddleware: sessions,
      origin,
      authCheckMs: 100,
    }),
  );
  await Promise.all(
    servers.map(async (server) => {
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
    }),
  );
  origins = servers.map(
    (server) => `http://127.0.0.1:${server.address().port}`,
  );
  admin = request.agent(app);
  const login = await admin
    .post("/api/auth/login")
    .send({ username: "admin", password })
    .expect(200);
  cookie = login.headers["set-cookie"][0].split(";")[0];
  const kitchen = await request(app)
    .post("/api/auth/login")
    .send({ username: "kitchen", password })
    .expect(200);
  kitchenCookie = kitchen.headers["set-cookie"][0].split(";")[0];
  const waiter = await request(app)
    .post("/api/auth/login")
    .send({ username: "waiter", password })
    .expect(200);
  waiterCookie = waiter.headers["set-cookie"][0].split(";")[0];
  food = await Product.findOne({ category: "food" });
  for (const name of ["Mesa socket 1", "Mesa socket 2"]) {
    const table = await admin
      .post("/api/admin/tables")
      .send({ name })
      .expect(201);
    const joined = await request(app)
      .post(`/api/public/tables/${table.body.token}/join`)
      .send({})
      .expect(200);
    if (!first) first = joined.body;
    else second = joined.body;
  }
});
after(async () => {
  for (const socket of clients) socket.disconnect();
  if (layers) await Promise.all(layers.map((layer) => layer.close()));
  await mongoose.disconnect();
  if (replica) await replica.stop();
});

test("sin órdenes no se aceptan sockets, sesiones ausentes ni orígenes ajenos", async () => {
  assert.equal((await denied({ kind: "staff" })).data.code, "UNAUTHORIZED");
  for (const authCookie of [cookie, kitchenCookie, waiterCookie])
    assert.equal(
      (await denied({ kind: "staff" }, { cookie: authCookie })).data.code,
      "NO_ACTIVE_ORDERS",
    );
  assert.equal(
    (await denied({ kind: "bill", token: first.token })).data.code,
    "NO_ACTIVE_ORDERS",
  );
  assert.equal(
    (
      await denied(
        { kind: "staff" },
        { cookie, origin: "https://untrusted.example" },
      )
    ).message,
    "websocket error",
  );
  const activity = await request(app)
    .get(`/api/public/bills/${first.token}/activity`)
    .expect(200);
  assert.deepEqual(activity.body, { hasOrders: false, closed: false });
  assert.equal(layers[0].io.sockets.sockets.size, 0);
});

test("la primera orden habilita cliente, cocina y mesero; los cambios cruzan instancias de API", async () => {
  const created = await request(app)
    .post(`/api/public/bills/${first.token}/orders`)
    .send({
      requestId: "socket-first",
      items: [{ productId: food.id, quantity: 1 }],
    })
    .expect(201);
  firstOrder = created.body;
  for (const authCookie of [cookie, kitchenCookie, waiterCookie]) {
    const activity = await request(app)
      .get("/api/admin/order-activity")
      .set("Cookie", authCookie)
      .expect(200);
    assert.equal(activity.body.hasOrders, true);
  }
  guestClient = await subscribe({ kind: "bill", token: first.token });
  adminClient = await subscribe({ kind: "staff" }, { cookie, server: 1 });
  kitchenClient = await subscribe({ kind: "staff" }, { cookie: kitchenCookie });
  waiterClient = await subscribe({ kind: "staff" }, { cookie: waiterCookie });
  const bill = await Bill.findOne({ token: first.token });
  const own = event(
    guestClient,
    "orders:changed",
    (data) => data.billId === bill.id,
  );
  const crossInstance = event(
    adminClient,
    "orders:changed",
    (data) => data.billId === bill.id,
  );
  await admin
    .patch(`/api/admin/orders/${firstOrder._id}`)
    .send({ status: "preparing" })
    .expect(200);
  await Promise.all([own, crossInstance]);
  const account = await request(app)
    .get(`/api/public/bills/${first.token}`)
    .expect(200);
  assert.equal(account.body.orders[0].orderStatus, "preparing");
});

test("una cuenta nunca se suscribe a los pedidos de otra mesa", async () => {
  const ownBill = await Bill.findOne({ token: first.token });
  const otherBill = await Bill.findOne({ token: second.token });
  const observed = [];
  guestClient.on("orders:changed", (data) => observed.push(data.billId));
  const staff = event(
    waiterClient,
    "orders:changed",
    (data) => data.billId === otherBill.id,
  );
  const created = await request(app)
    .post(`/api/public/bills/${second.token}/orders`)
    .send({
      requestId: "socket-second",
      items: [{ productId: food.id, quantity: 1 }],
    })
    .expect(201);
  secondOrder = created.body;
  await staff;
  const ownServer = layers[0].io.sockets.sockets.get(guestClient.id);
  assert.ok(ownServer.rooms.has(`bill:${ownBill.id}`));
  assert.ok(!ownServer.rooms.has(`bill:${otherBill.id}`));
  assert.ok(observed.every((id) => id === ownBill.id));
  assert.equal(
    (await denied({ kind: "bill", token: otherBill.id })).data.code,
    "UNAUTHORIZED",
  );
});

test("cocina se desconecta al terminar entregas y el cliente al pagar; el mesero espera el último pago", async () => {
  await admin
    .patch(`/api/admin/orders/${firstOrder._id}`)
    .send({ status: "ready" })
    .expect(200);
  await admin
    .patch(`/api/admin/orders/${firstOrder._id}`)
    .send({ status: "delivered" })
    .expect(200);
  const kitchenClosed = event(kitchenClient, "disconnect");
  await delivered(secondOrder._id);
  await kitchenClosed;
  const kitchenActivity = await request(app)
    .get("/api/admin/order-activity")
    .set("Cookie", kitchenCookie)
    .expect(200);
  assert.equal(kitchenActivity.body.hasOrders, false);
  const kitchenState = await request(app)
    .get("/api/admin/service")
    .set("Cookie", kitchenCookie)
    .expect(200);
  assert.deepEqual(kitchenState.body.orders, []);
  assert.ok(waiterClient.connected);
  const guestClosed = event(guestClient, "disconnect");
  await admin
    .post(
      `/api/admin/bills/${(await Bill.findOne({ token: first.token })).id}/pay`,
    )
    .send({ method: "cash" })
    .expect(200);
  await guestClosed;
  assert.equal(
    (await denied({ kind: "bill", token: first.token })).data.code,
    "NO_ACTIVE_ORDERS",
  );
  assert.ok(waiterClient.connected);
  const waiterClosed = event(waiterClient, "disconnect");
  const adminClosed = event(adminClient, "disconnect");
  await admin
    .post(
      `/api/admin/bills/${(await Bill.findOne({ token: second.token })).id}/pay`,
    )
    .send({ method: "card" })
    .expect(200);
  await Promise.all([waiterClosed, adminClosed]);
  assert.equal(layers[0].io.sockets.sockets.size, 0);
  assert.equal(layers[1].io.sockets.sockets.size, 0);
});

test("reconectar recupera cambios perdidos y cerrar sesión revoca el socket del personal", async () => {
  const table = await admin
    .post("/api/admin/tables")
    .send({ name: "Mesa reconexión" })
    .expect(201);
  const guest = await request(app)
    .post(`/api/public/tables/${table.body.token}/join`)
    .send({})
    .expect(200);
  const order = await request(app)
    .post(`/api/public/bills/${guest.body.token}/orders`)
    .send({
      requestId: "reconnect-order",
      items: [{ productId: food.id, quantity: 1 }],
    })
    .expect(201);
  const guestSocket = await subscribe({
    kind: "bill",
    token: guest.body.token,
  });
  guestSocket.disconnect();
  await admin
    .patch(`/api/admin/orders/${order.body._id}`)
    .send({ status: "preparing" })
    .expect(200);
  const refreshed = event(guestSocket, "orders:changed");
  guestSocket.connect();
  await refreshed;
  const bill = await request(app)
    .get(`/api/public/bills/${guest.body.token}`)
    .expect(200);
  assert.equal(bill.body.orders[0].orderStatus, "preparing");
  const staff = await subscribe({ kind: "staff" }, { cookie: waiterCookie });
  const closed = event(staff, "disconnect");
  await request(app)
    .post("/api/auth/logout")
    .set("Cookie", waiterCookie)
    .expect(200);
  await closed;
  assert.equal(
    (await denied({ kind: "staff" }, { cookie: waiterCookie })).data.code,
    "UNAUTHORIZED",
  );
  guestSocket.disconnect();
});

test("rotar una contraseña revoca también los sockets con una sesión anterior", async () => {
  const kitchen = await subscribe({ kind: "staff" }, { cookie: kitchenCookie });
  const closed = event(kitchen, "disconnect");
  await rotatePassword("kitchen", "New-kitchen-password-2026!");
  await closed;
  assert.equal(
    (await denied({ kind: "staff" }, { cookie: kitchenCookie })).data.code,
    "UNAUTHORIZED",
  );
});
