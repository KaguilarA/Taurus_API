import TaurusModel from "./../utils/model.js";

export default TaurusModel("Cart", {
  name: {
    type: String,
    trim: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  state: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "State",
    required: true,
  },
  cartItems: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CartItem",
    },
  ],
});
