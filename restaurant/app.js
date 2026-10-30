import express from "express";
import helmet from "helmet";
import { OwlRateLimit } from "owl-expressjs-utils";
import { OwlCors, OwlIsAuth, OwlSession } from "owl-expressjs-utils";
import {
  Accounts,
  Settings,
  Product,
  Promotion,
  Sale,
  Movement,
  Event,
} from "./models.js";
import {
  Problem,
  productInput,
  saleLine,
  text,
  number,
  image,
} from "./domain.js";
import mongoose from "mongoose";
import { publicOrdering, staffOrdering } from "./ordering.js";
import { paymentMethod } from "./service.js";
import { serveFrontend } from "./static-site.js";
import { assertProductionPassword } from "./config.js";
import { registerImageUploads } from "./images.js";
import { registerInitialSetup } from "./setup.js";
import { businessInput } from "./business.js";
import { deploymentInfo } from "./deployment.js";

const asyncSession = (session, action) =>
  new Promise((resolve, reject) =>
    session[action]((err) => (err ? reject(err) : resolve())),
  );
export function createApp({
  sessionMiddleware,
  origin = process.env.FRONTEND_URL,
  secret = process.env.SESSION_SECRET,
  uri = process.env.DB_HOST,
  production = process.env.NODE_ENV === "production",
  trustProxy = production ? 1 : 0,
  frontendDist,
  uploadImage,
} = {}) {
  if (!origin) throw new Error("Configurá el origen público de la aplicación.");
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", trustProxy);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          connectSrc: ["'self'", origin.replace(/^http/, "ws")],
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(OwlCors([origin]));
  // Explicit origin check protects cookie-authenticated mutations, including login.
  app.use((req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("origin") &&
      req.get("origin") !== origin
    )
      return res.status(403).json({ error: "Origen no permitido." });
    next();
  });
  app.use(express.json({ limit: "256kb" }));
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  const sessions =
    sessionMiddleware ??
    OwlSession(
      secret,
      production ? "production" : "development",
      process.env.DB_NAME,
      uri,
    );
  app.locals.sessionMiddleware = sessions;
  app.locals.origin = origin;
  app.locals.production = production;
  app.use(sessions);
  registerInitialSetup(app);
  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.get("/api/deployment", (req, res) => res.json(deploymentInfo()));
  app.get("/api/ready", async (req, res) => {
    try {
      if (app.locals.draining || mongoose.connection.readyState !== 1)
        return res.status(503).json({ ok: false });
      await mongoose.connection.db.command({ ping: 1 }, { maxTimeMS: 2000 });
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });
  app.get("/api/public", async (req, res) => {
    const now = new Date();
    const products = await Product.find({ active: true })
      .select("-stock -minimum -__v")
      .lean();
    res.json({
      settings: await Settings.getOne({ key: "main" }),
      products,
      promotions: await Promotion.find({
        active: true,
        starts: { $lte: now },
        ends: { $gte: now },
      }).lean(),
      events: await Event.find({
        active: true,
        ...(production ? { isSample: { $ne: true } } : {}),
        $or: [{ ends: null }, { ends: { $gte: now } }],
      })
        .sort({ starts: 1, createdAt: -1 })
        .lean(),
    });
  });
  publicOrdering(app);
  app.get("/api/auth/status", async (req, res) => {
    const account = req.session.userId
      ? await Accounts.getOne({ _id: req.session.userId })
      : null;
    const authenticated =
      !!account &&
      (req.session.userVersion ?? 0) === (account.sessionVersion ?? 0);
    res.json({
      authenticated,
      role: authenticated ? (account.role ?? "admin") : null,
    });
  });
  app.post(
    "/api/auth/login",
    OwlRateLimit({ windowMs: 900000, limit: 10 }),
    async (req, res) => {
      // Existing API clients may keep using email while the UI uses usernames.
      const lookup =
        req.body.username !== undefined
          ? {
              username: text(
                req.body.username,
                "Usuario",
                40,
                true,
              ).toLowerCase(),
            }
          : { email: text(req.body.email, "Usuario", 254, true).toLowerCase() };
      const password = text(req.body.password, "Contraseña", 200, true);
      const account = await Accounts.getOne(lookup);
      if (
        !account ||
        !(await Accounts.compareHash(String(account._id), "password", password))
      )
        throw new Problem("Credenciales inválidas.", 401);
      if (production) assertProductionPassword(password);
      await asyncSession(req.session, "regenerate");
      req.session.userId = String(account._id);
      req.session.userVersion = account.sessionVersion ?? 0;
      await asyncSession(req.session, "save");
      res.json({ authenticated: true, role: account.role ?? "admin" });
    },
  );
  app.post("/api/auth/logout", async (req, res) => {
    await asyncSession(req.session, "destroy");
    res.clearCookie("connect.sid");
    res.json({ authenticated: false });
  });
  app.use("/api/admin", OwlIsAuth);
  app.use("/api/admin", async (req, res, next) => {
    req.account = await Accounts.getOne({ _id: req.session.userId });
    if (
      !req.account ||
      (req.session.userVersion ?? 0) !== (req.account.sessionVersion ?? 0)
    )
      throw new Problem("Iniciá sesión de nuevo.", 401);
    next();
  });
  app.get("/api/admin/state", async (req, res) =>
    res.json({
      settings: await Settings.getOne({ key: "main" }),
      products:
        (req.account.role ?? "admin") === "admin"
          ? await Product.find().sort({ name: 1 }).lean()
          : [],
      promotions:
        (req.account.role ?? "admin") === "admin"
          ? await Promotion.find().sort({ createdAt: -1 }).lean()
          : [],
      sales:
        (req.account.role ?? "admin") === "admin"
          ? await Sale.find().sort({ createdAt: -1 }).limit(100).lean()
          : [],
      movements:
        (req.account.role ?? "admin") === "admin"
          ? await Movement.find().sort({ createdAt: -1 }).limit(100).lean()
          : [],
      events:
        (req.account.role ?? "admin") === "admin"
          ? await Event.find().sort({ starts: 1 }).lean()
          : [],
    }),
  );
  staffOrdering(app, origin);
  registerImageUploads(app, { uploadImage });
  app.put("/api/admin/settings", async (req, res) => {
    const data = businessInput(req.body);
    res.json(
      await mongoose
        .model("Business")
        .findOneAndUpdate(
          { key: "main" },
          { $set: data },
          { new: true, upsert: true, runValidators: true },
        ),
    );
  });
  app.post("/api/admin/products", async (req, res) =>
    res.status(201).json(await Product.create(productInput(req.body))),
  );
  app.post("/api/admin/events", async (req, res) =>
    res.status(201).json(await Event.create(eventInput(req.body))),
  );
  app.put("/api/admin/events/:id", async (req, res) => {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      eventInput(req.body),
      { new: true, runValidators: true },
    );
    if (!event) throw new Problem("Evento no encontrado.", 404);
    res.json(event);
  });
  app.put("/api/admin/products/:id", async (req, res) => {
    const data = productInput(req.body);
    const result = await mongoose.connection.transaction(async (session) => {
      const current = await Product.findById(req.params.id).session(session);
      if (!current) throw new Problem("Producto no encontrado.", 404);
      if (current.inventory !== data.inventory)
        throw new Problem(
          "El tipo de inventario no puede cambiar. Archiva el producto y crea otro.",
        );
      Object.assign(current, data);
      await current.save({ session });
      return current;
    });
    res.json(result);
  });
  app.post("/api/admin/products/:id/stock", async (req, res) => {
    const delta = number(req.body.delta, "Movimiento", -1e9, true);
    if (!delta) throw new Problem("El movimiento no puede ser cero.");
    const reason = text(req.body.reason, "Motivo", 250, true);
    let result;
    await mongoose.connection.transaction(async (session) => {
      result = await Product.findOneAndUpdate(
        {
          _id: req.params.id,
          inventory: { $ne: "none" },
          stock: { $gte: Math.max(0, -delta) },
        },
        { $inc: { stock: delta } },
        { new: true, session },
      );
      if (!result)
        throw new Problem("Producto sin inventario o saldo insuficiente.", 409);
      await Movement.create(
        [
          {
            productId: String(result._id),
            productName: result.name,
            delta,
            unit: result.inventory,
            reason,
            balance: result.stock,
          },
        ],
        { session },
      );
    });
    res.json(result);
  });
  app.post("/api/admin/promotions", async (req, res) =>
    res.status(201).json(await Promotion.create(promotionInput(req.body))),
  );
  app.put("/api/admin/promotions/:id", async (req, res) => {
    const promo = await Promotion.findByIdAndUpdate(
      req.params.id,
      promotionInput(req.body),
      { new: true, runValidators: true },
    );
    if (!promo) throw new Problem("Promoción no encontrada.", 404);
    res.json(promo);
  });
  app.post("/api/admin/sales", async (req, res) => {
    const method = paymentMethod(req.body.paymentMethod ?? "cash");
    const requestId = text(req.body.requestId, "Identificador", 100, true);
    const label = text(
      req.body.label ?? "Venta de mostrador",
      "Cuenta",
      150,
      true,
    );
    const items = req.body.items;
    if (!Array.isArray(items) || !items.length || items.length > 100)
      throw new Problem("Agrega entre 1 y 100 líneas.");
    let sale;
    try {
      await mongoose.connection.transaction(async (session) => {
        sale = await Sale.findOne({ requestId }).session(session);
        if (sale) return;
        const settings = await mongoose
          .model("Business")
          .findOne({ key: "main" })
          .session(session);
        if (!settings)
          throw new Problem(
            "Completá la información del negocio antes de registrar pedidos.",
            409,
          );
        const lines = [];
        const movements = [];
        for (const input of items) {
          const product = await Product.findOne({
            _id: input.productId,
            active: true,
          }).session(session);
          if (!product) throw new Problem("Producto no disponible.", 409);
          const line = saleLine(product, input, settings.servings);
          if (line.consumed) {
            const updated = await Product.findOneAndUpdate(
              { _id: product._id, stock: { $gte: line.consumed } },
              { $inc: { stock: -line.consumed } },
              { new: true, session },
            );
            if (!updated)
              throw new Problem(
                `Inventario insuficiente: ${product.name}.`,
                409,
              );
            movements.push({
              productId: String(product._id),
              productName: product.name,
              delta: -line.consumed,
              unit: product.inventory,
              reason: "Venta",
              balance: updated.stock,
            });
          }
          lines.push(line);
        }
        [sale] = await Sale.create(
          [
            {
              requestId,
              label,
              paymentMethod: method,
              paidAt: new Date(),
              items: lines,
              total:
                Math.round(
                  lines.reduce((sum, item) => sum + item.amount, 0) * 100,
                ) / 100,
            },
          ],
          { session },
        );
        await Movement.create(
          movements.map((m) => ({ ...m, saleId: String(sale._id) })),
          { session, ordered: true },
        );
      });
    } catch (err) {
      if (err.code !== 11000) throw err;
      sale = await Sale.findOne({ requestId });
      if (!sale) throw err;
    }
    res.status(201).json(sale);
  });
  app.post("/api/admin/sales/:id/void", async (req, res) => {
    const reason = text(req.body.reason, "Motivo", 250, true);
    await mongoose.connection.transaction(async (session) => {
      const sale = await Sale.findOneAndUpdate(
        { _id: req.params.id, status: "paid", billId: { $exists: false } },
        { $set: { status: "void" } },
        { new: true, session },
      );
      if (!sale) throw new Problem("Venta no encontrada o ya anulada.", 409);
      for (const item of sale.items)
        if (item.consumed) {
          const product = await Product.findByIdAndUpdate(
            item.productId,
            { $inc: { stock: item.consumed } },
            { new: true, session },
          );
          await Movement.create(
            [
              {
                productId: item.productId,
                productName: item.name,
                delta: item.consumed,
                unit: product.inventory,
                reason: `Anulación: ${reason}`,
                saleId: String(sale._id),
                balance: product.stock,
              },
            ],
            { session },
          );
        }
    });
    res.json({ ok: true });
  });
  app.get("/api/admin/reports", async (req, res) => {
    const from = new Date(req.query.from ?? "2000-01-01");
    const to = new Date(req.query.to ?? "2100-01-01");
    if (!Number.isFinite(+from) || !Number.isFinite(+to) || from > to)
      throw new Problem("Rango de fechas inválido.");
    const match = {
      status: "paid",
      $or: [
        { paidAt: { $gte: from, $lt: to } },
        { paidAt: { $exists: false }, createdAt: { $gte: from, $lt: to } },
      ],
    };
    const [summary, ranking] = await Promise.all([
      Sale.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$total" },
            count: { $sum: 1 },
          },
        },
      ]),
      Sale.aggregate([
        { $match: match },
        { $unwind: "$items" },
        {
          $group: {
            _id: { productId: "$items.productId", category: "$items.category" },
            name: { $last: "$items.name" },
            quantity: { $sum: "$items.quantity" },
            revenue: { $sum: "$items.amount" },
          },
        },
        { $sort: { quantity: -1, revenue: -1 } },
      ]),
    ]);
    res.json({
      revenue: summary[0]?.revenue ?? 0,
      count: summary[0]?.count ?? 0,
      ranking,
    });
  });
  if (frontendDist) serveFrontend(app, frontendDist);
  app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada." }));
  app.use((err, req, res, next) => {
    const status =
      err.status ??
      (["ValidationError", "CastError"].includes(err.name) ? 400 : 500);
    if (status === 500) console.error(err);
    res.status(status).json({
      error:
        status === 500 ? "No se pudo completar la operación." : err.message,
    });
  });
  return app;
}
function promotionInput(body) {
  const starts = new Date(body.starts),
    ends = new Date(body.ends);
  if (!Number.isFinite(+starts) || !Number.isFinite(+ends) || starts >= ends)
    throw new Problem("Fechas de promoción inválidas.");
  return {
    title: text(body.title, "Título", 150, true),
    description: text(body.description ?? "", "Descripción"),
    image: image(body.image),
    starts,
    ends,
    active: body.active !== false,
  };
}
function eventInput(body) {
  if (!["music", "karaoke", "sports", "other"].includes(body.kind ?? "other"))
    throw new Problem("Tipo de evento inválido.");
  const starts = body.starts ? new Date(body.starts) : null;
  const ends = body.ends ? new Date(body.ends) : null;
  if (
    (starts && !Number.isFinite(+starts)) ||
    (ends && !Number.isFinite(+ends)) ||
    !!starts !== !!ends ||
    (starts && ends && starts >= ends)
  )
    throw new Problem(
      "Definí inicio y fin válidos, o dejá ambas fechas pendientes.",
    );
  return {
    title: text(body.title, "Título", 150, true),
    kind: body.kind ?? "other",
    description: text(body.description ?? "", "Descripción", 1000),
    image: image(body.image),
    starts,
    ends,
    location: text(body.location ?? "", "Lugar", 200),
    admission: text(body.admission ?? "", "Entrada", 100),
    active: body.active !== false,
    isSample: body.isSample === true,
  };
}
