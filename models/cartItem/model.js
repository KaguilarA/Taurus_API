import { Schema } from "mongoose";
import { ModelName as CartModelName } from "./../cart/model.js";
import { ModelName as ProductModelName } from "./../product/model.js";
import { ModelName as PromoModelName } from "./../promo/model.js";
import { ModelName as PriceModelName } from "./../price/model.js";

const ownerTypes = [ProductModelName, PromoModelName];

export const ModelName = "CartItem";

export default {
  cart: {
    type: Schema.Types.ObjectId,
    ref: CartModelName,
    required: true,
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
  unitPrice: {
    type: Schema.Types.ObjectId,
    ref: PriceModelName,
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
