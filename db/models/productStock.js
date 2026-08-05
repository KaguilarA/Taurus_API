import TaurusModel from "./../utils/model.js";

export default TaurusModel("ProductStock", {
  stock: {
    type: Number,
    required: true,
    unique: true,
    trim: true,
    min: [0, "Stock cannot be negative"],
  },
});
