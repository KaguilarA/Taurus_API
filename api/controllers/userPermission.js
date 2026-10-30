import BaseController from "../../utils/baseController.js";

export default class extends BaseController {
  constructor(models) {
    super(models.userPermissionModel);
    this.userModel = models.userModel;
    this.permissionModel = models.permissionModel;
  }

  grant = async (req, res) => {
    try {
      const { userId, permissionId } = req.params;
      const [user, permission] = await Promise.all([
        this.userModel.findById(userId),
        this.permissionModel.findById(permissionId),
      ]);

      if (!user || !permission) {
        return res.status(404).json({ message: "User or permission not found" });
      }

      const assignment = await this.model.findOneAndUpdate(
        { user: userId, permission: permissionId },
        {
          $set: {
            grantedBy: req.user._id,
            grantedAt: new Date(),
          },
          $unset: { revokedBy: 1, revokedAt: 1 },
        },
        { new: true, upsert: true, runValidators: true }
      );

      req.auditAction = "PERMISSION_GRANTED";
      req.auditResourceType = "UserPermission";
      req.auditResourceId = assignment._id;
      req.auditMetadata = { userId, permissionId };

      res.status(200).json(assignment);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  };

  revoke = async (req, res) => {
    try {
      const { userId, permissionId } = req.params;
      const assignment = await this.model.findOneAndUpdate(
        { user: userId, permission: permissionId, revokedAt: { $exists: false } },
        { $set: { revokedBy: req.user._id, revokedAt: new Date() } },
        { new: true }
      );

      if (!assignment) {
        return res.status(404).json({ message: "Active permission not found" });
      }

      req.auditAction = "PERMISSION_REVOKED";
      req.auditResourceType = "UserPermission";
      req.auditResourceId = assignment._id;
      req.auditMetadata = { userId, permissionId };

      res.status(200).json(assignment);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  };

  list = async (req, res) => {
    try {
      const assignments = await this.model
        .find({ user: req.params.userId, revokedAt: { $exists: false } })
        .populate("permission", "name description")
        .lean();
      res.status(200).json(assignments);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };
}