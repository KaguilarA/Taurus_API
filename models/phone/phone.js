import { Schema } from "mongoose";
import { OwlModel } from "owl-expressjs-utils";

const PhoneData = {
  countryCode: {
    type: String,
    required: [true, "El código de país es obligatorio."],
    trim: true
  },
  phone: {
    type: String,
    required: [true, "El número de teléfono es obligatorio."],
    trim: true
  },
  ownerType: {
    type: String,
    required: true,
    enum: ["Business", "User"]
  },
  owner: {
    type: Schema.Types.ObjectId,
    required: true,
    refPath: "ownerType",
    index: true
  },
  state: {
    type: Schema.Types.ObjectId,
    ref: "State",
    required: true
  },
};

/**
 * PhoneNumber model definition using the OwlModel factory.
 * Handles structural properties for phone numbers, country codes, and relational state references.
 */
export default OwlModel("Phone", PhoneData);
