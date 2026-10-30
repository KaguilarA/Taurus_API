import { Schema } from "mongoose";
import { ModelName as StateModelName } from "../state/model.js";

export const ModelName = "Product";

const model = {
  ...{
    sampleKey: { type: String, unique: true, sparse: true },
    image: String,
    category: {
      type: String,
      enum: ["food", "drink", "snack"],
      required: true,
    },
    drinkType: { type: String, enum: ["non_alcoholic", "alcoholic", ""] },
    inventory: { type: String, enum: ["none", "unit", "ml"], required: true },
    price: { type: Number, min: 0, required: true },
    prices: { large: Number, small: Number, shot: Number },
    bottleMl: { type: Number, default: 0 },
    stock: { type: Number, default: 0, min: 0 },
    minimum: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
  },

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
    required() {
      return !this.category;
    },
  },
};
export default { name: ModelName, model };
