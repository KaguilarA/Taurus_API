import { Schema } from "mongoose";
import { OwlModel } from "owl-expressjs-utils";

const CartItemData = {
  cart: {
    type: Schema.Types.ObjectId,
    ref: "Cart",
    required: true,
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
  unitPrice: {
    type: Schema.Types.ObjectId,
    ref: "Price",
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

export default OwlModel("CartItem", CartItemData);
