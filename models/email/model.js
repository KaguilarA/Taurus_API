import { Schema } from "mongoose";
import { ModelName as BusinessModelName } from "./../business/model.js";
import { ModelName as StateModelName } from "./../state/model.js";
import { ModelName as UserModelName } from "./../user/model.js";

const ownerTypes = [BusinessModelName, UserModelName];

export const ModelName = "Email";

export default {
  email: {
    type: String,
    required: [true, "El correo electrónico es obligatorio."],
    unique: true,
    trim: true,
    lowercase: true,
    match: [
      /^\S+@\S+\.\S+$/,
      "El formato del correo electrónico no es válido.",
    ],
  },
  ownerType: {
    type: String,
    required: true,
    enum: ownerTypes,
  },
  owner: {
    type: Schema.Types.ObjectId,
    required: true,
    refPath: "ownerType",
    index: true,
  },
  state: {
    type: Schema.Types.ObjectId,
    ref: StateModelName,
    required: true,
  },
};
