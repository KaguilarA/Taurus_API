import { OwlModel } from "owl-expressjs-utils";

export default OwlModel("ProductType", {
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: [100, "Name cannot exceed 100 characters"],
  },
  description: {
    type: String,
    trim: true,
  }
});
