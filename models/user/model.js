import { Schema } from "mongoose";
import StateData from "../state/model.js";

const model = {
  ...{
    email: { type: String, unique: true, sparse: true },
    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    name: String,
    sessionVersion: { type: Number, default: 0 },
    role: {
      type: String,
      enum: ["admin", "kitchen", "waiter"],
      default: "waiter",
    },
  },

  name: {
    type: String,
    default() {
      return this.username || this.email?.split("@")[0];
    },
    required: true,
    trim: true,
    maxlength: 100,
  },
  lastname: {
    type: String,
    required() {
      return !this.username && !this.email;
    },
    trim: true,
    maxlength: 100,
  },
  password: {
    type: String,
    required: true,
  },
  state: {
    type: Schema.Types.ObjectId,
    ref: StateData.name,
    required() {
      return !this.username && !this.email;
    },
  },
};

const name = "User";

const hashedFields = ["password"];

export default { hashedFields, model, name };

export const ModelName = name;
