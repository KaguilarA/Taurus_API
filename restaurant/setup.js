import mongoose from "mongoose";
import { OwlRateLimit } from "owl-expressjs-utils";
import { Problem, text, usernameInput } from "./domain.js";
import { assertProductionPassword } from "./config.js";
import { SetupLock } from "./models.js";

const adminFilter = { role: { $in: ["admin", null] } };
export async function needsFirstAdmin() {
  return !(await mongoose.model("RestaurantAccount").exists(adminFilter));
}
export async function needsBusiness() {
  return !(await mongoose.model("Business").exists({
    key: "main",
    name: { $type: "string", $ne: "" },
    currency: { $regex: /^[A-Z]{3}$/ },
    accent: { $regex: /^#[\da-fA-F]{6}$/ },
    "servings.large": { $gt: 0 },
    "servings.small": { $gt: 0 },
    "servings.shot": { $gt: 0 },
  }));
}

export function registerInitialSetup(app) {
  app.get("/api/setup/status", async (req, res) => {
    const [required, businessRequired] = await Promise.all([
      needsFirstAdmin(),
      needsBusiness(),
    ]);
    res.json({ required, businessRequired });
  });
  app.post(
    "/api/setup/admin",
    OwlRateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    async (req, res) => {
      if (!(await needsFirstAdmin()))
        throw new Problem("El registro inicial ya no está disponible.", 404);
      const body = req.body ?? {};
      const username = usernameInput(body.username);
      const name = text(body.name ?? "", "Nombre", 100);
      const password = body.password;
      assertProductionPassword(password);
      if (password.length > 200)
        throw new Problem("La contraseña no puede superar 200 caracteres.");
      if (body.passwordConfirmation !== password)
        throw new Problem("Las contraseñas no coinciden.");
      let account;
      try {
        await mongoose.connection.transaction(async (session) => {
          // Every API instance writes the same document: concurrent initial registrations
          // serialize in MongoDB, then recheck the actual administrator collection.
          await SetupLock.updateOne(
            { _id: "first-admin" },
            { $inc: { revision: 1 } },
            { upsert: true, session },
          );
          const AccountsModel = mongoose.model("RestaurantAccount");
          if (await AccountsModel.exists(adminFilter).session(session))
            throw new Problem(
              "La configuración inicial ya fue completada.",
              409,
            );
          [account] = await AccountsModel.create(
            [
              {
                username,
                name,
                password,
                email: `${username}@accounts.local`,
                role: "admin",
              },
            ],
            { session },
          );
        });
      } catch (error) {
        if (error.code === 11000)
          throw new Problem(
            "El registro cambió o ese usuario ya está ocupado. Volvé a intentar.",
            409,
          );
        throw error;
      }
      await new Promise((resolve, reject) =>
        req.session.regenerate((error) => (error ? reject(error) : resolve())),
      );
      req.session.userId = String(account._id);
      req.session.userVersion = account.sessionVersion ?? 0;
      await new Promise((resolve, reject) =>
        req.session.save((error) => (error ? reject(error) : resolve())),
      );
      res.status(201).json({
        authenticated: true,
        role: "admin",
        username: account.username,
      });
    },
  );
}
