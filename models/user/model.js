import { Schema } from "mongoose";
import { OwlModel } from "owl-expressjs-utils";

const UserData = {
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
  password: {
    type: String,
    required: true,
  },
  state: {
    type: Schema.Types.ObjectId,
    ref: "State",
    required: true,
  },
};

export default OwlModel("User", UserData, ["password"]);
