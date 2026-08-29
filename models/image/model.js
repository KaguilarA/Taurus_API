import { Schema } from "mongoose";
import { ModelName as BusinessModelName } from "./../business/model.js";
import { ModelName as PromoModelName } from "./../promo/model.js";
import { ModelName as ProductModelName } from "./../product/model.js";
import { ModelName as StateModelName } from "./../state/model.js";
import { ModelName as UserModelName } from "./../user/model.js";

const ownerTypes = [
  ProductModelName,
  PromoModelName,
  UserModelName,
  BusinessModelName,
];

export const ModelName = "Image";

export default {
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
    ref: StateModelName,
    required: true,
  },
};
