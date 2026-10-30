import { Schema } from "mongoose";
import BusinessData from "../business/model.js";
import StateData from "../state/model.js";
import UserData from "../user/model.js";

const ownerTypes = [BusinessData.name, UserData.name];
const model = {
  countryCode: {
    type: String,
    required: [true, "El código de país es obligatorio."],
    trim: true,
  },
  phone: {
    type: String,
    required: [true, "El número de teléfono es obligatorio."],
    trim: true,
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
    ref: StateData.name,
    required: true,
  },
};
const name = "Phone";

/**
 * PhoneNumber model definition using the OwlModel factory.
 * Handles structural properties for phone numbers, country codes, and relational state references.
 */
export default { model, name };

export const ModelName = name;
