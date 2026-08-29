import { Schema } from "mongoose";
import { ModelName as StateModelName } from "./../state/model.js";

export const ModelName = "Promo";

export default {
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [150, "Promo name cannot exceed 150 characters"],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, "Promo description cannot exceed 500 characters"],
  },
  date: {
    type: Date,
    index: true,
  },
  state: {
    type: Schema.Types.ObjectId,
    ref: StateModelName,
    required: true,
  }
};
