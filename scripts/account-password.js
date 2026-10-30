import mongoose from "mongoose";
import { OwlMongoConnect } from "owl-expressjs-utils";
import { loadEnvironment } from "../config/runtime.js";
import { rotatePassword } from "../services/production-accounts.js";

loadEnvironment();
if (
  !process.env.DB_HOST ||
  !process.env.RESET_USERNAME ||
  !process.env.RESET_PASSWORD
)
  throw new Error(
    "Configurá DB_HOST, RESET_USERNAME y RESET_PASSWORD en el entorno; no pases contraseñas por argumentos.",
  );
await OwlMongoConnect(
  process.env.DB_HOST,
  process.env.DB_NAME ? { dbName: process.env.DB_NAME } : {},
);
try {
  await rotatePassword(process.env.RESET_USERNAME, process.env.RESET_PASSWORD);
  console.log("Contraseña actualizada y sesiones anteriores invalidadas.");
} finally {
  await mongoose.disconnect();
}
