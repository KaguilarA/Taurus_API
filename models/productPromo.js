import { OwlModel } from "owl-expressjs-utils";

export default OwlModel("ProductPromo", {
  promo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Promo",
    required: true,
  },
  products: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
});
