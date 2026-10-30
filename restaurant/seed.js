import { Accounts } from "./models.js";
import mongoose from "mongoose";

// Only migrate identifiers on existing accounts. Never seed business data or credentials.
export async function seed() {
  const Business = mongoose.model("Business");
  if (!(await Business.exists({ key: "main" }))) {
    const chosen = process.env.BUSINESS_ID
      ? await Business.findById(process.env.BUSINESS_ID)
      : null;
    const existing = chosen ? [chosen] : await Business.find().limit(2);
    if (existing.length > 1)
      throw new Error(
        "Configurá BUSINESS_ID para seleccionar el negocio existente.",
      );
    if (existing.length === 1)
      await Business.updateOne(
        { _id: existing[0]._id },
        { $set: { key: "main" } },
      );
    else {
      // Copy stored legacy data, never a hardcoded business profile. Keep the original as-is.
      const legacy = await mongoose.connection
        .collection("restaurantsettings")
        .findOne({ key: "main" });
      if (legacy?.name) {
        const { _id, __v, createdAt, updatedAt, ...data } = legacy;
        await Business.updateOne(
          { key: "main" },
          { $setOnInsert: data },
          { upsert: true, runValidators: true },
        );
      }
    }
  }
  // Give existing email-based accounts a username without changing their password.
  const accountModel = mongoose.model("RestaurantAccount");
  for (const account of await accountModel
    .find({ username: { $exists: false } })
    .sort({ createdAt: 1 })) {
    const base = (
      account.email
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "-")
        .slice(0, 30) || "user"
    ).padEnd(3, "0");
    const candidate = base;
    const taken = await accountModel.exists({
      username: candidate,
      _id: { $ne: account._id },
    });
    await Accounts.update(String(account._id), {
      username: taken ? `${base}-${String(account._id).slice(-6)}` : candidate,
    });
  }
}
