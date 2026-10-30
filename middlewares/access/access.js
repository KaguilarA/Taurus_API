export const allow =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.account.role ?? "admin")
      ? next()
      : res.status(403).json({ error: "Tu rol no permite esta operación." });
