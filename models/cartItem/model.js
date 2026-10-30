import { OwlTypes } from "owl-expressjs-utils";
import { ModelName as CartModelName } from "../cart/model.js";
import { ModelName as ProductModelName } from "../product/model.js";
import { ModelName as PromoModelName } from "../promo/model.js";
import { ModelName as PriceModelName } from "../price/model.js";

const ownerTypes = [ProductModelName, PromoModelName];

const model = {
  cart: {
    type: OwlTypes.ObjectId,
    ref: CartModelName,
    required: true,
  },
  ownerType: {
    type: String,
    required: true,
    enum: ownerTypes,
  },
  owner: {
    type: OwlTypes.ObjectId,
    required: true,
    refPath: "ownerType",
    index: true,
  },
  unitPrice: {
    type: OwlTypes.ObjectId,
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

const name = "CartItem";

export default { model, name };

export const ModelName = name;
