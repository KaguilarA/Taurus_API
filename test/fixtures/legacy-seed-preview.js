import { OwlMongoConnect, OwlMongoClose } from "owl-expressjs-utils";
import { registeredModels } from "../../models/models.js";
import { loadEnvironment } from "../../config/runtime.js";

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
  await Promise.all(registeredModels.map((model) => model.initialize()));
  console.log(await seedPreviewData({ resetAdminPassword: true }));
  console.log("Datos guardados. Usuario: admin · Contraseña: 12345678");
} finally {
  await OwlMongoClose();
}
