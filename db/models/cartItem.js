import TaurusModel from "./../utils/model.js";

export default TaurusModel({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
  },
  promo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Promo",
  },
  unitPrice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Price",
  },
  quantity: {
    type: Number,
    default: 1,
    min: [1, "Quantity must be at least 1"],
    validate: {
      validator: Number.isInteger,
      message: "Quantity must be an integer",
    },
  }
});