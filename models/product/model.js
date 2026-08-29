import { Schema } from "mongoose";
import { ModelName as StateModelName } from "./../state/model.js";

export const ModelName = "Product";

export default {
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [150, "Product name cannot exceed 150 characters"],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, "Product description cannot exceed 500 characters"],
  },
  state: {
    type: Schema.Types.ObjectId,
    ref: StateModelName,
    required: true,
  }
};
