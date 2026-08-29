export const ModelName = "ProductType";

export default {
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
