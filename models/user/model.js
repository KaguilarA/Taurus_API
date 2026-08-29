import { Schema } from "mongoose";
import { ModelName as StateModelName } from "./../state/model.js";

export const ModelName = "User";

export const EncryptedFields = ["password"];

export default {
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
    ref: StateModelName,
    required: true,
  },
};
