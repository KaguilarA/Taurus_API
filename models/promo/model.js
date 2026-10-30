import { Schema } from "mongoose";
import { ModelName as StateModelName } from "../state/model.js";

export const ModelName = "Promo";

const model = {
  ...{
    title: String,
    image: String,
    starts: Date,
    ends: Date,
    active: { type: Boolean, default: true },
  },

  name: {
    type: String,
    default() {
      return this.title;
    },
    required: true,
    trim: true,
    maxlength: [150, "Promo name cannot exceed 150 characters"],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, "Promo description cannot exceed 500 characters"],
  },
  date: {
    type: Date,
    index: true,
  },
  state: {
    type: Schema.Types.ObjectId,
    ref: StateModelName,
    required() {
      return !this.title;
    },
  },
};
export default { name: ModelName, model };
