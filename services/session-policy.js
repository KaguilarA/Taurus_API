// Limits are enforced server-side; WebSocket polling never renews activity.
export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000;

export function sessionExpired(session, now = Date.now()) {
  if (!session?.userId) return false;
  return (
    (session.authenticatedAt !== undefined &&
      (!Number.isFinite(session.authenticatedAt) ||
        now - session.authenticatedAt >= SESSION_ABSOLUTE_MS)) ||
    (session.lastActivityAt !== undefined &&
      (!Number.isFinite(session.lastActivityAt) ||
        now - session.lastActivityAt >= SESSION_IDLE_MS))
  );
}

export function enforceSessionLifetime(req, res, next) {
  if (!req.session?.userId) return next();
  const now = Date.now();
  if (sessionExpired(req.session, now)) {
    return req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie("connect.sid");
      res
        .status(401)
        .json({ error: "Tu sesión venció. Iniciá sesión de nuevo." });
    });
  }
  // Existing sessions acquire limits on first use without deleting stored sessions.
  req.session.authenticatedAt ??= now;
  if (now - (req.session.lastActivityAt ?? 0) >= 60000)
    req.session.lastActivityAt = now;
  next();
}
