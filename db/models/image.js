import TaurusModel from "./../utils/model.js";

export default TaurusModel("Image", {
  imageUrl: {
    type: String,
    required: true,
    trim: true,
    match: [/^(https?:\/\/[^\s]+)$/, "Invalid URL format for imageUrl"],
  },
  isMain: {
    type: Boolean,
    default: false,
  },
});