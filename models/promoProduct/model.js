import { OwlTypes } from "owl-expressjs-utils";
import { ModelName as PromoModelName } from "../promo/model.js";
import { ModelName as ProductModelName } from "../product/model.js";

export const ModelName = "PromoProduct";

const model = {
  promo: {
    type: OwlTypes.ObjectId,
    ref: PromoModelName,
    required: true,
  },
  products: {
    type: OwlTypes.ObjectId,
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

export default { name: ModelName, model };
