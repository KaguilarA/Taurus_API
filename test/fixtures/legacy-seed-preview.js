import { loadEnvironment } from "../../config/runtime.js";
import mongoose from "mongoose";
import { OwlMongoConnect } from "owl-expressjs-utils";
import { startLocalMongo } from "../../db/local-mongo.js";
import { seed } from "./seed.js";
import { seedPreviewData } from "./preview-data.js";

loadEnvironment();
if (process.env.NODE_ENV === "production")
  throw new Error("Los datos de prueba se cargan en desarrollo.");
if (process.env.LOCAL_MONGO_AUTOSTART === "true") await startLocalMongo();
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
  console.log(await seedPreviewData({ resetAdminPassword: true }));
  console.log("Datos guardados. Usuario: admin · Contraseña: 12345678");
} finally {
  await mongoose.disconnect();
}
