import { OwlTypes } from "owl-expressjs-utils";
import UserData from "../user/model.js";
import PermissionData from "../permission/model.js";

const model = {
  user: {
    type: OwlTypes.ObjectId,
    ref: UserData.name,
    required: true,
    index: true,
  },
  permission: {
    type: OwlTypes.ObjectId,
    ref: PermissionData.name,
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

const name = "ActionLog";

export default { model, name };
export const ModelName = name;
