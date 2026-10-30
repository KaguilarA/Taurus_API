import { OwlTypes } from "owl-expressjs-utils";
import UserData from "../user/model.js";
import PermissionData from "../permission/model.js";

const model = {
  user: {
    type: OwlTypes.ObjectId,
    ref: UserData.name,
    required: true,
  },
  permission: {
    type: OwlTypes.ObjectId,
    ref: PermissionData.name,
    required: true,
  },
};
const name = "UserPermission";

export default { model, name };
export const ModelName = name;
