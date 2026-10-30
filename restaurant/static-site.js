import express from "express";
import { existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { ConfigurationError } from "./config.js";

export function serveFrontend(app, directory) {
  const index = resolve(directory, "index.html");
  if (!existsSync(index))
    throw new ConfigurationError(
      "FRONTEND_DIST no contiene index.html. Generá el paquete de producción.",
    );
  app.use(
    express.static(directory, {
      index: false,
      dotfiles: "deny",
      setHeaders(res, filename) {
        const immutable = /(?:main|styles|chunk)-[\w-]+\.(?:js|css)$/.test(
          filename,
        );
        res.set(
          "Cache-Control",
          immutable ? "public, max-age=31536000, immutable" : "no-cache",
        );
      },
    }),
  );
  app.get("/{*path}", (req, res, next) => {
    // Missing API endpoints/assets must never return the Angular HTML document.
    if (
      req.path === "/api" ||
      req.path.startsWith("/api/") ||
      extname(req.path) ||
      req.path.split("/").some((part) => part.startsWith(".")) ||
      /^\/(?:images|fonts|icons|assets)(?:\/|$)/.test(req.path)
    )
      return next();
    res.set("Cache-Control", "no-store").sendFile(index);
  });
}
