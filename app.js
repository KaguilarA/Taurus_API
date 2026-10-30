import { maintenance as maintenanceMiddleware } from "./middlewares/maintenance/maintenance.js";
import express from "express";
import helmet from "helmet";
import { OwlCors, OwlSession } from "owl-expressjs-utils";
import { registerApi } from "./api/api.js";
import { serveFrontend } from "./services/static-site.js";
export function createApp({
  sessionMiddleware,
  origin = process.env.FRONTEND_URL,
  secret = process.env.SESSION_SECRET,
  uri = process.env.DB_HOST,
  production = process.env.NODE_ENV === "production",
  trustProxy = production ? 1 : 0,
  frontendDist,
  uploadImage,
  maintenance = process.env.MAINTENANCE_MODE === "true",
} = {}) {
  if (!origin) throw new Error("Configurá el origen público de la aplicación.");
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", trustProxy);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          connectSrc: ["'self'", origin.replace(/^http/, "ws")],
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(OwlCors([origin]));
  app.use((req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("origin") &&
      req.get("origin") !== origin
    )
      return res.status(403).json({ error: "Origen no permitido." });
    next();
  });
  app.use(express.json({ limit: "256kb" }));
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  const sessions =
    sessionMiddleware ??
    OwlSession(
      secret,
      production ? "production" : "development",
      process.env.DB_NAME,
      uri,
    );
  app.locals.sessionMiddleware = sessions;
  app.locals.origin = origin;
  app.locals.production = production;
  app.use("/api", maintenanceMiddleware(maintenance));
  app.use(sessions);
  registerApi(app, { origin, production, uploadImage });
  if (frontendDist) serveFrontend(app, frontendDist);
  app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada." }));
  app.use((err, req, res, next) => {
    const status =
      err.status ??
      (["ValidationError", "CastError"].includes(err.name) ? 400 : 500);
    if (status === 500) console.error(err);
    res.status(status).json({
      error:
        status === 500 ? "No se pudo completar la operación." : err.message,
    });
  });
  return app;
}

export default createApp;
