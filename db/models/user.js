import TaurusModel from "./../utils/model.js";

export default TaurusModel("User", {
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
  password: {
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
  permissions: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Permission",
    },
  ],
}, ["password"]);