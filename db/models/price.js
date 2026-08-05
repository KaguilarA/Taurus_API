import TaurusModel from "./../utils/model.js";

export default TaurusModel("Price", {
  amount: {
    type: mongoose.Types.Decimal128,
    required: true,
    min: 0.01,
    max: 1000000.0,
  },
  isCurrent: {
    type: Boolean,
    default: false,
  },
});