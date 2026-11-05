import { OwlTypes } from "owl-expressjs-utils";
import { ModelName as ProductModelName } from "../product/model.js";

export const ModelName = "ProductStock";

const model = {
  stock: {
    type: Number,
    required: true,
    validate: Number.isSafeInteger,
    min: [0, "Stock cannot be negative"],
  },
  owner: {
    type: OwlTypes.ObjectId,
    ref: ProductModelName,
    required: true,
    unique: true,
  },
  minimum: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
};

export default { name: ModelName, model };
