import { OwlModel } from "owl-expressjs-utils";

export default OwlModel("ProductStock", {
  stock: {
    type: Number,
    required: true,
    unique: true,
    trim: true,
    min: [0, "Stock cannot be negative"],
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
});
