import { Problem } from "./validation.js";
import { MAX_IMAGE_BYTES, validateImage } from "./image-validation.js";

export function tinifyOptions(env = process.env) {
  try {
    const endpoint = new URL(env.TINIFY_API_URL);
    if (
      endpoint.protocol !== "https:" ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash ||
      !env.TINIFY_API_KEY?.trim()
    )
      throw new Error();
    return {
      endpoint,
      authorization: `Basic ${Buffer.from(`api:${env.TINIFY_API_KEY.trim()}`).toString("base64")}`,
    };
  } catch {
    throw new Problem(
      "Configurá TinyPNG en el entorno del backend para optimizar las imágenes.",
      503,
    );
  }
}

async function imageBuffer(response) {
  if (
    !response.body ||
    Number(response.headers.get("content-length")) > MAX_IMAGE_BYTES
  ) {
    await response.body?.cancel();
    throw new Problem("TinyPNG devolvió una imagen inválida.", 502);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > MAX_IMAGE_BYTES) {
        await reader.cancel();
        throw new Problem("TinyPNG devolvió una imagen demasiado grande.", 502);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, bytes);
}

export async function optimizeTinyPng(
  file,
  { env = process.env, request = fetch } = {},
) {
  validateImage(file);
  const { endpoint, authorization } = tinifyOptions(env);
  const headers = { Authorization: authorization };
  try {
    const compressed = await request(endpoint, {
      method: "POST",
      headers: { ...headers, "Content-Type": file.mimetype },
      body: file.buffer,
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
    const location = compressed.headers.get("location");
    await compressed.body?.cancel();
    if ([401, 403].includes(compressed.status))
      throw new Problem(
        "La configuración de TinyPNG no permite optimizar imágenes. Revisá su API key.",
        503,
      );
    if (compressed.status === 429)
      throw new Problem(
        "Se alcanzó el límite de optimizaciones de TinyPNG. Intentá más tarde.",
        503,
      );
    if (compressed.status === 415 || compressed.status === 422)
      throw new Problem(
        "TinyPNG no pudo procesar esta imagen. Probá con otro archivo.",
        422,
      );
    if (compressed.status !== 201)
      throw new Problem(
        "No se pudo optimizar la imagen con TinyPNG. Intentá de nuevo.",
        502,
      );
    if (!location) throw new Error();
    const output = new URL(location);
    // Never forward the API key to redirects or an unrelated host.
    if (
      output.origin !== endpoint.origin ||
      output.username ||
      output.password ||
      !output.pathname.startsWith("/output/")
    )
      throw new Error();
    const response = await request(output, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error();
    }
    const buffer = await imageBuffer(response);
    try {
      validateImage({ ...file, buffer });
    } catch {
      throw new Problem(
        "TinyPNG devolvió un archivo que no es una imagen válida.",
        502,
      );
    }
    // Already optimized files must never become heavier after the round trip.
    return buffer.length < file.buffer.length
      ? { ...file, buffer, size: buffer.length }
      : file;
  } catch (error) {
    if (error instanceof Problem) throw error;
    throw new Problem(
      "No se pudo optimizar la imagen con TinyPNG. Intentá de nuevo.",
      502,
    );
  }
}
