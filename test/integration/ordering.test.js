import { OwlMongoConnect, OwlMongoClose } from "owl-expressjs-utils";
import {
  CartModel,
  ProductModel,
  OrderModel,
  StockMovementModel,
  registeredModels,
} from "../../models/models.js";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import session from "express-session";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createApp } from "../../app.js";
import { seed } from "../fixtures/seed.js";

import { seedPreviewData, previewProducts } from "../fixtures/preview-data.js";
import { seedFelosBrand } from "../fixtures/brand.js";

let replica, app, admin, kitchen, waiter, snack, beer, table, guest, billId;
const password = "Test-password-2026!";
before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await OwlMongoConnect(replica.getUri("ordering-tests"));
  await seed({ email: "admin@test.local", password, demo: true });
  await Promise.all(registeredModels.map((m) => m.initialize()));
  app = createApp({
    origin: "http://localhost:4200",
    sessionMiddleware: session({
      secret: "ordering-tests-secret-longer-than-32-characters",
      resave: false,
      saveUninitialized: false,
    }),
  });
  admin = request.agent(app);
  await admin
    .post("/api/auth/login")
    .send({ email: "admin@test.local", password })
    .expect(200);
  for (const role of ["kitchen", "waiter"]) {
    const account = await admin
      .post("/api/admin/accounts")
      .send({ email: `${role}@test.local`, name: role, role, password })
      .expect(201);
    assert.equal(account.body.password, undefined);
    const agent = request.agent(app);
    const login = await agent
      .post("/api/auth/login")
      .send({ email: `${role}@test.local`, password })
      .expect(200);
    assert.equal(login.body.role, role);
    if (role === "kitchen") kitchen = agent;
    else waiter = agent;
  }
  const created = await admin
    .post("/api/admin/products")
    .send({
      name: "Papas tostadas",
      category: "snack",
      inventory: "none",
      price: 1500,
      description: "Botana",
      image: "",
    })
    .expect(201);
  snack = created.body;
  beer = await ProductModel.getOne({ name: "Cerveza artesanal" });
  const location = await admin
    .post("/api/admin/tables")
    .send({ name: "Barra 02" })
    .expect(201);
  table = location.body;
});
after(async () => {
  await OwlMongoClose();
  if (replica) await replica.stop();
});

test("snacks y botanas se publican y rechazan inventario de bebida", async () => {
  const { body } = await request(app).get("/api/public").expect(200);
  assert.equal(
    body.products.find((p) => p._id === snack._id).category,
    "snack",
  );
  await admin
    .post("/api/admin/products")
    .send({ ...snack, inventory: "unit" })
    .expect(400);
});

test("roles se validan en el servidor y no exponen usuarios ni inventario", async () => {
  for (const staff of [kitchen, waiter]) {
    for (const path of ["settings", "accounts", "tables", "products", "sales"])
      await staff.post(`/api/admin/${path}`).send({}).expect(403);
    await staff.get("/api/admin/reports").expect(403);
    const state = await staff.get("/api/admin/state").expect(200);
    assert.deepEqual(state.body.products, []);
    assert.deepEqual(state.body.sales, []);
  }
  await request(app).get("/api/admin/service").expect(401);
  const accounts = await admin.get("/api/admin/accounts").expect(200);
  assert.ok(accounts.body.every((account) => !account.password));
});

test("QR identifica posición y escaneos simultáneos comparten una sola cuenta", async () => {
  const qr = await admin.get("/api/admin/tables").expect(200);
  assert.equal(qr.body[0].url, `http://localhost:4200/?mesa=${table.token}`);
  assert.ok(qr.body[0].qr.startsWith("data:image/png;base64,"));
  await request(app)
    .post("/api/public/tables/desconocido/join")
    .send({})
    .expect(404);
  const joined = await Promise.all(
    [1, 2, 3].map(() =>
      request(app)
        .post(`/api/public/tables/${table.token}/join`)
        .send({})
        .expect(200),
    ),
  );
  guest = joined[0].body;
  assert.ok(joined.every((r) => r.body.token === guest.token));
  assert.equal(guest.label, "Barra 02");
  assert.equal(guest.balance, 0);
  assert.equal(
    await CartModel.countDocuments({ tableId: table._id, status: "open" }),
    1,
  );
  billId = (await CartModel.getOne({ token: guest.token })).id;
  await request(app).get(`/api/public/bills/${table._id}`).expect(404);
});

test("pedido anónimo mixto usa precios del servidor y reintentos reservan inventario una vez", async () => {
  const stock = beer.stock;
  const payload = {
    requestId: "guest-order",
    notes: "Para compartir",
    total: 1,
    items: [
      { productId: snack._id, quantity: 2, unitPrice: 0 },
      { productId: beer.id, quantity: 1 },
    ],
  };
  const results = await Promise.all(
    [1, 2].map(() =>
      request(app)
        .post(`/api/public/bills/${guest.token}/orders`)
        .send(payload)
        .expect(201),
    ),
  );
  assert.equal(results[0].body._id, results[1].body._id);
  assert.equal(results[0].body.total, 5800);
  assert.equal(results[0].body.orderStatus, "pending");
  assert.equal(results[0].body.requestId, undefined);
  assert.equal(results[0].body.items[0].consumed, undefined);
  assert.equal((await ProductModel.getById(beer.id)).stock, stock - 1);
  const account = await request(app)
    .get(`/api/public/bills/${guest.token}`)
    .expect(200);
  assert.equal(account.body.balance, 5800);
  assert.equal(account.body.orders.length, 1);
  const report = await admin.get("/api/admin/reports").expect(200);
  assert.equal(report.body.revenue, 0);
});

test("pedido sin stock revierte cuenta, líneas y movimientos", async () => {
  const movements = await StockMovementModel.countDocuments();
  await request(app)
    .post(`/api/public/bills/${guest.token}/orders`)
    .send({
      requestId: "rollback-guest",
      items: [
        { productId: snack._id, quantity: 1 },
        { productId: beer.id, quantity: 1000 },
      ],
    })
    .expect(409);
  assert.equal((await CartModel.getById(billId)).total, 5800);
  assert.equal(await StockMovementModel.countDocuments(), movements);
  assert.equal(await OrderModel.countDocuments({ billId }), 1);
});

test("cocina prepara, mesero entrega y no se puede cobrar antes de entregar", async () => {
  const order = await OrderModel.getOne({ billId });
  await waiter
    .post(`/api/admin/bills/${billId}/pay`)
    .send({ method: "sinpe" })
    .expect(409);
  await kitchen
    .post(`/api/admin/bills/${billId}/pay`)
    .send({ method: "cash" })
    .expect(403);
  await waiter
    .patch(`/api/admin/orders/${order.id}`)
    .send({ status: "preparing" })
    .expect(403);
  await kitchen
    .patch(`/api/admin/orders/${order.id}`)
    .send({ status: "ready" })
    .expect(409);
  await kitchen
    .patch(`/api/admin/orders/${order.id}`)
    .send({ status: "preparing" })
    .expect(200);
  await kitchen
    .patch(`/api/admin/orders/${order.id}`)
    .send({ status: "delivered" })
    .expect(403);
  await kitchen
    .patch(`/api/admin/orders/${order.id}`)
    .send({ status: "ready" })
    .expect(200);
  await waiter
    .patch(`/api/admin/orders/${order.id}`)
    .send({ status: "delivered" })
    .expect(200);
  const saved = await OrderModel.getById(order.id);
  assert.ok(saved.deliveredAt);
  assert.ok(saved.deliveredBy);
});

test("cobros simultáneos son idempotentes, registran SIMPE y reportan snacks", async () => {
  await waiter
    .post(`/api/admin/bills/${billId}/pay`)
    .send({ method: "crypto" })
    .expect(400);
  const results = await Promise.all(
    [1, 2].map(() =>
      waiter
        .post(`/api/admin/bills/${billId}/pay`)
        .send({ method: "sinpe", reference: "REF-123" })
        .expect(200),
    ),
  );
  assert.equal(results[0].body._id, results[1].body._id);
  const saved = await CartModel.getById(billId);
  assert.equal(saved.paymentMethod, "sinpe");
  assert.equal(saved.paymentReference, "REF-123");
  assert.ok(saved.receivedBy);
  assert.ok(saved.paidAt);
  const account = await request(app)
    .get(`/api/public/bills/${guest.token}`)
    .expect(200);
  assert.equal(account.body.balance, 0);
  assert.equal(account.body.total, 5800);
  assert.equal(account.body.paymentMethod, "sinpe");
  const report = await admin.get("/api/admin/reports").expect(200);
  assert.equal(report.body.revenue, 5800);
  assert.equal(
    report.body.ranking.find((row) => row._id.category === "snack").quantity,
    2,
  );
  const sale = await OrderModel.getOne({ billId });
  await admin
    .post(`/api/admin/sales/${sale.id}/void`)
    .send({ reason: "No alterar cuentas pagadas" })
    .expect(409);
  await waiter
    .post(`/api/admin/bills/${billId}/pay`)
    .send({ method: "card" })
    .expect(409);
});

test("visita pagada conserva historial privado y el QR abre una cuenta nueva", async () => {
  await request(app)
    .post(`/api/public/bills/${guest.token}/orders`)
    .send({
      requestId: "after-paid",
      items: [{ productId: snack._id, quantity: 1 }],
    })
    .expect(409);
  const next = await request(app)
    .post(`/api/public/tables/${table.token}/join`)
    .send({})
    .expect(200);
  assert.notEqual(next.body.token, guest.token);
  assert.equal(next.body.total, 0);
  assert.deepEqual(next.body.orders, []);
  await admin
    .patch(`/api/admin/tables/${table._id}`)
    .send({ active: false })
    .expect(200);
  await request(app)
    .post(`/api/public/tables/${table.token}/join`)
    .send({})
    .expect(404);
  await request(app)
    .post(`/api/public/bills/${next.body.token}/orders`)
    .send({
      requestId: "paused",
      items: [{ productId: snack._id, quantity: 1 }],
    })
    .expect(409);
  await admin
    .patch(`/api/admin/tables/${table._id}`)
    .send({ active: true })
    .expect(200);
});

test("efectivo y tarjeta quedan registrados para ventas de mostrador", async () => {
  for (const method of ["cash", "card"]) {
    const sale = await admin
      .post("/api/admin/sales")
      .send({
        requestId: `pos-${method}`,
        paymentMethod: method,
        items: [{ productId: snack._id, quantity: 1 }],
      })
      .expect(201);
    assert.equal(sale.body.paymentMethod, method);
    assert.ok(sale.body.paidAt);
  }
});

test("pedido y pago concurrentes no cierran una cuenta con consumos sin entregar", async () => {
  const location = await admin
    .post("/api/admin/tables")
    .send({ name: "Mesa concurrente" })
    .expect(201);
  const joined = await request(app)
    .post(`/api/public/tables/${location.body.token}/join`)
    .send({})
    .expect(200);
  const account = await CartModel.getOne({ token: joined.body.token });
  const created = await request(app)
    .post(`/api/public/bills/${account.token}/orders`)
    .send({
      requestId: "first",
      items: [{ productId: snack._id, quantity: 1 }],
    })
    .expect(201);
  for (const status of ["preparing", "ready", "delivered"])
    await admin
      .patch(`/api/admin/orders/${created.body._id}`)
      .send({ status })
      .expect(200);
  const [newOrder, payment] = await Promise.all([
    request(app)
      .post(`/api/public/bills/${account.token}/orders`)
      .send({
        requestId: "racing",
        items: [{ productId: snack._id, quantity: 1 }],
      }),
    waiter.post(`/api/admin/bills/${account.id}/pay`).send({ method: "card" }),
  ]);
  assert.ok(
    (newOrder.status === 201 && payment.status === 409) ||
      (newOrder.status === 409 && payment.status === 200),
  );
  const saved = await CartModel.getById(account.id);
  assert.equal(saved.total, newOrder.status === 201 ? 3000 : 1500);
  assert.equal(saved.status, payment.status === 200 ? "paid" : "open");
  const orders = await OrderModel.getByCoincidence({ billId: account.id });
  if (saved.status === "paid")
    assert.ok(
      orders.every(
        (order) => order.orderStatus === "delivered" && order.status === "paid",
      ),
    );
});

test("actividad HTTP no abre suscripciones y distingue cuentas pagadas", async () => {
  const result = await request(app)
    .get(`/api/public/bills/${guest.token}/activity`)
    .expect(200);
  assert.deepEqual(result.body, { hasOrders: false, closed: true });
  await request(app).get("/api/admin/order-activity").expect(401);
  const staff = await admin.get("/api/admin/order-activity").expect(200);
  assert.equal(typeof staff.body.hasOrders, "boolean");
  await request(app).get(`/api/public/bills/${guest.token}/events`).expect(404);
});

test("usuario y contraseña permiten entrar sin correo y los datos de prueba son persistentes e idempotentes", async () => {
  const seeded = await seedPreviewData({ resetAdminPassword: true });
  assert.equal(seeded.products, 11);
  const viewer = request.agent(app);
  await viewer
    .post("/api/auth/login")
    .send({ username: "ADMIN", password: "12345678" })
    .expect(200);
  await request(app)
    .post("/api/auth/login")
    .send({ username: "admin", password: "incorrecta" })
    .expect(401);
  const accountList = await viewer.get("/api/admin/accounts").expect(200);
  assert.ok(accountList.body.some((account) => account.username === "admin"));
  assert.ok(accountList.body.every((account) => !account.password));
  const menu = await request(app).get("/api/public").expect(200);
  for (const product of previewProducts)
    assert.ok(
      menu.body.products.some(
        (item) =>
          item.name === product.name && item.category === product.category,
      ),
    );
  const imperial = await ProductModel.getOne({ name: "Imperial" });
  await viewer
    .post("/api/admin/sales")
    .send({
      requestId: "preview-imperial",
      paymentMethod: "cash",
      items: [{ productId: imperial.id, quantity: 1 }],
    })
    .expect(201);
  const count = await ProductModel.countDocuments();
  const movementCount = await StockMovementModel.countDocuments();
  await seedPreviewData();
  assert.equal(await ProductModel.countDocuments(), count);
  assert.equal(await StockMovementModel.countDocuments(), movementCount);
  assert.equal((await ProductModel.getById(imperial.id)).stock, 23);
  const staff = await viewer
    .post("/api/admin/accounts")
    .send({
      username: "mesero2",
      name: "Mesero",
      role: "waiter",
      password: "87654321",
    })
    .expect(201);
  assert.equal(staff.body.username, "mesero2");
  assert.equal(staff.body.password, undefined);
  await request(app)
    .post("/api/auth/login")
    .send({ username: "mesero2", password: "87654321" })
    .expect(200);
  await viewer
    .post("/api/admin/accounts")
    .send({ username: "ADMIN", role: "waiter", password: "12345678" })
    .expect(409);
  await viewer
    .post("/api/admin/accounts")
    .send({ username: "short", role: "waiter", password: "1234567" })
    .expect(400);
});

test("eventos publicados aparecen en la agenda; vencidos y pausados se ocultan y solo admin puede editarlos", async () => {
  const payload = {
    title: "Música en vivo",
    kind: "music",
    description: "Presentación en el bar",
    image: "",
    starts: "2099-11-10T00:00:00Z",
    ends: "2099-11-10T04:00:00Z",
    location: "Felos Bar",
    admission: "Consultar",
    active: true,
    isSample: false,
  };
  for (const staff of [kitchen, waiter])
    await staff.post("/api/admin/events").send(payload).expect(403);
  const created = await admin
    .post("/api/admin/events")
    .send(payload)
    .expect(201);
  const expired = await admin
    .post("/api/admin/events")
    .send({
      ...payload,
      title: "Vencido",
      starts: "2000-01-01",
      ends: "2000-01-02",
    })
    .expect(201);
  const sample = await admin
    .post("/api/admin/events")
    .send({
      ...payload,
      title: "Ejemplo sin fecha",
      starts: null,
      ends: null,
      isSample: true,
    })
    .expect(201);
  let menu = await request(app).get("/api/public").expect(200);
  assert.ok(menu.body.events.some((event) => event._id === created.body._id));
  assert.ok(!menu.body.events.some((event) => event._id === expired.body._id));
  assert.equal(
    menu.body.events.find((event) => event._id === sample.body._id).isSample,
    true,
  );
  await kitchen
    .put(`/api/admin/events/${created.body._id}`)
    .send(payload)
    .expect(403);
  await admin
    .put(`/api/admin/events/${created.body._id}`)
    .send({ ...payload, active: false })
    .expect(200);
  menu = await request(app).get("/api/public").expect(200);
  assert.ok(!menu.body.events.some((event) => event._id === created.body._id));
  for (const change of [
    { starts: "bad" },
    { ends: null },
    { starts: "2100-01-01" },
    { kind: "unknown" },
    { image: "javascript:alert(1)" },
  ])
    await admin
      .post("/api/admin/events")
      .send({ ...payload, ...change })
      .expect(400);
  await admin
    .put("/api/admin/events/000000000000000000000001")
    .send(payload)
    .expect(404);
});

test("branding de Felos y eventos de muestra conservan precios e inventario al volver a cargarlos", async () => {
  const imperial = await ProductModel.getOne({ name: "Imperial" });
  await seedFelosBrand();
  const first = await request(app).get("/api/public").expect(200);
  await seedFelosBrand();
  const second = await request(app).get("/api/public").expect(200);
  assert.equal(second.body.settings.name, "FELOS BAR");
  assert.equal(
    second.body.settings.logoImage,
    "/images/felos-brand-banner.png",
  );
  assert.equal(second.body.settings.phone, "6028-3584 / 6469-6160");
  assert.equal(first.body.events.length, second.body.events.length);
  assert.ok(
    second.body.events
      .filter((event) => event.sampleKey?.startsWith("preview-"))
      .every((event) => event.starts === null && event.isSample),
  );
  const saved = await ProductModel.getById(imperial.id);
  assert.equal(saved.stock, imperial.stock);
  assert.equal(saved.price, imperial.price);
});
