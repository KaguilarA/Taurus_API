import { Schema } from "mongoose";
import { OwlModel } from "owl-expressjs-utils";

/**
 * PhoneNumber model definition using the OwlModel factory.
 * Handles structural properties for phone numbers, country codes, and relational state references.
 */
export default OwlModel("PhoneNumber", {
  phone: {
    type: String,
    required: [true, "El número de teléfono es obligatorio."],
    trim: true,
  },
  countryNumber: {
    type: String,
    required: [true, "El código de país es obligatorio."],
    trim: true,
  },
  owner: {
    type: Schema.Types.ObjectId,
    required: true,
    refPath: "ownerType",
    index: true,
  },
  ownerType: {
    type: String,
    required: true,
    enum: ["Business", "User"],
  },
  state: {
    type: Schema.Types.ObjectId,
    ref: "State",
  },
});
