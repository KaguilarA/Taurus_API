import {EmailModel} from '../../models/models.js';
import { randomUUID } from "node:crypto";
import { usernameInput } from "../../services/validation.js";

import { Accounts } from "../../models/models.js";
import { Problem, text } from "../../services/validation.js";
import mongoose from "mongoose";

import { assertProductionPassword } from "../../config/runtime.js";

const asyncSession = (session, action) =>
  new Promise((resolve, reject) =>
    session[action]((err) => (err ? reject(err) : resolve())),
  );

export function createAuthController({ origin, production } = {}) {
  const status = async (req, res) => {
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
  };
  const logIn = async (req, res) => {
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
    let account = await Accounts.getOne(lookup);
    if (!account && lookup.email) {
      const email = await EmailModel.getOne({email:lookup.email,ownerType:"User"});
      if (email) account = await Accounts.getById(email.owner);
    }
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
  };
  const logout = async (req, res) => {
    await asyncSession(req.session, "destroy");
    res.clearCookie("connect.sid");
    res.json({ authenticated: false });
  };
  return { status, logIn, logout };
}

const Account = mongoose.model("User");
const Reset = mongoose.model("PasswordReset");
const saveSession = (session) =>
  new Promise((resolve, reject) =>
    session.save((e) => (e ? reject(e) : resolve())),
  );

function passwordInput(body) {
  const password = text(body.password, "Contraseña", 200, true);
  assertProductionPassword(password);
  if (password !== body.passwordConfirmation)
    throw new Problem("Las contraseñas no coinciden.");
  return password;
}
export function createRecoveryController({ production, origin } = {}) {
  const requestReset = async (req, res) => {
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
  };
  const resetStatus = async (req, res) => {
    const reset = req.session.passwordReset
      ? await Reset.findOne({
          _id: req.session.passwordReset,
          expiresAt: { $gt: new Date() },
        })
      : null;
    res.json({ state: reset?.state ?? "expired" });
  };
  const completeReset = async (req, res) => {
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
  };
  return { requestReset, resetStatus, completeReset };
}

export default createAuthController;
