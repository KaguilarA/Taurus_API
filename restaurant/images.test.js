import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { Writable } from "node:stream";
import { v2 as cloudinary } from "cloudinary";
import {
  cloudinaryOptions,
  registerImageUploads,
  uploadCloudinaryImage,
  MAX_IMAGE_BYTES,
} from "./images.js";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
function fixture(uploadImage) {
  const app = express();
  app.use((req, res, next) => {
    if (!req.get("X-Test-Role")) return res.sendStatus(401);
    req.account = { role: req.get("X-Test-Role") };
    next();
  });
  registerImageUploads(app, { uploadImage });
  app.use((error, req, res, next) =>
    res.status(error.status || 500).json({ error: error.message }),
  );
  return app;
}

test("la subida de imágenes exige administrador y un destino conocido", async () => {
  const app = fixture(() => {
    throw new Error("No debe subir archivos");
  });
  await request(app).post("/api/admin/images?purpose=product").expect(401);
  for (const role of ["waiter", "kitchen"])
    await request(app)
      .post("/api/admin/images?purpose=product")
      .set("X-Test-Role", role)
      .expect(403);
  await request(app)
    .post("/api/admin/images?purpose=../../private")
    .set("X-Test-Role", "admin")
    .expect(400);
});

test("un archivo multipart válido llega al servicio y devuelve su URL HTTPS", async () => {
  let calls = 0;
  const app = fixture(async (file, purpose) => {
    calls++;
    assert.equal(purpose, "event");
    assert.deepEqual(file.buffer, png);
    return {
      url: "https://res.cloudinary.com/fixture/image/upload/test.png",
      publicId: "fixture/test",
    };
  });
  const result = await request(app)
    .post("/api/admin/images?purpose=event")
    .set("X-Test-Role", "admin")
    .attach("image", png, { filename: "poster.png", contentType: "image/png" })
    .expect(201);
  assert.match(result.body.url, /^https:/);
  assert.equal(calls, 1);
});

test("rechaza firmas falsas, SVG, campos extra y archivos mayores a 5 MB antes de subir", async () => {
  const app = fixture(() => {
    throw new Error("No debe llamar a Cloudinary");
  });
  const upload = () =>
    request(app)
      .post("/api/admin/images?purpose=product")
      .set("X-Test-Role", "admin");
  await upload()
    .attach("image", Buffer.from("not an image"), {
      filename: "fake.png",
      contentType: "image/png",
    })
    .expect(400);
  await upload()
    .attach("image", Buffer.from("<svg/>"), {
      filename: "x.svg",
      contentType: "image/svg+xml",
    })
    .expect(400);
  await upload()
    .attach("image", Buffer.alloc(MAX_IMAGE_BYTES + 1), {
      filename: "large.png",
      contentType: "image/png",
    })
    .expect(413);
  await upload()
    .field("folder", "../../private")
    .attach("image", png, "test.png")
    .expect(400);
  await upload()
    .attach("image", png, "a.png")
    .attach("image", png, "b.png")
    .expect(400);
  await upload().expect(400);
});

test("la configuración proviene del entorno y los errores no exponen secretos", () => {
  const result = cloudinaryOptions({
    CLOUDINARY_URL: "cloudinary://test-key:test-secret@sample",
    CLOUDINARY_FOLDER: "felos/menu",
  });
  assert.equal(result.cloud_name, "sample");
  assert.equal(result.api_secret, "test-secret");
  for (const env of [
    {},
    { CLOUDINARY_URL: "https://key:secret@invalid" },
    {
      CLOUDINARY_CLOUD_NAME: "sample",
      CLOUDINARY_API_KEY: "key",
      CLOUDINARY_API_SECRET: "secret",
      CLOUDINARY_FOLDER: "../private",
    },
  ])
    assert.throws(
      () => cloudinaryOptions(env),
      (error) => error.status === 503 && !error.message.includes("test-secret"),
    );
});

test("el backend usa upload_stream firmado sin devolver credenciales al navegador", async () => {
  const previous = cloudinary.uploader.upload_stream;
  const original = process.env.CLOUDINARY_URL;
  const originalFolder = process.env.CLOUDINARY_FOLDER;
  process.env.CLOUDINARY_FOLDER = "fixture";
  process.env.CLOUDINARY_URL = "cloudinary://fixture-key:fixture-secret@sample";
  try {
    cloudinary.uploader.upload_stream = (options, done) => {
      assert.equal(options.api_secret, "fixture-secret");
      assert.equal(options.resource_type, "image");
      assert.match(options.folder, /\/product$/);
      assert.equal(options.overwrite, false);
      return new Writable({
        write(chunk, encoding, next) {
          assert.deepEqual(chunk, png);
          next();
        },
        final(next) {
          done(null, {
            secure_url:
              "https://res.cloudinary.com/sample/image/upload/fixture.png",
            public_id: "fixture",
            width: 1,
            height: 1,
            api_key: "fixture-key",
            signature: "private",
          });
          next();
        },
      });
    };
    const result = await uploadCloudinaryImage({ buffer: png }, "product");
    assert.deepEqual(Object.keys(result).sort(), [
      "height",
      "publicId",
      "url",
      "width",
    ]);
  } finally {
    cloudinary.uploader.upload_stream = previous;
    if (originalFolder === undefined) delete process.env.CLOUDINARY_FOLDER;
    else process.env.CLOUDINARY_FOLDER = originalFolder;
    if (original === undefined) delete process.env.CLOUDINARY_URL;
    else process.env.CLOUDINARY_URL = original;
  }
});
