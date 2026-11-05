export const ModelName = "ProductType";

const model = {
  code: { type: String, unique: true, sparse: true, trim: true },
  inventoryModes: [{ type: String, enum: ["none", "unit", "ml"] }],
  requiresDrinkType: { type: Boolean, default: false },
  kitchen: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  revision: { type: Number, default: 0 },
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
  },
};

export default { name: ModelName, model };
