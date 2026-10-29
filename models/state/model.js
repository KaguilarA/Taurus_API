const StatesHandlers = ["User", "Business", "Promo", "Product", "Cart"];

const model = {
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
const name = "State";

export default { model, name };
