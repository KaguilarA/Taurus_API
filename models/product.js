import { OwlModel } from "owl-expressjs-utils";

export default OwlModel("Product", {
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
    type: mongoose.Schema.Types.ObjectId,
    ref: "State",
    required: true,
  },
  type: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductType",
      required: true,
    },
  ],
});
