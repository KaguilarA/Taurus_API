import { loadEnvironment } from "../../config/runtime.js";
import mongoose from "mongoose";
import { OwlMongoConnect } from "owl-expressjs-utils";
import { seed } from "./seed.js";
import { seedFelosBrand } from "./brand.js";
loadEnvironment();
if (!process.env.DB_HOST) throw new Error("Configurá DB_HOST en .env.");
await OwlMongoConnect(
  process.env.DB_HOST,
  process.env.DB_NAME ? { dbName: process.env.DB_NAME } : {},
);
try {
  await seed({});
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.init()),
  );
  await seedFelosBrand({
    includeSamples: process.env.NODE_ENV !== "production",
  });
  console.log(
    "Identidad Felos Bar guardada. Los eventos de muestra se cargan solamente en desarrollo.",
  );
} finally {
  await mongoose.disconnect();
}
