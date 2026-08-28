process.loadEnvFile();

export const ClusterEnabled = process.env.CLUSTER_ENABLED === "true";
export const Port = Number(process.env.PORT) || 4000;
export const DbHost = process.env.DB_HOST || "localhost";
export const DbName = process.env.DB_NAME || "taurus";
export const FrontendUrl = process.env.FRONTEND_URL || "http://localhost:4200";
export const NodeEnv = process.env.NODE_ENV;
export const SessionSecret = process.env.SESSION_SECRET || "1234567890";
