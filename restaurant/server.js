import { createServer } from "node:http";
import mongoose from "mongoose";
import { OwlMongoConnect } from "owl-expressjs-utils";
import { createApp } from "./app.js";
import { seed } from "./seed.js";
import { startLocalMongo } from "./local-mongo.js";
import { attachOrderSockets } from "./sockets.js";
import {
  loadEnvironment,
  runtimeConfig,
  ConfigurationError,
} from "./config.js";
import { assertProductionAccounts } from "./production-accounts.js";

let replica, sockets;
try {
  loadEnvironment();
  const config = runtimeConfig(process.env, {
    demo: process.argv.includes("--demo"),
  });
  const uri = config.uri;
  if (process.argv.includes("--demo"))
    throw new ConfigurationError(
      "Usá una base configurada en el entorno para iniciar la aplicación.",
    );
  if (process.env.LOCAL_MONGO_AUTOSTART === "true") await startLocalMongo();
  await OwlMongoConnect(
    uri,
    process.env.DB_NAME && !config.demo ? { dbName: config.dbName } : {},
  );
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid")
    throw new ConfigurationError(
      "MongoDB debe ser replica set o Atlas para transacciones y sockets.",
    );
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.init()),
  );
  await seed();
  if (config.production) await assertProductionAccounts();
  const app = createApp({
    uri,
    origin: config.origin,
    production: config.production,
    trustProxy: config.trustProxy,
    frontendDist: config.frontendDist,
    secret: config.secret,
  });
  const server = createServer(app);
  sockets = attachOrderSockets(server, {
    sessionMiddleware: app.locals.sessionMiddleware,
    origin: config.origin,
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, resolve);
  });
  console.log(
    `API lista en ${config.host}:${config.port} · ${config.production ? "producción" : "desarrollo"}`,
  );
  let stopping = false;
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, async () => {
      if (stopping) return;
      stopping = true;
      app.locals.draining = true;
      const timeout = setTimeout(() => process.exit(1), 10000);
      timeout.unref();
      await sockets.close();
      await mongoose.disconnect();
      if (replica) await replica.stop();
      clearTimeout(timeout);
      process.exit(0);
    });
} catch (error) {
  console.error(
    error instanceof ConfigurationError
      ? error.message
      : `No se pudo iniciar la API (${error.name}). Revisá el entorno y la conexión con MongoDB.`,
  );
  if (sockets) await sockets.close().catch(() => {});
  await mongoose.disconnect();
  if (replica) await replica.stop();
  process.exitCode = 1;
}
