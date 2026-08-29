import { Schema } from "mongoose";
import { ModelName as PromoModelName } from "./../promo/model.js";
import { ModelName as ProductModelName } from "./../product/model.js";

export const ModelName = "PromoProduct";

export default {
  promo: {
    type: Schema.Types.ObjectId,
    ref: PromoModelName,
    required: true,
  },
  products: {
    type: Schema.Types.ObjectId,
    ref: ProductModelName,
    required: true,
  },
  quantity: {
    type: Number,
    default: 1,
    min: [1, "Quantity must be at least 1"],
    validate: {
      validator: Number.isInteger,
      message: "Quantity must be an integer",
    },
  },
};
