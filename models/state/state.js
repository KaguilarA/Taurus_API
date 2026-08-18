import { OwlModel } from "owl-expressjs-utils";

const statesHandlers = ["users", "business", "promos", "products", "cart"];

const stateData = {
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
    enum: statesHandlers,
    required: true,
  },
};

export default OwlModel("State", stateData);
