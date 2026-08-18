import { Schema } from "mongoose";
import { OwlModel } from "owl-expressjs-utils";

const CartData = {
  name: {
    type: String,
    default: "Cart",
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  state: {
    type: Schema.Types.ObjectId,
    ref: "State",
    required: true,
  },
};

export default OwlModel("Cart", CartData);
