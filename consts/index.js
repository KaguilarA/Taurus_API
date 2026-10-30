import { loadEnvironment } from "../config/runtime.js";
loadEnvironment();
const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Configurá ${name} en el entorno.`);
  return value;
};

export const ClusterEnabled = process.env.CLUSTER_ENABLED === "true";
export const Port = Number(required("PORT"));
export const DbHost = required("DB_HOST");
export const DbName = required("DB_NAME");
export const FrontendUrl = required("FRONTEND_URL");
export const NodeEnv = process.env.NODE_ENV;
export const SessionSecret = required("SESSION_SECRET");
