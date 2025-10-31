import mongoose from "mongoose";

const promoSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [150, "Promo name cannot exceed 150 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Promo description cannot exceed 500 characters"],
    },
    days_of_week: [
      {
        type: String,
        enum: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
      },
    ],
    products_quantity: {
      type: Number,
      default: 1,
    },
    on_landing: {
      type: Boolean,
      default: false,
    },
    specific_date: {
      type: Date,
      index: true,
    },
    state: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "State",
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    price: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Price",
      required: true,
    },
    product_list: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

promoSchema.index({ on_landing: 1 });

export default mongoose.model("Promo", promoSchema);
