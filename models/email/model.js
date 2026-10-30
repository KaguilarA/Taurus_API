import { OwlTypes } from "owl-expressjs-utils";
import BusinessData from "../business/model.js";
import StateData from "../state/model.js";
import UserData from "../user/model.js";

const ownerTypes = [BusinessData.name, UserData.name];
const model = {
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
    type: OwlTypes.ObjectId,
    required: true,
    refPath: "ownerType",
    index: true,
  },
  state: {
    type: OwlTypes.ObjectId,
    ref: StateData.name,
    required: true,
  },
};
const name = "Email";

export default { model, name };

export const ModelName = name;
