import mongoose from "mongoose";
import bcrypt from "bcrypt";

process.loadEnvFile();

const SALT_ROUNDS = parseInt(process.env.PASSWORD_SALT_ROUNDS, 10) || 10;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    lastname: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 150,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    password_hash: {
      type: String,
      required: true,
    },
    state: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "State",
      required: true,
    },
    images: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Image",
      },
    ],
    permission_list: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Permission",
      },
    ],
  },
  {
    timestamps: true,
    collation: { locale: "en", strength: 2 },
  }
);

userSchema.index(
  { email: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

userSchema.pre("save", async function (next) {
  if (this.isModified("password_hash")) {
    try {
      const salt = await bcrypt.genSalt(SALT_ROUNDS);
      this.password_hash = await bcrypt.hash(this.password_hash, salt);
    } catch (err) {
      return next(err);
    }
  }
  next();
});

userSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();

  if (update.password_hash) {
    try {
      const salt = await bcrypt.genSalt(SALT_ROUNDS);
      update.password_hash = await bcrypt.hash(update.password_hash, salt);
      this.setUpdate(update);
    } catch (err) {
      return next(err);
    }
  }
  next();
});

userSchema.methods.validatePassword = async function (password) {
  return bcrypt.compare(password, this.password_hash);
};

export default mongoose.model("User", userSchema);
