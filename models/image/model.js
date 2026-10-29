import { Schema } from "mongoose";
import BusinessData from "./../business/model.js";
import PromoData from "./../promo/model.js";
import ProductData from "./../product/model.js";
import StateData from "./../state/model.js";
import UserData from "./../user/model.js";

const ownerTypes = [
  ProductData.name,
  PromoData.name,
  UserData.name,
  BusinessData.name,
];
const model = {
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
  ownerType: {
    type: String,
    required: true,
    enum: ownerTypes,
  },
  owner: {
    type: Schema.Types.ObjectId,
    required: true,
    refPath: "ownerType",
    index: true,
  },
  state: {
    type: Schema.Types.ObjectId,
    ref: StateData.name,
    required: true,
  },
};

const name = "Image";

export default { model, name };
