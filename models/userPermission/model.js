import { Schema } from "mongoose";
import UserData from "./../user/model.js";
import PermissionData from "./../permission/model.js";

const model = {
  user: {
    type: Schema.Types.ObjectId,
    ref: UserData.name,
    required: true,
  },
  permission: {
    type: Schema.Types.ObjectId,
    ref: PermissionData.name,
    required: true,
  },
};
const name = "UserPermission";

export default { model, name };