import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import QRCode from "qrcode";
import { OwlRateLimit } from "owl-expressjs-utils";
import { Accounts, Bill, Table, Sale } from "./models.js";
import { Problem, text, usernameInput } from "./domain.js";
import { reserveItems, recordMovements, paymentMethod } from "./service.js";
import { billActivity, hasStaffOrders } from "./order-activity.js";
import { assertProductionPassword } from "./config.js";

const token = () => randomBytes(24).toString("hex");
const allow =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.account.role ?? "admin")
      ? next()
      : res.status(403).json({ error: "Tu rol no permite esta operación." });
const publicOrder = (order) => ({
  _id: order._id,
  items: order.items.map((i) => ({
    name: i.name,
    category: i.category,
    serving: i.serving,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    amount: i.amount,
  })),
  total: order.total,
  status: order.status,
  orderStatus: order.orderStatus,
  notes: order.notes,
  createdAt: order.createdAt,
});

async function billView(bill) {
  // Keep totals and lines from the same snapshot while another device orders/pays.
  return mongoose.connection.transaction(
    async (session) => {
      const current = await Bill.findById(bill._id).session(session);
      const orders = await Sale.find({ billId: bill.id })
        .sort({ createdAt: 1 })
        .session(session)
        .lean();
      return {
        token: current.token,
        label: current.label,
        status: current.status,
        total: current.total,
        balance: current.status === "paid" ? 0 : current.total,
        paymentMethod: current.paymentMethod,
        paidAt: current.paidAt,
        orders: orders.map(publicOrder),
      };
    },
    { readConcern: { level: "snapshot" } },
  );
}
async function findBill(value) {
  const bill = await Bill.findOne({ token: value });
  if (!bill)
    throw new Problem("Cuenta no encontrada. Escaneá el QR de tu mesa.", 404);
  return bill;
}

export function publicOrdering(app) {
  const limiter = OwlRateLimit({ windowMs: 60000, limit: 30 });
  app.post("/api/public/tables/:token/join", limiter, async (req, res) => {
    const table = await Table.findOne({
      token: req.params.token,
      active: true,
    });
    if (!table)
      throw new Problem("Este QR no está disponible. Consultá al mesero.", 404);
    let bill = await Bill.findOne({ tableId: table.id, status: "open" });
    if (!bill) {
      try {
        bill = await Bill.create({
          tableId: table.id,
          label: table.name,
          token: token(),
        });
      } catch (err) {
        if (err.code !== 11000) throw err;
        bill = await Bill.findOne({ tableId: table.id, status: "open" });
        if (!bill) throw err;
      }
    }
    res.json(await billView(bill));
  });
  app.get("/api/public/bills/:token", async (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(await billView(await findBill(req.params.token)));
  });
  app.get("/api/public/bills/:token/activity", async (req, res) => {
    const { bill, hasOrders } = await billActivity(req.params.token);
    res.json({ hasOrders, closed: bill.status !== "open" });
  });
  app.post("/api/public/bills/:token/orders", limiter, async (req, res) => {
    const bill = await findBill(req.params.token);
    const requestId = `guest:${bill.id}:${text(req.body.requestId, "Identificador", 100, true)}`;
    const notes = text(req.body.notes ?? "", "Notas", 500);
    let order;
    try {
      await mongoose.connection.transaction(async (session) => {
        order = await Sale.findOne({ requestId }).session(session);
        if (order) return;
        const open = await Bill.findOneAndUpdate(
          { _id: bill._id, status: "open" },
          { $inc: { revision: 1 } },
          { new: true, session },
        );
        if (!open)
          throw new Problem(
            "Esta cuenta ya fue pagada. Iniciá una nueva visita desde el QR.",
            409,
          );
        const table = await Table.findOne({
          _id: bill.tableId,
          active: true,
        }).session(session);
        if (!table) throw new Problem("Esta mesa ya no admite pedidos.", 409);
        const { lines, movements, total } = await reserveItems(
          req.body.items,
          session,
        );
        [order] = await Sale.create(
          [
            {
              requestId,
              label: bill.label,
              billId: bill.id,
              status: "open",
              orderStatus: "pending",
              notes,
              items: lines,
              total,
            },
          ],
          { session },
        );
        await Bill.updateOne(
          { _id: bill._id },
          { $set: { total: Math.round((open.total + total) * 100) / 100 } },
          { session },
        );
        await recordMovements(movements, order, session);
      });
    } catch (err) {
      if (err.code !== 11000) throw err;
      order = await Sale.findOne({ requestId });
      if (!order) throw err;
    }
    res.status(201).json(publicOrder(order));
  });
}

export function staffOrdering(app, origin) {
  app.get("/api/admin/order-activity", async (req, res) =>
    res.json({ hasOrders: await hasStaffOrders(req.account.role ?? "admin") }),
  );
  app.get("/api/admin/service", async (req, res) => {
    const bills = await Bill.find({ status: "open" })
      .select("-token -__v")
      .sort({ createdAt: 1 })
      .lean();
    const kitchen = req.account.role === "kitchen";
    const orders = await Sale.find({
      billId: { $in: bills.map((b) => String(b._id)) },
      ...(kitchen ? { orderStatus: { $ne: "delivered" } } : {}),
    })
      .sort({ createdAt: 1 })
      .lean();
    res.json({
      bills: kitchen
        ? bills.filter((b) =>
            orders.some((order) => order.billId === String(b._id)),
          )
        : bills,
      orders,
    });
  });
  app.patch("/api/admin/orders/:id", async (req, res) => {
    const next = req.body.status;
    const role = req.account.role ?? "admin";
    if (
      !(
        ["admin", "kitchen"].includes(role) &&
        ["preparing", "ready"].includes(next)
      ) &&
      !(["admin", "waiter"].includes(role) && next === "delivered")
    )
      throw new Problem("Tu rol no permite esta transición.", 403);
    const previous = {
      preparing: "pending",
      ready: "preparing",
      delivered: "ready",
    }[next];
    await mongoose.connection.transaction(async (session) => {
      const order = await Sale.findOneAndUpdate(
        { _id: req.params.id, status: "open", orderStatus: previous },
        {
          $set: {
            orderStatus: next,
            ...(next === "delivered"
              ? {
                  deliveredBy: String(req.account._id),
                  deliveredAt: new Date(),
                }
              : {}),
          },
        },
        { new: true, session },
      );
      if (!order)
        throw new Problem("El pedido cambió. Actualizá el panel.", 409);
      const bill = await Bill.findOneAndUpdate(
        { _id: order.billId, status: "open" },
        { $inc: { revision: 1 } },
        { session },
      );
      if (!bill) throw new Problem("La cuenta ya está cerrada.", 409);
    });
    res.json({ ok: true });
  });
  app.post(
    "/api/admin/bills/:id/pay",
    allow("admin", "waiter"),
    async (req, res) => {
      const method = paymentMethod(req.body.method);
      const reference = text(req.body.reference ?? "", "Referencia", 150);
      let bill;
      await mongoose.connection.transaction(async (session) => {
        bill = await Bill.findById(req.params.id).session(session);
        if (!bill) throw new Problem("Cuenta no encontrada.", 404);
        if (bill.status === "paid") {
          if (
            bill.paymentMethod !== method ||
            bill.paymentReference !== reference
          )
            throw new Problem(
              "Esta cuenta ya fue pagada con otros datos.",
              409,
            );
          return;
        }
        const orders = await Sale.find({ billId: bill.id }).session(session);
        if (!orders.length || orders.some((o) => o.orderStatus !== "delivered"))
          throw new Problem(
            "Primero entregá todos los pedidos de esta cuenta.",
            409,
          );
        bill.status = "paid";
        bill.paymentMethod = method;
        bill.paymentReference = reference;
        bill.receivedBy = String(req.account._id);
        bill.paidAt = new Date();
        bill.revision++;
        await bill.save({ session });
        await Sale.updateMany(
          { billId: bill.id, status: "open" },
          {
            $set: {
              status: "paid",
              paymentMethod: method,
              paidAt: bill.paidAt,
            },
          },
          { session },
        );
      });
      res.json({
        _id: bill._id,
        status: bill.status,
        total: bill.total,
        paymentMethod: bill.paymentMethod,
      });
    },
  );
  // Every route registered after this boundary is administrator-only.
  app.use("/api/admin", allow("admin"));
  app.get("/api/admin/tables", async (req, res) => {
    const tables = await Table.find().sort({ createdAt: 1 }).lean();
    res.json(
      await Promise.all(
        tables.map(async (table) => {
          const url = `${origin}/?mesa=${table.token}`;
          return {
            ...table,
            url,
            qr: await QRCode.toDataURL(url, { width: 360, margin: 2 }),
          };
        }),
      ),
    );
  });
  app.post("/api/admin/tables", async (req, res) =>
    res.status(201).json(
      await Table.create({
        name: text(req.body.name, "Mesa o posición", 100, true),
        token: token(),
      }),
    ),
  );
  app.patch("/api/admin/tables/:id", async (req, res) => {
    if (typeof req.body.active !== "boolean")
      throw new Problem("Estado inválido.");
    const table = await Table.findByIdAndUpdate(
      req.params.id,
      { active: req.body.active },
      { new: true },
    );
    if (!table) throw new Problem("Mesa no encontrada.", 404);
    res.json(table);
  });
  app.get("/api/admin/accounts", async (req, res) =>
    res.json(
      await mongoose
        .model("RestaurantAccount")
        .find()
        .select("username email name role")
        .lean(),
    ),
  );
  app.post("/api/admin/accounts", async (req, res) => {
    const role = req.body.role;
    if (!["admin", "kitchen", "waiter"].includes(role))
      throw new Problem("Rol inválido.");
    const username = usernameInput(
      req.body.username ?? req.body.email?.split("@")[0],
    );
    // Keep the legacy required email column internal for username-only accounts.
    // No mail is sent or required for authentication.
    const email = text(
      req.body.email ?? `${username}@accounts.local`,
      "Correo",
      254,
      true,
    ).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Problem("Correo inválido.");
    const password = text(req.body.password, "Contraseña", 200, true);
    if (app.locals.production) assertProductionPassword(password);
    if (password.length < 8)
      throw new Problem("La contraseña requiere al menos 8 caracteres.");
    if (await Accounts.getOne({ $or: [{ username }, { email }] }))
      throw new Problem("Ese usuario ya está registrado.", 409);
    const account = await Accounts.save({
      email,
      username,
      password,
      role,
      name: text(req.body.name ?? "", "Nombre", 100),
    });
    res
      .status(201)
      .json({ _id: account._id, username, role, name: account.name });
  });
}
