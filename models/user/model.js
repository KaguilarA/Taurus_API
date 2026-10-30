import { Schema } from "mongoose";
import StateData from "./../state/model.js";

const model = {
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  lastname: {
    type: String,
    required: true,
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
    required: true,
  },
};

const name = "User";

const hashedFields = ["password"];

export default { hashedFields, model, name };
