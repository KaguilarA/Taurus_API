import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { OwlRateLimit } from "owl-expressjs-utils";
import { Accounts } from "./models.js";
import { Problem, text, usernameInput } from "./domain.js";
import { assertProductionPassword } from "./config.js";
const Account = mongoose.model("RestaurantAccount");
const Reset = mongoose.model(
  "RestaurantPasswordReset",
  new mongoose.Schema(
    {
      _id: String,
      accountId: mongoose.Schema.Types.ObjectId,
      accountVersion: { type: Number, default: 0 },
      state: {
        type: String,
        enum: ["pending", "approved", "rejected", "used"],
        default: "pending",
      },
      expiresAt: { type: Date, index: { expires: 0 } },
      approvedBy: String,
    },
    { timestamps: true },
  ),
);
const saveSession = (session) =>
  new Promise((resolve, reject) =>
    session.save((e) => (e ? reject(e) : resolve())),
  );
const profile = (a) => ({
  _id: String(a._id),
  username: a.username,
  name: a.name,
  role: a.role,
});
function passwordInput(body) {
  const password = text(body.password, "Contraseña", 200, true);
  assertProductionPassword(password);
  if (password !== body.passwordConfirmation)
    throw new Problem("Las contraseñas no coinciden.");
  return password;
}
export function registerRecovery(app) {
  app.post(
    "/api/auth/reset/request",
    OwlRateLimit({ windowMs: 900000, limit: 5 }),
    async (req, res) => {
      const username = usernameInput(req.body.username);
      const account = await Account.findOne({ username }).select(
        "_id sessionVersion",
      );
      if (req.session.passwordReset)
        await Reset.deleteOne({ _id: req.session.passwordReset });
      const id = randomUUID();
      // Unknown usernames receive the same browser-visible state; only real accounts reach approval.
      await Reset.create({
        _id: id,
        accountId: account?._id,
        accountVersion: account?.sessionVersion ?? 0,
        expiresAt: new Date(Date.now() + 1800000),
      });
      req.session.passwordReset = id;
      await saveSession(req.session);
      res.status(202).json({ state: "pending" });
    },
  );
  app.get("/api/auth/reset/status", async (req, res) => {
    const reset = req.session.passwordReset
      ? await Reset.findOne({
          _id: req.session.passwordReset,
          expiresAt: { $gt: new Date() },
        })
      : null;
    res.json({ state: reset?.state ?? "expired" });
  });
  app.post(
    "/api/auth/reset/complete",
    OwlRateLimit({ windowMs: 900000, limit: 10 }),
    async (req, res) => {
      const password = passwordInput(req.body);
      await mongoose.connection.transaction(async (session) => {
        const reset = await Reset.findOneAndUpdate(
          {
            _id: req.session.passwordReset ?? "",
            state: "approved",
            expiresAt: { $gt: new Date() },
          },
          { $set: { state: "used" } },
          { session },
        );
        if (!reset?.accountId)
          throw new Problem("La solicitud no está aprobada o ya venció.", 403);
        const account = await Account.findOneAndUpdate(
          { _id: reset.accountId, sessionVersion: reset.accountVersion },
          { $set: { password }, $inc: { sessionVersion: 1 } },
          { session, runValidators: true },
        );
        if (!account)
          throw new Problem("La solicitud ya no está disponible.", 403);
      });
      delete req.session.passwordReset;
      await saveSession(req.session);
      res.json({ ok: true });
    },
  );
}
export function registerProfile(app) {
  app.get("/api/admin/me", (req, res) => res.json(profile(req.account)));
  app.put("/api/admin/me", async (req, res) => {
    const data = {
      name: text(req.body.name, "Nombre", 100, true),
      username: usernameInput(req.body.username),
    };
    try {
      const account = await Account.findByIdAndUpdate(
        req.account._id,
        { $set: data },
        { new: true, runValidators: true },
      );
      res.json(profile(account));
    } catch (error) {
      if (error.code === 11000)
        throw new Problem("El usuario ya está en uso.", 409);
      throw error;
    }
  });
  app.put(
    "/api/admin/me/password",
    OwlRateLimit({ windowMs: 900000, limit: 10 }),
    async (req, res) => {
      const password = passwordInput(req.body);
      if (
        !(await Accounts.compareHash(
          String(req.account._id),
          "password",
          text(req.body.currentPassword, "Contraseña actual", 200, true),
        ))
      )
        throw new Problem("La contraseña actual no es correcta.", 403);
      // Compare the version atomically so concurrent password changes cannot overwrite one another.
      const account = await Account.findOneAndUpdate(
        {
          _id: req.account._id,
          sessionVersion: req.account.sessionVersion ?? 0,
        },
        { $set: { password }, $inc: { sessionVersion: 1 } },
        { new: true, runValidators: true },
      );
      if (!account) throw new Problem("Iniciá sesión de nuevo.", 401);
      req.session.userVersion = account.sessionVersion;
      await saveSession(req.session);
      res.json({ ok: true });
    },
  );
  const admin = (req, res, next) =>
    (req.account.role ?? "admin") === "admin"
      ? next()
      : next(new Problem("Acceso restringido.", 403));
  app.get("/api/admin/password-resets", admin, async (req, res) => {
    const requests = await Reset.find({
      state: "pending",
      accountId: { $ne: null },
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: 1 })
      .lean();
    const accounts = await Account.find({
      _id: { $in: requests.map((r) => r.accountId) },
    })
      .select("name username")
      .lean();
    res.json(
      requests.map((r) => ({
        _id: r._id,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        account: accounts.find((a) => String(a._id) === String(r.accountId)),
      })),
    );
  });
  app.patch("/api/admin/password-resets/:id", admin, async (req, res) => {
    if (!["approved", "rejected"].includes(req.body.state))
      throw new Problem("Decisión inválida.");
    const reset = await Reset.findOneAndUpdate(
      { _id: req.params.id, state: "pending", expiresAt: { $gt: new Date() } },
      { $set: { state: req.body.state, approvedBy: String(req.account._id) } },
      { new: true },
    );
    if (!reset) throw new Problem("Solicitud vencida o ya atendida.", 409);
    res.json({ ok: true });
  });
}
