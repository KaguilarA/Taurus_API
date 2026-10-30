import { randomUUID } from "node:crypto";

import { v2 as cloudinary } from "cloudinary";

import { Problem } from "../../services/validation.js";
import {
  MAX_IMAGE_BYTES,
  validateImage,
} from "../../services/image-validation.js";
import { optimizeTinyPng } from "../../services/image-optimization.js";
export {
  MAX_IMAGE_BYTES,
  validateImage,
} from "../../services/image-validation.js";

export function cloudinaryOptions(env = process.env) {
  let cloud_name = env.CLOUDINARY_CLOUD_NAME;
  let api_key = env.CLOUDINARY_API_KEY;
  let api_secret = env.CLOUDINARY_API_SECRET;
  if (env.CLOUDINARY_URL) {
    try {
      const url = new URL(env.CLOUDINARY_URL);
      if (url.protocol !== "cloudinary:") throw new Error();
      cloud_name = url.hostname;
      api_key = decodeURIComponent(url.username);
      api_secret = decodeURIComponent(url.password);
    } catch {
      throw new Problem(
        "Cloudinary no está configurado correctamente en el servidor.",
        503,
      );
    }
  }
  const folder = env.CLOUDINARY_FOLDER;
  if (
    !cloud_name ||
    !api_key ||
    !api_secret ||
    !folder ||
    !/^[a-zA-Z0-9/_-]+$/.test(folder)
  )
    throw new Problem(
      "Configurá las credenciales de Cloudinary en el entorno del backend.",
      503,
    );
  return { cloud_name, api_key, api_secret, folder, secure: true };
}
export async function uploadCloudinaryImage(
  file,
  purpose,
  { env = process.env } = {},
) {
  const options = cloudinaryOptions(env);
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        ...options,
        folder: `${options.folder}/${purpose}`,
        public_id: randomUUID(),
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        overwrite: false,
        timeout: 60000,
      },
      (error, result) => {
        if (error && [401, 403].includes(error.http_code))
          return reject(
            new Problem(
              "Cloudinary rechazó la configuración del servidor. Revisá que CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET pertenezcan al mismo entorno.",
              503,
            ),
          );
        if (error || !result?.secure_url?.startsWith("https://"))
          return reject(
            new Problem("No se pudo subir la imagen. Intentá de nuevo.", 502),
          );
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
        });
      },
    );
    stream.on("error", () =>
      reject(new Problem("No se pudo subir la imagen. Intentá de nuevo.", 502)),
    );
    stream.end(file.buffer);
  });
}
export async function uploadOptimizedImage(
  file,
  purpose,
  {
    env = process.env,
    optimizeImage = optimizeTinyPng,
    uploadImage = uploadCloudinaryImage,
  } = {},
) {
  // Check destination before spending a TinyPNG compression on an impossible upload.
  cloudinaryOptions(env);
  const optimized = await optimizeImage(file, { env });
  validateImage(optimized);
  const result = await uploadImage(optimized, purpose, { env });
  return {
    ...result,
    optimization: {
      originalBytes: file.buffer.length,
      optimizedBytes: optimized.buffer.length,
      savedBytes: file.buffer.length - optimized.buffer.length,
    },
  };
}

export function createImageController({
  production,
  origin,
  uploadImage = uploadOptimizedImage,
} = {}) {
  const upload = async (req, res) => {
    validateImage(req.file);
    res.status(201).json(await uploadImage(req.file, req.query.purpose));
  };
  return { upload };
}

export default createImageController;
