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
import { loadEnvironment, projectRoot } from "../config/runtime.js";

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
for (const directory of [
  "api",
  "config",
  "consts",
  "controllers",
  "db",
  "middlewares",
  "models",
  "routes",
  "services",
  "utils",
])
  await cp(resolve(projectRoot, directory), join(backend, directory), {
    recursive: true,
    filter: (source) => !source.endsWith(".test.js") && !source.endsWith(".md"),
  });
for (const file of ["app.js", "index.js"])
  await copyFile(resolve(projectRoot, file), join(backend, file));
await mkdir(join(backend, "scripts"));
for (const file of ["account-password.js", "healthcheck.js"])
  await copyFile(
    resolve(projectRoot, "scripts", file),
    join(backend, "scripts", file),
  );
for (const entry of ["package.json", "package-lock.json", ".npmrc"])
  await copyFile(resolve(projectRoot, entry), join(backend, entry));
const runtimePackage = JSON.parse(
  await readFile(join(backend, "package.json"), "utf8"),
);
runtimePackage.scripts = {
  start: "node index.js",
  "account:password": "node scripts/account-password.js",
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
