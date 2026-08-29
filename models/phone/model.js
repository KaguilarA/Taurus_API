import { Schema } from "mongoose";
import { ModelName as BusinessModelName } from "./../business/model.js";
import { ModelName as StateModelName } from "./../state/model.js";
import { ModelName as UserModelName } from "./../user/model.js";

const ownerTypes = [BusinessModelName, UserModelName];

export const ModelName = "Phone";

/**
 * PhoneNumber model definition using the OwlModel factory.
 * Handles structural properties for phone numbers, country codes, and relational state references.
 */
export default {
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
    ref: StateModelName,
    required: true,
  },
};
