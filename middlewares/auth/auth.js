import { UserModel } from "../../models/models.js";

import { Problem } from "../../services/validation.js";
export async function authenticateAccount(req, res, next) {
  req.account = await UserModel.getById(req.session.userId);
  if (
    !req.account ||
    (req.session.userVersion ?? 0) !== (req.account.sessionVersion ?? 0)
  )
    throw new Problem("Iniciá sesión de nuevo.", 401);
  next();
}
