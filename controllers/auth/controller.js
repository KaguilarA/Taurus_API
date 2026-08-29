/**
 * Controller for credential-based login, logout, and session status.
 *
 * @class AuthController
 * @property {import('owl-expressjs-utils').OwlModel} userModel - User data-access model.
 * @property {import('owl-expressjs-utils').OwlModel} emailModel - Email data-access model.
 */
export default function ({ userModel, userModelName, emailModel }) {
  /**
   * Validate credentials and start a session for the matching user.
   * @param {import('express').Request} req Express request containing `email` and `password`.
   * @param {import('express').Response} res Express response.
   * @returns {Promise<void>} Sends the authenticated user or an error response.
   */
  async function logIn(req, res) {
    try {
      const { email: emailInput, password } = req.body;

      if (!emailInput || !password) {
        return res
          .status(400)
          .json({ error: "El correo y la contraseña son obligatorios." });
      }
      const emailDoc = await emailModel.getOne({
        email: emailInput.trim().toLowerCase(),
        ownerType: userModelName,
      });

      if (!emailDoc) {
        return res.status(401).json({ error: "Credenciales inválidas." });
      }

      const user = await userModel.getById(emailDoc.owner);

      if (!user) {
        return res.status(401).json({ error: "Credenciales inválidas." });
      }

      const isMatch = await userModel.compareHash(
        user._id,
        "password",
        password,
      );

      if (!isMatch) {
        return res.status(401).json({ error: "Credenciales inválidas." });
      }

      req.session.userId = user._id;

      req.session.save((err) => {
        if (err) {
          console.error("Error guardando la sesión:", err);
          return res.status(500).json({ error: "Error interno del servidor." });
        }

        return res
          .status(200)
          .json({ message: "Inicio de sesión exitoso", user: user.toJSON() });
      });
    } catch (error) {
      console.error("Error en login:", error);
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  }

  /**
   * Destroy the current session and clear the session cookie.
   * @param {import('express').Request} req Express request holding the session to destroy.
   * @param {import('express').Response} res Express response.
   * @returns {void}
   */
  function logout(req, res) {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "No se pudo cerrar la sesión." });
      }
      res.clearCookie("connect.sid");
      return res.status(200).json({ message: "Sesión cerrada exitosamente" });
    });
  }

  /**
   * Report whether the current request is authenticated.
   * @param {import('express').Request} req - Express request holding the session and/or authenticated user.
   * @param {import('express').Response} res - Express response.
   * @returns {void}
   */
  function status(req, res) {
    const user = req.user || null;

    if (req.session?.userId || user) {
      return res.status(200).json({
        authenticated: true,
        user: user ? (user.toJSON ? user.toJSON() : user) : undefined,
      });
    }

    return res.status(200).json({ authenticated: false });
  }

  return {
    logIn,
    logout,
    status,
  };
}
