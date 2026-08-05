import TaurusModel from "./../utils/model.js";

export default TaurusModel("Promo", {
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [150, "Promo name cannot exceed 150 characters"],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, "Promo description cannot exceed 500 characters"],
  },
  date: {
    type: Date,
    index: true,
  },
  state: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "State",
    required: true,
  },
  price: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Price",
    required: true,
  },
  products: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
  ],
  productsCount: [
    {
      type: Number,
      default: 1,
    },
  ],
  productMaxCount: {
    type: Number,
    default: 1,
  },
});