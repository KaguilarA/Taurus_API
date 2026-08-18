import { Schema } from "mongoose";
import { OwlModel } from "owl-expressjs-utils";

const ProductData = {
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
    ref: "State",
    required: true,
  },
  type: [
    {
      type: Schema.Types.ObjectId,
      ref: "ProductType",
      required: true,
    },
  ],
};

export default OwlModel("Product", ProductData);
