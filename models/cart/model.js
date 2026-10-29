import { Schema } from "mongoose";
import StateData from "./../state/model.js";
import UserData from "./../user/model.js";

const model = {
  name: {
    type: String,
    default: "Cuenta",
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: UserData.name,
  },
  state: {
    type: Schema.Types.ObjectId,
    ref: StateData.name,
    required: true,
  },
};
const name = "Cart";

export default { model, name };
