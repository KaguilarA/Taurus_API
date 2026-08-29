import { Schema } from "mongoose";
import { ModelName as UserModelName } from "./../user/model.js";
import { ModelName as PermissionModelName } from "./../permission/model.js";

export const ModelName = "UserPermission";

export default {
  user: {
    type: Schema.Types.ObjectId,
    ref: UserModelName,
    required: true,
  },
  permission: {
    type: Schema.Types.ObjectId,
    ref: PermissionModelName,
    required: true,
  },
};