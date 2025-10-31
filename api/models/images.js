import mongoose from "mongoose";

const imageSchema = new mongoose.Schema(
  {
    image_url: {
      type: String,
      required: true,
      trim: true,
      match: [/^(https?:\/\/[^\s]+)$/, "Invalid URL format for image_url"],
    },
    is_main: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

imageSchema.index({ is_main: 1 });

export default mongoose.model("Image", imageSchema);
