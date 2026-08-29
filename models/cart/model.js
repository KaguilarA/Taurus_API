import { Schema } from "mongoose";
import { ModelName as StateModelName } from "./../state/model.js";
import { ModelName as UserModelName } from "./../user/model.js";

export const ModelName = "Cart";

export default {
  name: {
    type: String,
    default: "Cuenta",
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: UserModelName,
  },
  state: {
    type: Schema.Types.ObjectId,
    ref: StateModelName,
    required: true,
  },
};
