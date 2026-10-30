import { Schema } from "mongoose";
import StateData from "../state/model.js";
import UserData from "../user/model.js";

const model = {
  ...{
    tableId: { type: String },
    label: String,
    token: { type: String, unique: true, sparse: true },
    status: { type: String, enum: ["open", "paid"], default: "open" },
    total: { type: Number, default: 0 },
    revision: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: ["cash", "sinpe", "card"] },
    paymentReference: String,
    receivedBy: String,
    paidAt: Date,
  },

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
    required() {
      return !this.token;
    },
  },
};
const name = "Cart";

export default { model, name };

export const ModelName = name;
