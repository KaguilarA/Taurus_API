import { Schema, Types } from "mongoose";
import { ModelName as ProductModelName } from "../product/model.js";
import { ModelName as PromoModelName } from "../promo/model.js";
import { ModelName as StateModelName } from "../state/model.js";

const ownerTypes = [ProductModelName, PromoModelName];

export const ModelName = "Price";

const model = {
  amount: {
    type: Types.Decimal128,
    required: true,
    min: 0.01,
    max: 1000000.0,
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

export default { name: ModelName, model };
