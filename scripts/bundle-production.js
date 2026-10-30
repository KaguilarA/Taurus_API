import {
  cp,
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  writeFile,
  stat,
} from "node:fs/promises";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { loadEnvironment, projectRoot } from "../restaurant/config.js";

loadEnvironment();
const frontend = resolve(
  projectRoot,
  process.env.FRONTEND_SOURCE_DIR || "../taurus-ng-fe",
);
const packageFile = JSON.parse(
  await readFile(join(frontend, "package.json"), "utf8"),
);
if (packageFile.name !== "taurus-ng-fe")
  throw new Error("FRONTEND_SOURCE_DIR no corresponde al frontend de Taurus.");
if (!process.env.npm_execpath)
  throw new Error("Ejecutá npm run bundle:production.");
execFileSync(
  process.execPath,
  [process.env.npm_execpath, "--prefix", frontend, "run", "build"],
  { stdio: "inherit" },
);
const frontendDist = join(frontend, "dist", "taurus-ng-fe", "browser");
await stat(join(frontendDist, "index.html"));
const releases = resolve(projectRoot, "release");
await mkdir(releases, { recursive: true });
// A fresh folder prevents overwriting a previous release or touching user data.
const output = await mkdtemp(join(releases, "felos-bar-"));
const combined = process.argv.includes("--combined");
const backend = combined ? output : join(output, "backend");
await mkdir(join(backend, "restaurant"), { recursive: true });
for (const entry of await readdir(resolve(projectRoot, "restaurant"))) {
  if (
    entry.endsWith(".js") &&
    !entry.endsWith(".test.js") &&
    !["preview-data.js", "seed-preview.js"].includes(entry)
  )
    await copyFile(
      resolve(projectRoot, "restaurant", entry),
      join(backend, "restaurant", entry),
    );
}
await mkdir(join(backend, "models/business"), { recursive: true });
await copyFile(resolve(projectRoot, "models/business/model.js"), join(backend, "models/business/model.js"));
for (const entry of ["package.json", "package-lock.json"])
  await copyFile(resolve(projectRoot, entry), join(backend, entry));
const runtimePackage = JSON.parse(
  await readFile(join(backend, "package.json"), "utf8"),
);
runtimePackage.scripts = {
  start: "node restaurant/server.js",
  "account:password": "node restaurant/account-password.js",
};
await writeFile(
  join(backend, "package.json"),
  JSON.stringify(runtimePackage, null, 2) + "\n",
);
await cp(frontendDist, join(output, combined ? "web" : "frontend"), {
  recursive: true,
});
for (const entry of [
  "render.yaml",
  "Dockerfile",
  ".dockerignore",
  ".gitignore",
  ".env.production.example",
  "README.md",
])
  await copyFile(
    resolve(
      projectRoot,
      "deploy",
      !combined &&
        [
          "render.yaml",
          "Dockerfile",
          ".env.production.example",
          "README.md",
        ].includes(entry)
        ? "separate"
        : "",
      entry,
    ),
    join(backend, entry),
  );
await writeFile(join(backend, ".node-version"), "24\n");
if (!combined) {
  await copyFile(
    resolve(projectRoot, "deploy/separate/README.md"),
    join(output, "README.md"),
  );
  await copyFile(
    join(frontend, ".dev.vars.example"),
    join(output, ".dev.vars.example"),
  );
}
const manifest = [];
async function walk(directory, prefix = "") {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix + item.name;
    if (item.isDirectory())
      await walk(join(directory, item.name), relative + "/");
    else {
      if (
        item.name.startsWith(".env") &&
        item.name !== ".env.production.example"
      )
        throw new Error("El paquete contiene un archivo de secretos.");
      const content = await readFile(join(directory, item.name));
      manifest.push({
        file: relative,
        bytes: content.length,
        sha256: createHash("sha256").update(content).digest("hex"),
      });
    }
  }
}
await walk(output);
await writeFile(
  join(output, "release-manifest.json"),
  JSON.stringify(
    { createdAt: new Date().toISOString(), files: manifest },
    null,
    2,
  ),
);
const archive = output + ".tar.gz";
execFileSync("tar", ["-czf", archive, "-C", output, "."]);
console.log(
  `Paquete de producción: ${output}\nArchivo: ${archive}\nNo contiene .env, node_modules ni la base local.`,
);
