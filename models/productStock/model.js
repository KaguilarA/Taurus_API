import { OwlTypes } from "owl-expressjs-utils";
import { ModelName as ProductModelName } from "../product/model.js";

export const ModelName = "ProductStock";

const model = {
  stock: {
    type: Number,
    required: true,
    unique: true,
    trim: true,
    min: [0, "Stock cannot be negative"],
  },
  owner: {
    type: OwlTypes.ObjectId,
    ref: ProductModelName,
    required: true,
  },
};

export default { name: ModelName, model };
