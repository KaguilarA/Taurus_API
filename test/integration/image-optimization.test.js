import { test } from "node:test";
import assert from "node:assert/strict";
import {
  optimizeTinyPng,
  tinifyOptions,
} from "../../services/image-optimization.js";
import {
  uploadOptimizedImage,
  MAX_IMAGE_BYTES,
} from "../../controllers/image/controller.js";
import { Problem } from "../../services/validation.js";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
const file = {
  buffer: Buffer.concat([png, Buffer.alloc(200)]),
  mimetype: "image/png",
  originalname: "menu.png",
  size: png.length + 200,
};
const env = {
  TINIFY_API_KEY: "test-tinify-key",
  TINIFY_API_URL: "https://api.tinify.com/shrink",
  CLOUDINARY_URL: "cloudinary://test-key:test-secret@fixture",
  CLOUDINARY_FOLDER: "fixture",
};
const compressed = () =>
  new Response("{}", {
    status: 201,
    headers: { Location: "https://api.tinify.com/output/test-image" },
  });

test("TinyPNG exige configuración HTTPS del entorno sin exponer credenciales", () => {
  for (const value of [
    {},
    { ...env, TINIFY_API_KEY: "" },
    { ...env, TINIFY_API_URL: "http://api.tinify.com/shrink" },
    { ...env, TINIFY_API_URL: "https://key:secret@api.tinify.com/shrink" },
  ])
    assert.throws(
      () => tinifyOptions(value),
      (error) =>
        error.status === 503 && !error.message.includes("test-tinify-key"),
    );
});

test("optimiza el buffer con TinyPNG y autentica ambas solicitudes sin enviar URLs del cliente", async () => {
  const calls = [];
  const result = await optimizeTinyPng(file, {
    env,
    request: async (url, options) => {
      calls.push(String(url));
      assert.equal(
        options.headers.Authorization,
        `Basic ${Buffer.from("api:test-tinify-key").toString("base64")}`,
      );
      assert.equal(options.redirect, "error");
      assert.ok(options.signal instanceof AbortSignal);
      if (options.method === "POST") {
        assert.deepEqual(options.body, file.buffer);
        return compressed();
      }
      return new Response(png);
    },
  });
  assert.deepEqual(calls, [
    env.TINIFY_API_URL,
    "https://api.tinify.com/output/test-image",
  ]);
  assert.deepEqual(result.buffer, png);
  assert.equal(result.mimetype, "image/png");
  assert.equal(result.originalname, file.originalname);
  assert.equal(result.size, png.length);
});

test("una imagen que ya pesa menos no aumenta de tamaño", async () => {
  const small = { ...file, buffer: png };
  let calls = 0;
  const result = await optimizeTinyPng(small, {
    env,
    request: async () =>
      ++calls === 1 ? compressed() : new Response(file.buffer),
  });
  assert.equal(result, small);
});

test("no filtra la API key a un host externo ni sigue redirects", async () => {
  let calls = 0;
  await assert.rejects(
    optimizeTinyPng(file, {
      env,
      request: async () => {
        calls++;
        return new Response("{}", {
          status: 201,
          headers: { Location: "https://unrelated.invalid/output/image" },
        });
      },
    }),
    (error) => error.status === 502,
  );
  assert.equal(calls, 1);
});

test("errores de autenticación, cupo y proveedor son seguros y no se omite la optimización", async () => {
  for (const [status, expected] of [
    [401, 503],
    [429, 503],
    [500, 502],
    [422, 422],
  ]) {
    await assert.rejects(
      optimizeTinyPng(file, {
        env,
        request: async () =>
          new Response("test-tinify-key private provider details", { status }),
      }),
      (error) =>
        error.status === expected &&
        !error.message.includes("test-tinify-key") &&
        !error.message.includes("private provider"),
    );
  }
  await assert.rejects(
    optimizeTinyPng(file, {
      env,
      request: async () => {
        throw new Error("test-tinify-key network error");
      },
    }),
    (error) =>
      error.status === 502 && !error.message.includes("test-tinify-key"),
  );
});

test("rechaza una respuesta corrupta y limita también el tamaño descargado sin Content-Length", async () => {
  for (const output of [
    Buffer.from("not an image"),
    Buffer.alloc(MAX_IMAGE_BYTES + 1),
  ]) {
    let calls = 0;
    await assert.rejects(
      optimizeTinyPng(file, {
        env,
        request: async () =>
          ++calls === 1 ? compressed() : new Response(output),
      }),
      (error) => error.status === 502,
    );
  }
});

test("Cloudinary recibe únicamente el buffer optimizado y la API informa el ahorro", async () => {
  const order = [];
  const result = await uploadOptimizedImage(file, "product", {
    env,
    optimizeImage: async (input) => {
      order.push("optimize");
      assert.equal(input, file);
      return { ...input, buffer: png };
    },
    uploadImage: async (input, purpose) => {
      order.push("upload");
      assert.deepEqual(input.buffer, png);
      assert.equal(purpose, "product");
      return {
        url: "https://res.cloudinary.com/fixture/image/upload/test.png",
      };
    },
  });
  assert.deepEqual(order, ["optimize", "upload"]);
  assert.deepEqual(result.optimization, {
    originalBytes: file.buffer.length,
    optimizedBytes: png.length,
    savedBytes: 200,
  });
});

test("si falta Cloudinary no consume TinyPNG; si falla TinyPNG no llama a Cloudinary", async () => {
  let calls = 0;
  await assert.rejects(
    uploadOptimizedImage(file, "product", {
      env: {},
      optimizeImage: async () => {
        calls++;
      },
    }),
    (error) => error.status === 503,
  );
  assert.equal(calls, 0);
  await assert.rejects(
    uploadOptimizedImage(file, "product", {
      env,
      optimizeImage: async () => {
        throw new Problem("Cupo agotado", 503);
      },
      uploadImage: async () => {
        calls++;
      },
    }),
    (error) => error.status === 503,
  );
  assert.equal(calls, 0);
});
