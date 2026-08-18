import { OwlModel } from "owl-expressjs-utils";

const StatesHandlers = ["users", "business", "promos", "products", "cart"];

const StateData = {
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
    enum: StatesHandlers,
    required: true,
  },
};

export default OwlModel("State", StateData);
