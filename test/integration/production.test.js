import {
  OwlSession,
  OwlMongoConnect,
  OwlMongoClose,
} from "owl-expressjs-utils";
import {
  UserModel,
  EventModel,
  registeredModels,
} from "../../models/models.js";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";

import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createApp } from "../../app.js";
import { seed } from "../fixtures/seed.js";

import {
  rotatePassword,
  assertProductionAccounts,
} from "../../services/production-accounts.js";

let replica, app, directory, store, cookie;
const secret = "production-fixture-session-secret-longer-than-32-characters";
const origin = "https://felos.example";
const password = "Strong-owner-password-2026!";
before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replica.getUri("production-fixture");
  await OwlMongoConnect(uri);
  await seed({ username: "owner", email: "owner@accounts.local", password });
  await Promise.all(registeredModels.map((model) => model.initialize()));
  directory = await mkdtemp(join(tmpdir(), "felos-static-"));
  await writeFile(
    join(directory, "index.html"),
    "<!doctype html><html><body>Felos production fixture</body></html>",
  );
  await writeFile(
    join(directory, "main-ABC123.js"),
    'console.log("production");',
  );
  const sessions = OwlSession(secret, "production", "production-fixture", uri);
  app = createApp({
    origin,
    uri,
    secret,
    uploadImage: async (file, purpose) => {
      assert.equal(file.mimetype, "image/png");
      assert.equal(purpose, "branding");
      return {
        url: "https://res.cloudinary.com/fixture/image/upload/verified.png",
      };
    },
    frontendDist: directory,
    production: true,
    trustProxy: 1,
    sessionMiddleware(req, res, next) {
      sessions(req, res, (error) => {
        store = req.sessionStore;
        next(error);
      });
    },
  });
});
after(async () => {
  if (store) await store.close();
  await OwlMongoClose();
  if (replica) await replica.stop();
  if (directory) {
    const target = await realpath(directory);
    assert.equal(dirname(target), await realpath(tmpdir()));
    assert.ok(basename(target).startsWith("felos-static-"));
    await rm(target, { recursive: true, force: true });
  }
});
test("el paquete sirve Angular, sus rutas y assets sin convertir errores de API en HTML", async () => {
  for (const path of ["/", "/admin", "/some-angular-route"]) {
    const response = await request(app).get(path).expect(200);
    assert.match(response.text, /Felos production fixture/);
    assert.equal(response.headers["cache-control"], "no-store");
  }
  const asset = await request(app).get("/main-ABC123.js").expect(200);
  assert.match(asset.headers["cache-control"], /immutable/);
  assert.match(
    asset.headers["content-security-policy"],
    /wss:\/\/felos\.example/,
  );
  await request(app).get("/missing.js").expect(404);
  const missing = await request(app).get("/api/not-found").expect(404);
  assert.match(missing.headers["content-type"], /application\/json/);
  await request(app).get("/.env").expect(404);
  assert.equal(asset.headers["x-powered-by"], undefined);
});
test("la sesión real de OWL emite cookie Secure detrás del proxy HTTPS", async () => {
  const result = await request(app)
    .post("/api/auth/login")
    .set("Origin", origin)
    .set("X-Forwarded-Proto", "https")
    .send({ username: "owner", password })
    .expect(200);
  const header = result.headers["set-cookie"][0];
  assert.match(header, /Secure/);
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
  cookie = header.split(";")[0];
  await request(app).get("/api/admin/state").set("Cookie", cookie).expect(200);
  await request(app)
    .post("/api/admin/accounts")
    .set("Cookie", cookie)
    .set("X-Forwarded-Proto", "https")
    .send({ username: "short-pass", role: "waiter", password: "12345678" })
    .expect(400);
  await request(app)
    .post("/api/auth/login")
    .set("Origin", "https://another.example")
    .send({ username: "owner", password })
    .expect(403);
});
test("la subida multipart atraviesa el router real y la sesión OWL detrás de HTTPS", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  const response = await request(app)
    .post("/api/admin/images?purpose=branding")
    .set("Origin", origin)
    .set("X-Forwarded-Proto", "https")
    .set("Cookie", cookie)
    .attach("image", png, { filename: "hero.png", contentType: "image/png" })
    .expect(201);
  assert.equal(
    response.body.url,
    "https://res.cloudinary.com/fixture/image/upload/verified.png",
  );
});

test("readiness detecta drenaje y los eventos de muestra no se anuncian en producción", async () => {
  await request(app).get("/api/ready").expect(200);
  app.locals.draining = true;
  await request(app).get("/api/ready").expect(503);
  app.locals.draining = false;
  await EventModel.save({ title: "Muestra", active: true, isSample: true });
  const publicState = await request(app).get("/api/public").expect(200);
  assert.equal(publicState.body.events.length, 0);
  await assertProductionAccounts();
});
test("rotar la contraseña invalida sesiones previas y conserva hashing", async () => {
  await rotatePassword("owner", "Another-strong-password-2026!");
  await request(app).get("/api/admin/state").set("Cookie", cookie).expect(401);
  const account = await UserModel.getOne({ username: "owner" });
  assert.equal(
    await UserModel.compareHash(
      String(account._id),
      "password",
      "Another-strong-password-2026!",
    ),
    true,
  );
  const status = await request(app)
    .get("/api/auth/status")
    .set("Cookie", cookie)
    .expect(200);
  assert.equal(status.body.authenticated, false);
  await request(app)
    .post("/api/auth/login")
    .set("X-Forwarded-Proto", "https")
    .send({ username: "owner", password: "Another-strong-password-2026!" })
    .expect(200);
  await UserModel.save({
    username: "test-user",
    email: "test@accounts.local",
    password: "12345678",
    role: "waiter",
  });
  await assert.rejects(assertProductionAccounts, /contraseñas de prueba/);
});
