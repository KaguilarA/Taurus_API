import { Schema } from "mongoose";
import { OwlModel } from "owl-expressjs-utils";

const ImageData = {
  url: {
    type: String,
    required: true,
    trim: true,
    match: [/^(https?:\/\/[^\s]+)$/, "Invalid URL format for imageUrl"],
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  isMain: {
    type: Boolean,
    default: false,
  },
  ownerType: {
    type: String,
    required: true,
    enum: ["Product", "Promo", "User", "Business"],
  },
  owner: {
    type: Schema.Types.ObjectId,
    required: true,
    refPath: "ownerType",
    index: true,
  },
};

export default OwlModel("Image", ImageData);
