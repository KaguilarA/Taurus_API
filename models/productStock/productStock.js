import { Schema } from "mongoose";
import { OwlModel } from "owl-expressjs-utils";

const ProductStockData = {
  stock: {
    type: Number,
    required: true,
    unique: true,
    trim: true,
    min: [0, "Stock cannot be negative"],
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
};

export default OwlModel("ProductStock", ProductStockData);
