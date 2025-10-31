import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [150, "Product name cannot exceed 150 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Product description cannot exceed 500 characters"],
    },
    stock: {
      type: Number,
      default: 0,
    },
    on_landing: {
      type: Boolean,
      default: false,
    },
    state: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "State",
      required: true,
    },
    type: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductType",
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    price: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Price",
      },
    ],
  },
  {
    timestamps: true,
  }
);

productSchema.index({ on_landing: 1 });
productSchema.index({ name: 1, type: 1 });

export default mongoose.model("Product", productSchema);
