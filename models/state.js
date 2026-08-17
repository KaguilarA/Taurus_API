import { OwlModel } from "owl-expressjs-utils";

export default OwlModel("State", {
  name: {
    type: String,
    trim: true,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    trim: true,
  },
  color: {
    type: String,
    trim: true,
  },
  type: {
    type: String,
    enum: ["users", "business", "promos", "products", "cart"],
    required: true,
  },
});
