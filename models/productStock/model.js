import { Schema } from "mongoose";
import { ModelName as ProductModelName } from "./../product/model.js";

export const ModelName = "ProductStock";

export default {
  stock: {
    type: Number,
    required: true,
    unique: true,
    trim: true,
    min: [0, "Stock cannot be negative"],
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: ProductModelName,
    required: true,
  },
};
