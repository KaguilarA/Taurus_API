import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const projectRoot = fileURLToPath(new URL("../", import.meta.url));
export class ConfigurationError extends Error {
  status = 400;
}
export function loadEnvironment() {
  const filename = process.env.ENV_FILE
    ? resolve(process.env.ENV_FILE)
    : resolve(projectRoot, ".env");
  if (existsSync(filename)) process.loadEnvFile(filename);
  else if (process.env.ENV_FILE)
    throw new ConfigurationError("No existe el archivo ENV_FILE configurado.");
}
export function runtimeConfig(env = process.env, { demo = false } = {}) {
  if (
    env.NODE_ENV &&
    !["development", "test", "production"].includes(env.NODE_ENV)
  )
    throw new ConfigurationError(
      "NODE_ENV debe ser development, test o production.",
    );
  const production = env.NODE_ENV === "production";
  if (production && (demo || env.LOCAL_MONGO_AUTOSTART === "true"))
    throw new ConfigurationError(
      "Producción no permite MongoDB temporal ni el arranque local de desarrollo.",
    );
  if (!demo && !/^mongodb(?:\+srv)?:\/\//.test(env.DB_HOST ?? ""))
    throw new ConfigurationError(
      "Configurá DB_HOST con una URI de MongoDB válida.",
    );
  const rawOrigin = env.FRONTEND_URL || env.RENDER_EXTERNAL_URL;
  let parsed;
  try {
    parsed = new URL(rawOrigin);
  } catch {
    throw new ConfigurationError(
      "Configurá FRONTEND_URL o RENDER_EXTERNAL_URL con el origen público.",
    );
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/" ||
    (production && parsed.protocol !== "https:")
  )
    throw new ConfigurationError(
      "FRONTEND_URL debe ser un origen sin ruta; en producción debe usar HTTPS.",
    );
  if (
    !demo &&
    (!env.SESSION_SECRET ||
      env.SESSION_SECRET.length < 32 ||
      /replace|changeme|example/i.test(env.SESSION_SECRET))
  )
    throw new ConfigurationError(
      "SESSION_SECRET debe ser aleatorio, de al menos 32 caracteres y sin valores de ejemplo.",
    );
  const port = Number(env.PORT ?? (production ? 10000 : 4000));
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new ConfigurationError("PORT debe ser un puerto válido.");
  const trustProxy = Number(env.TRUST_PROXY ?? (production ? 1 : 0));
  if (!Number.isInteger(trustProxy) || trustProxy < 0 || trustProxy > 10)
    throw new ConfigurationError(
      "TRUST_PROXY debe indicar de 0 a 10 proxies confiables.",
    );
  {
    if (!/^[a-zA-Z0-9_-]+$/.test(env.DB_NAME ?? ""))
      throw new ConfigurationError(
        "Configurá DB_NAME con el nombre de la base.",
      );
  }
  return {
    production,
    demo,
    uri: env.DB_HOST,
    origin: parsed.origin,
    port,
    trustProxy,
    host: env.HOST || (production ? "0.0.0.0" : "127.0.0.1"),
    secret: env.SESSION_SECRET,
    dbName: env.DB_NAME,
    frontendDist: env.FRONTEND_DIST
      ? resolve(projectRoot, env.FRONTEND_DIST)
      : undefined,
  };
}
export function assertProductionPassword(password) {
  if (
    typeof password !== "string" ||
    password !== password.trim() ||
    password.length < 12 ||
    /^(.)\1+$/.test(password) ||
    ["123456789012", "password1234"].includes(password) ||
    /replace|changeme|example|demo/i.test(password)
  )
    throw new ConfigurationError(
      "La contraseña de producción requiere al menos 12 caracteres y no puede ser una clave de prueba o de ejemplo.",
    );
}
