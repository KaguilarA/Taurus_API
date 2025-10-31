import mongoose from "mongoose";

const productTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    has_stock: {
      type: Boolean,
      default: true,
    },
  },
  {
    collation: { locale: "en", strength: 2 },
  }
);

productTypeSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

export default mongoose.model("ProductType", productTypeSchema);
