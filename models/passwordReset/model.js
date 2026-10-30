import { Schema } from "mongoose";
const model = {
  _id: String,
  accountId: Schema.Types.ObjectId,
  accountVersion: { type: Number, default: 0 },
  state: {
    type: String,
    enum: ["pending", "approved", "rejected", "used"],
    default: "pending",
  },
  expiresAt: { type: Date, index: { expires: 0 } },
  approvedBy: String,
};
export const ModelName = "PasswordReset";
export default { name: ModelName, model };
