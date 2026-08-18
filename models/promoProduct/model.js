import { Schema } from "mongoose";
import { OwlModel } from "owl-expressjs-utils";

const PromoProductData = {
  promo: {
    type: Schema.Types.ObjectId,
    ref: "Promo",
    required: true,
  },
  products: {
    type: Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
};

export default OwlModel("PromoProduct", PromoProductData);
