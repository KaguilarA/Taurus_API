import TaurusModel from "./../utils/model.js";

export default TaurusModel("ProductType", {
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: [100, "Name cannot exceed 100 characters"],
  }
});