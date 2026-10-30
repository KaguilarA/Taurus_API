export const maintenance = (enabled) => (req, res, next) => {
  if (!enabled || ["/health", "/ready", "/deployment"].includes(req.path))
    return next();
  res.set("Retry-After", "60");
  return res.status(503).json({
    error: "Estamos actualizando el sistema. Intentá de nuevo en unos minutos.",
  });
};
