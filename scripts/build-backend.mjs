import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..");
await mkdir(join(root, "dist"), { recursive: true });
const output = await mkdtemp(join(root, "dist/backend-"));
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
  await cp(join(root, directory), join(output, directory), {
    recursive: true,
    filter: (source) => !source.endsWith(".test.js") && !source.endsWith(".md"),
  });
for (const file of ["app.js", "index.js"])
  await cp(join(root, file), join(output, file));
await mkdir(join(output, "scripts"));
for (const file of ["account-password.js", "healthcheck.js"])
  await cp(join(root, "scripts", file), join(output, "scripts", file));
for (const file of ["package.json", "package-lock.json", ".npmrc"])
  await cp(join(root, file), join(output, file));
const pkg = JSON.parse(await readFile(join(output, "package.json"), "utf8"));
pkg.scripts = {
  start: "node index.js",
  "account:password": "node scripts/account-password.js",
};
await writeFile(
  join(output, "package.json"),
  JSON.stringify(pkg, null, 2) + "\n",
);
await writeFile(join(output, ".node-version"), "24\n");
console.log(`Backend artifact: ${output}`);
if (process.env.GITHUB_OUTPUT) {
  const { appendFile } = await import("node:fs/promises");
  await appendFile(process.env.GITHUB_OUTPUT, `directory=${output}\n`);
}
