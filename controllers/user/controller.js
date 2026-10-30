export default function ({
  entityId,
  userModel,
  permissionModel,
  userPermissionModel,
  populatedFields,
}) {
  /**
   * Return the authenticated user's own account, populated with `populatedFields`.
   * @param {import('express').Request} req - Express request containing the user session.
   * @param {import('express').Response} res - Express response.
   * @returns {Promise<void>} Sends the user document or an error response.
   */
  async function getInfo(req, res) {
    try {
      if (!req.session.userId) {
        return res.status(404).json({
          message: `${entityId} not found.`,
        });
      }

      const userData = await userModel.getById(req.session.userId, {
        populate: populatedFields,
      });

      if (!userData) {
        return res.status(404).json({ message: `${entityId} not found.` });
      }

      return res.json(userData);
    } catch (error) {
      res.status(500).json({
        message: `${entityId} list error.`,
        error: error.message || error,
      });
    }
  }

  async function getAll(req, res) {
    try {
      const users = await userModel.getAll();
      return res.json(users);
    } catch (error) {
      return res.status(500).json({
        message: `${entityId} list error.`,
        error: error.message || error,
      });
    }
  }

  async function getById(req, res) {
    try {
      const userData = await userModel.getById(req.params.id);
      if (!userData)
        return res.status(404).json({ message: `${entityId} not found.` });

      return res.json(userData);
    } catch (error) {
      return res.status(500).json({
        message: `${entityId} search error.`,
        error: error.message || error,
      });
    }
  }

  async function getPermissions(req, res) {
    try {
      const assignments = await userPermissionModel.getByCoincidence(
        { user: req.params.id },
        { populate: "permission" },
      );

      return res.json(assignments);
    } catch (error) {
      return res.status(500).json({
        message: "User permissions list error.",
        error: error.message || error,
      });
    }
  }

  async function updatePermissions(req, res) {
    try {
      const permissionIds = Array.isArray(req.body.permissionIds)
        ? req.body.permissionIds
        : [];
      const currentAssignments = await userPermissionModel.getByCoincidence({
        user: req.params.id,
      });
      const currentByPermission = new Map(
        currentAssignments.map((assignment) => [
          String(assignment.permission),
          assignment,
        ]),
      );
      const requestedIds = new Set(permissionIds.map(String));

      await Promise.all(
        currentAssignments
          .filter(
            (assignment) => !requestedIds.has(String(assignment.permission)),
          )
          .map((assignment) => userPermissionModel.delete(assignment._id)),
      );

      await Promise.all(
        permissionIds
          .filter(
            (permissionId) => !currentByPermission.has(String(permissionId)),
          )
          .map((permissionId) =>
            userPermissionModel.save({
              user: req.params.id,
              permission: permissionId,
            }),
          ),
      );

      return getPermissions(req, res);
    } catch (error) {
      return res.status(400).json({
        message: "User permissions update error.",
        error: error.message || error,
      });
    }
  }

  /**
   * Create a new user document.
   * @param {import('express').Request} req - Express request containing the new user data.
   * @param {import('express').Response} res - Express response.
   * @returns {Promise<void>} Sends the created user or an error response.
   */
  async function register(req, res) {
    try {
      const newUser = await userModel.save(req.body);

      if (permissionModel && userPermissionModel) {
        const allPermissions = await permissionModel.getAll();
        const permissions = (
          Array.isArray(allPermissions) ? allPermissions : []
        ).filter(({ name }) => !/^user:/.test(name));

        if (permissions.length > 0) {
          await Promise.all(
            permissions.map(({ _id }) =>
              userPermissionModel.save({
                user: newUser._id,
                permission: _id,
              }),
            ),
          );
        }
      }

      res.status(201).json(newUser);
    } catch (error) {
      res.status(400).json({
        message: `${entityId} register error.`,
        error: error.message,
      });
    }
  }

  /**
   * Update the authenticated user's own account.
   * @param {import('express').Request} req - Express request containing the user session and updated data.
   * @param {import('express').Response} res - Express response.
   * @returns {Promise<void>} Sends the updated user or an error response.
   */
  const update = async (req, res) => {
    try {
      const updatedData = await userModel.update(req.session.userId, req.body, {
        populate: populatedFields,
      });

      if (!updatedData) {
        res.status(404).json({ message: `${entityId} not found.` });
        return;
      }

      res.json(updatedData);
    } catch (error) {
      res.status(500).json({
        message: `${entityId} error update.`,
        error: error.message || error,
      });
    }
  };

  return {
    getInfo,
    getAll,
    getById,
    getPermissions,
    updatePermissions,
    register,
    update,
  };
}
