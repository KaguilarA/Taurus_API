const StatesHandlers = ["users", "business", "promos", "products", "cart"];

export const ModelName = "State";

export default {
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
