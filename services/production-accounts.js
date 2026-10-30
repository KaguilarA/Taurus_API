import { UserModel } from "../models/models.js";

import {
  assertProductionPassword,
  ConfigurationError,
} from "../config/runtime.js";

export async function assertProductionAccounts() {
  const accounts = await UserModel.getByCoincidence(
    {},
    { select: "_id", lean: true },
  );
  for (const account of accounts) {
    for (const password of [
      "12345678",
      "87654321",
      ...(process.env.LEGACY_PASSWORD_DENYLIST?.split(",").filter(Boolean) ??
        []),
    ]) {
      if (
        await UserModel.compareHash(String(account._id), "password", password)
      )
        throw new ConfigurationError(
          "Hay cuentas con contraseñas de prueba. Rotá sus claves antes de iniciar producción; usá el comando account:password.",
        );
    }
  }
}
export async function rotatePassword(username, password) {
  assertProductionPassword(password);
  const account = await UserModel.updateWhere(
    { username: String(username).toLowerCase() },
    { $set: { password }, $inc: { sessionVersion: 1 } },
    { new: true, runValidators: true },
  );
  if (!account) throw new ConfigurationError("El usuario indicado no existe.");
  return account.username;
}
