import { Schema } from "mongoose";
import { ModelName as UserModelName } from "./../user/model.js";
import { ModelName as PermissionModelName } from "./../permission/model.js";

/** Registered Mongoose model name. */
export const ModelName = "ActionLog";

/** Schema definition for audit records created by action-log middleware. */
export default {
  user: {
    type: Schema.Types.ObjectId,
    ref: UserModelName,
    required: true,
    index: true,
  },
  permission: {
    type: Schema.Types.ObjectId,
    ref: PermissionModelName,
    required: true,
    index: true,
  },
  action: {
    type: String,
    required: [true, "La acción es obligatoria."],
    trim: true,
  },
  metadata: {
    type: Object,
    default: {},
  },
};