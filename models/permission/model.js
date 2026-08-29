export const ModelName = "Permission";

export default {
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: [50, "Permission slug cannot exceed 50 characters"],
    match: [
      /^[A-Z0-9_]+$/,
      "Permission slug can only contain uppercase letters, numbers, and underscores",
    ],
  },
  description: {
    type: String,
    trim: true,
    maxlength: 255,
  },
};