import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import mongoose from "mongoose";

const root = fileURLToPath(new URL("../", import.meta.url));
function configuration() {
  if (process.env.NODE_ENV === "production")
    throw new Error("El arranque local de MongoDB es solo para desarrollo.");
  const port = Number(process.env.LOCAL_MONGO_PORT);
  const replica = process.env.LOCAL_MONGO_REPLICA_SET;
  const executable = process.env.LOCAL_MONGO_BINARY;
  const directory = resolve(
    root,
    process.env.LOCAL_MONGO_DATA_DIR ?? ".local/mongodb",
  );
  if (
    !Number.isInteger(port) ||
    port < 1024 ||
    port > 65535 ||
    !/^[a-zA-Z0-9_-]+$/.test(replica ?? "") ||
    !executable ||
    !existsSync(executable)
  ) {
    throw new Error(
      "Revisá LOCAL_MONGO_PORT, LOCAL_MONGO_REPLICA_SET y LOCAL_MONGO_BINARY en .env.",
    );
  }
  return { port, replica, executable, directory };
}
async function connect(config) {
  const client = new mongoose.mongo.MongoClient(
    `mongodb://127.0.0.1:${config.port}/admin?directConnection=true`,
    { serverSelectionTimeoutMS: 700 },
  );
  try {
    await client.connect();
    return client;
  } catch (error) {
    await client.close();
    throw error;
  }
}
async function verify(client, config) {
  const options = await client.db("admin").command({ getCmdLineOpts: 1 });
  const samePath =
    resolve(options.parsed.storage?.dbPath ?? "").toLowerCase() ===
    config.directory.toLowerCase();
  const replica =
    options.parsed.replication?.replSetName ??
    options.parsed.replication?.replSet;
  if (!samePath || replica !== config.replica)
    throw new Error(
      `El puerto ${config.port} pertenece a otra instancia de MongoDB. No se modificó.`,
    );
}
export async function startLocalMongo() {
  const config = configuration();
  const uri = new URL(process.env.DB_HOST);
  if (
    uri.hostname !== "127.0.0.1" ||
    Number(uri.port) !== config.port ||
    uri.searchParams.get("replicaSet") !== config.replica
  )
    throw new Error(
      "DB_HOST debe coincidir con la instancia local configurada en .env.",
    );
  let client;
  try {
    client = await connect(config);
  } catch {
    /* No server listening yet. */
  }
  if (!client) {
    mkdirSync(config.directory, { recursive: true });
    const child = spawn(
      config.executable,
      [
        "--dbpath",
        config.directory,
        "--port",
        String(config.port),
        "--bind_ip",
        "127.0.0.1",
        "--replSet",
        config.replica,
        "--logpath",
        resolve(config.directory, "mongod.log"),
        "--logappend",
      ],
      { detached: true, windowsHide: true, stdio: "ignore" },
    );
    await new Promise((accept, reject) => {
      child.once("spawn", accept);
      child.once("error", reject);
    });
    child.unref();
    for (let attempt = 0; attempt < 40 && !client; attempt++) {
      try {
        client = await connect(config);
      } catch {
        await setTimeout(250);
      }
    }
    if (!client)
      throw new Error(
        `MongoDB no arrancó. Consultá ${resolve(config.directory, "mongod.log")}.`,
      );
  }
  try {
    await verify(client, config);
    const admin = client.db("admin");
    try {
      await admin.command({ replSetGetStatus: 1 });
    } catch (error) {
      if (error.code !== 94) throw error;
      await admin.command({
        replSetInitiate: {
          _id: config.replica,
          members: [{ _id: 0, host: `127.0.0.1:${config.port}` }],
        },
      });
    }
    for (let attempt = 0; attempt < 80; attempt++) {
      const hello = await admin.command({ hello: 1 });
      if (hello.isWritablePrimary) {
        console.log(
          `MongoDB local persistente listo: 127.0.0.1:${config.port} (${config.replica}).`,
        );
        return;
      }
      await setTimeout(250);
    }
    throw new Error("MongoDB no eligió el nodo primario a tiempo.");
  } finally {
    await client.close();
  }
}
async function stopLocalMongo() {
  const config = configuration();
  const client = await connect(config);
  try {
    await verify(client, config);
    try {
      await client.db("admin").command({ shutdown: 1 });
    } catch (error) {
      if (!/closed|shutdown|interrupted|ECONNRESET/i.test(error.message))
        throw error;
    }
    console.log("MongoDB local detenido. Los datos se conservan.");
  } finally {
    await client.close();
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (existsSync(resolve(root, ".env")))
    process.loadEnvFile(resolve(root, ".env"));
  if (process.argv.includes("--stop")) await stopLocalMongo();
  else await startLocalMongo();
}
