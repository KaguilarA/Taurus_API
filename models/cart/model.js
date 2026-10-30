import { OwlTypes } from "owl-expressjs-utils";
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
    type: OwlTypes.ObjectId,
    ref: UserData.name,
  },
  state: {
    type: OwlTypes.ObjectId,
    ref: StateData.name,
    required() {
      return !this.token;
    },
  },
};
const name = "Cart";

const indexes = [
  {
    fields: { tableId: 1 },
    options: {
      unique: true,
      partialFilterExpression: { status: "open", tableId: { $type: "string" } },
    },
  },
];

export default { model, name, indexes };

export const ModelName = name;
