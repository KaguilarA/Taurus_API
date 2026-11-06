import { OwlTypes } from "owl-expressjs-utils";
import { ModelName as StateModelName } from "../state/model.js";
import { ModelName as ProductTypeModelName } from "../productType/model.js";

export const ModelName = "Product";

const model = {
  ...{
    sampleKey: { type: String, unique: true, sparse: true },
    image: String,
    category: {
      type: String,
      required: true,
    },
    drinkType: {
      type: String,
      enum: ["non_alcoholic", "alcoholic", ""],
    },
    price: { type: Number, min: 0, required: true },
    // Net cost per unit (or full liquor bottle), after discount, excluding VAT.
    purchasePrice: { type: Number, min: 0 },
    supplierAliases: [
      {
        key: { type: String, required: true },
        supplier: { type: String, required: true },
        name: { type: String, required: true, maxlength: 300 },
      },
    ],
    prices: { large: Number, small: Number, shot: Number },
    bottleMl: { type: Number, default: 0 },
    productType: {
      type: OwlTypes.ObjectId,
      ref: ProductTypeModelName,
      required: true,
    },
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
    type: OwlTypes.ObjectId,
    ref: StateModelName,
    required() {
      return !this.category;
    },
  },
};
export default { name: ModelName, model };
