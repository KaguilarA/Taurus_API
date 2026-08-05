import TaurusModel from "./../utils/model.js";

export default TaurusModel("Product", {
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
  onLanding: {
    type: Boolean,
    default: false,
  },
  state: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "State",
    required: true,
  },
  type: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProductType",
    required: true,
  },
  stock: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProductStock",
  },
  price: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Price",
    },
  ],
  images: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Image",
    },
  ],
});