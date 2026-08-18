import { Schema, Types } from "mongoose";
import { OwlModel } from "owl-expressjs-utils";

const PriceData = {
  amount: {
    type: Types.Decimal128,
    required: true,
    min: 0.01,
    max: 1000000.0,
  },
  isCurrent: {
    type: Boolean,
    default: false,
  },
  ownerType: {
    type: String,
    required: true,
    enum: ["Product", "Promo"],
  },
  owner: {
    type: Schema.Types.ObjectId,
    required: true,
    refPath: "ownerType",
    index: true,
  },
};

export default OwlModel("Price", PriceData);
