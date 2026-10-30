import { test } from "node:test";
import assert from "node:assert/strict";
import { runtimeConfig, assertProductionPassword } from "./config.js";

const production = () => ({
  NODE_ENV: "production",
  DB_HOST: "mongodb+srv://account:secret@cluster.example/felos",
  DB_NAME: "felos",
  SESSION_SECRET: "A-long-random-fixture-secret-with-64-characters-for-tests",
  ADMIN_USERNAME: "owner",
  ADMIN_PASSWORD: "Own-strong-password-2026!",
  FRONTEND_URL: "https://felos.example",
});
test("producción valida origen, secretos y arranque externo", () => {
  const config = runtimeConfig(production());
  assert.equal(config.host, "0.0.0.0");
  assert.equal(config.port, 10000);
  assert.equal(config.trustProxy, 1);
  assert.equal(config.origin, "https://felos.example");
  assert.equal(config.admin, undefined);
  assert.throws(
    () =>
      runtimeConfig({ ...production(), FRONTEND_URL: "http://felos.example" }),
    /HTTPS/,
  );
  assert.throws(
    () =>
      runtimeConfig({
        ...production(),
        FRONTEND_URL: "https://felos.example/admin",
      }),
    /sin ruta/,
  );
  assert.throws(
    () =>
      runtimeConfig({
        ...production(),
        SESSION_SECRET: "replace-with-a-random-secret-at-least-32-characters",
      }),
    /SESSION_SECRET/,
  );
  assert.throws(
    () => runtimeConfig({ ...production(), DB_HOST: "" }),
    /DB_HOST/,
  );
  assert.throws(
    () => runtimeConfig({ ...production(), DB_NAME: "" }),
    /DB_NAME/,
  );
});
test("producción rechaza demo, Mongo local automático, puertos y proxies inválidos", () => {
  assert.throws(
    () => runtimeConfig({ ...production(), NODE_ENV: "prod" }),
    /NODE_ENV/,
  );
  assert.throws(() => runtimeConfig(production(), { demo: true }), /temporal/);
  assert.throws(
    () => runtimeConfig({ ...production(), LOCAL_MONGO_AUTOSTART: "true" }),
    /temporal/,
  );
  for (const PORT of ["bad", "-1", "0", "65536"])
    assert.throws(() => runtimeConfig({ ...production(), PORT }), /PORT/);
  for (const TRUST_PROXY of ["true", "-1", "1.5"])
    assert.throws(
      () => runtimeConfig({ ...production(), TRUST_PROXY }),
      /TRUST_PROXY/,
    );
});
test("el origen de Render viene del entorno y un dominio propio tiene prioridad", () => {
  const env = {
    ...production(),
    FRONTEND_URL: "",
    RENDER_EXTERNAL_URL: "https://service.onrender.com",
  };
  assert.equal(runtimeConfig(env).origin, env.RENDER_EXTERNAL_URL);
  assert.equal(
    runtimeConfig({ ...env, FRONTEND_URL: "https://bar.example/" }).origin,
    "https://bar.example",
  );
  assert.throws(
    () => runtimeConfig({ ...env, RENDER_EXTERNAL_URL: "" }),
    /FRONTEND_URL/,
  );
});
test("las contraseñas de prueba no son válidas para producción", () => {
  for (const password of [
    "12345678",
    "123456789012",
    "Taurus-demo-2026!",
    "aaaaaaaaaaaa",
    " strong-password-with-spaces ",
  ])
    assert.throws(() => assertProductionPassword(password));
  assert.doesNotThrow(() =>
    assertProductionPassword(production().ADMIN_PASSWORD),
  );
});
test("el primer despliegue no requiere credenciales de un admin en el entorno", () => {
  const env = production();
  delete env.ADMIN_USERNAME;
  delete env.ADMIN_PASSWORD;
  delete env.ADMIN_EMAIL;
  assert.equal(runtimeConfig(env).production, true);
});
