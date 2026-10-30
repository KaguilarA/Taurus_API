import mongoose from "mongoose";

import { Accounts, UserModel } from "../../models/models.js";
import { Problem, text, usernameInput } from "../../services/validation.js";
import { assertProductionPassword } from "../../config/runtime.js";
const Account = mongoose.model("User");
const Reset = mongoose.model("PasswordReset");
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
export function createUserController({ production, origin } = {}) {
  const getInfo = (req, res) => res.json(profile(req.account));
  const update = async (req, res) => {
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
  };
  const changePassword = async (req, res) => {
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
  };
  const getPasswordResets = async (req, res) => {
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
  };
  const decidePasswordReset = async (req, res) => {
    if (!["approved", "rejected"].includes(req.body.state))
      throw new Problem("Decisión inválida.");
    const reset = await Reset.findOneAndUpdate(
      { _id: req.params.id, state: "pending", expiresAt: { $gt: new Date() } },
      { $set: { state: req.body.state, approvedBy: String(req.account._id) } },
      { new: true },
    );
    if (!reset) throw new Problem("Solicitud vencida o ya atendida.", 409);
    res.json({ ok: true });
  };
  return {
    getInfo,
    update,
    changePassword,
    getPasswordResets,
    decidePasswordReset,
  };
}
export function createAccountsController({ production } = {}) {
  const getAccounts = async (req, res) =>
    res.json(
      await mongoose
        .model("User")
        .find()
        .select("username email name role")
        .lean(),
    );
  const registerAccount = async (req, res) => {
    const role = req.body.role;
    if (!["admin", "kitchen", "waiter"].includes(role))
      throw new Problem("Rol inválido.");
    const username = usernameInput(
      req.body.username ?? req.body.email?.split("@")[0],
    );
    const email = req.body.email === undefined ? undefined : text(req.body.email, "Correo",254,true).toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Problem("Correo inválido.");
    const password = text(req.body.password, "Contraseña", 200, true);
    if (production) assertProductionPassword(password);
    if (password.length < 8)
      throw new Problem("La contraseña requiere al menos 8 caracteres.");
    if (await Accounts.getOne({ $or: [{ username }, ...(email ? [{email}] : [])] }))
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
  };
  return { getAccounts, registerAccount };
}

export default createUserController;
