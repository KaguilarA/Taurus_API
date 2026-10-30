import { OwlCollection } from "owl-expressjs-utils";
import { UserModel, BusinessModel } from "../models/models.js";

// Only migrate identifiers on existing accounts. Never seed business data or credentials.
export async function seed() {
  if (!(await BusinessModel.exists({ key: "main" }))) {
    const chosen = process.env.BUSINESS_ID
      ? await BusinessModel.getById(process.env.BUSINESS_ID)
      : null;
    const existing = chosen
      ? [chosen]
      : await BusinessModel.getByCoincidence({}, { limit: 2 });
    if (existing.length > 1)
      throw new Error(
        "Configurá BUSINESS_ID para seleccionar el negocio existente.",
      );
    if (existing.length === 1)
      await BusinessModel.updateWhere(
        { _id: existing[0]._id },
        { $set: { key: "main" } },
      );
    else {
      // Copy stored legacy data, never a hardcoded business profile. Keep the original as-is.
      const legacy = await OwlCollection("restaurantsettings").findOne({
        key: "main",
      });
      if (legacy?.name) {
        const { _id, __v, createdAt, updatedAt, ...data } = legacy;
        await BusinessModel.updateWhere(
          { key: "main" },
          { $setOnInsert: data },
          { upsert: true, runValidators: true },
        );
      }
    }
  }
  // Give existing email-based accounts a username without changing their password.

  for (const account of await UserModel.getByCoincidence(
    { username: { $exists: false } },
    { sort: { createdAt: 1 } },
  )) {
    const base = (
      (account.email?.split("@")[0] ?? account.name ?? String(account._id))
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "-")
        .slice(0, 30) || "user"
    ).padEnd(3, "0");
    const candidate = base;
    const taken = await UserModel.exists({
      username: candidate,
      _id: { $ne: account._id },
    });
    await UserModel.update(String(account._id), {
      username: taken ? `${base}-${String(account._id).slice(-6)}` : candidate,
    });
  }
}
