import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
  {
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
  },
  {
    collation: { locale: "en", strength: 2 },
  }
);

permissionSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

export default mongoose.model("Permission", permissionSchema);
