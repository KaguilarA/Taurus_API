import mongoose from "mongoose";
import { ConfigurationError } from "../config/runtime.js";
// IDs and stored hashes are copied verbatim. Source collections are retained as a backup.
export const legacyCollections = [
  ["restaurantaccounts", "users"],
  ["restaurantproducts", "products"],
  ["restaurantpromotions", "promos"],
  ["restaurantsales", "orders"],
  ["restaurantbills", "carts"],
  ["restauranttables", "tables"],
  ["restaurantevents", "events"],
  ["restaurantmovements", "stockmovements"],
  ["restaurantsetuplocks", "setuplocks"],
  ["restaurantpasswordresets", "passwordresets"],
];
export async function migrateLegacyCollections({
  maintenance = process.env.MAINTENANCE_MODE === "true",
} = {}) {
  const db = mongoose.connection.db,
    marker = db.collection("applicationmigrations");
  const id = "canonical-models-v1";
  if ((await marker.findOne({ _id: id }))?.done) return;
  let hasLegacy = false;
  for (const [source] of legacyCollections)
    if (await db.collection(source).findOne({}, { projection: { _id: 1 } })) {
      hasLegacy = true;
      break;
    }
  if (hasLegacy && !maintenance)
    throw new ConfigurationError(
      "La migración requiere MAINTENANCE_MODE=true en la versión anterior antes de desplegar. No se modificaron los datos.",
    );
  await marker.updateOne(
    { _id: id },
    { $setOnInsert: { done: false, revision: 0 } },
    { upsert: true },
  );
  await mongoose.connection.transaction(async (session) => {
    const lock = await marker.findOneAndUpdate(
      { _id: id },
      { $inc: { revision: 1 } },
      { session, returnDocument: "after" },
    );
    if (lock.done) return;
    for (const [source, target] of legacyCollections) {
      for await (const document of db
        .collection(source)
        .find({}, { session })) {
        if (
          await db
            .collection(target)
            .findOne({ _id: document._id }, { session })
        )
          throw new ConfigurationError(
            `Migración detenida por conflicto entre ${source} y ${target}. No se sobrescribieron datos.`,
          );
        await db.collection(target).insertOne(source === "restaurantaccounts" && !document.role ? {...document, role:"admin"} : document, { session });
      }
    }
    await marker.updateOne(
      { _id: id },
      { $set: { done: true, completedAt: new Date() } },
      { session },
    );
  });
}
