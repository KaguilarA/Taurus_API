import mongoose from "mongoose";
import { OwlModel } from "owl-expressjs-utils";
import BusinessData from "../models/business/model.js";

export const SetupLock = mongoose.model(
  "RestaurantSetupLock",
  new mongoose.Schema({
    _id: String,
    revision: { type: Number, default: 0 },
  }),
);

// OWL owns model construction, timestamps and account password protection.
export const Accounts = OwlModel(
  "RestaurantAccount",
  {
    email: { type: String, required: true, unique: true },
    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    name: String,
    sessionVersion: { type: Number, default: 0 },
    role: {
      type: String,
      enum: ["admin", "kitchen", "waiter"],
      default: "admin",
    },
  },
  [],
  ["password"],
);
// Keep the API's settings field for compatibility; persistence uses the existing Business model.
export const Settings = OwlModel(BusinessData.name, BusinessData.model);
OwlModel("RestaurantProduct", {
  sampleKey: { type: String, unique: true, sparse: true },
  name: { type: String, required: true },
  description: String,
  image: String,
  category: { type: String, enum: ["food", "drink", "snack"], required: true },
  inventory: { type: String, enum: ["none", "unit", "ml"], required: true },
  price: { type: Number, min: 0, required: true },
  prices: { large: Number, small: Number, shot: Number },
  bottleMl: { type: Number, default: 0 },
  stock: { type: Number, default: 0, min: 0 },
  minimum: { type: Number, default: 0, min: 0 },
  active: { type: Boolean, default: true },
  featured: { type: Boolean, default: false },
});
OwlModel("RestaurantPromotion", {
  title: String,
  description: String,
  image: String,
  starts: Date,
  ends: Date,
  active: { type: Boolean, default: true },
});
OwlModel("RestaurantEvent", {
  sampleKey: { type: String, unique: true, sparse: true },
  title: { type: String, required: true },
  kind: {
    type: String,
    enum: ["music", "karaoke", "sports", "other"],
    default: "other",
  },
  description: String,
  image: String,
  starts: { type: Date, default: null },
  ends: { type: Date, default: null },
  location: String,
  admission: String,
  active: { type: Boolean, default: true },
  isSample: { type: Boolean, default: false },
});
export const Event = mongoose.model("RestaurantEvent");
OwlModel("RestaurantSale", {
  requestId: { type: String, unique: true, required: true },
  label: String,
  total: Number,
  status: { type: String, default: "paid" },
  billId: { type: String, index: true },
  orderStatus: {
    type: String,
    enum: ["pending", "preparing", "ready", "delivered"],
  },
  notes: String,
  paymentMethod: { type: String, enum: ["cash", "sinpe", "card"] },
  paidAt: Date,
  deliveredBy: String,
  deliveredAt: Date,
  items: [
    {
      productId: String,
      name: String,
      category: String,
      serving: String,
      quantity: Number,
      unitPrice: Number,
      amount: Number,
      consumed: Number,
    },
  ],
});
OwlModel("RestaurantMovement", {
  productId: String,
  productName: String,
  delta: Number,
  unit: String,
  reason: String,
  saleId: String,
  balance: Number,
});
export const Product = mongoose.model("RestaurantProduct");
export const Promotion = mongoose.model("RestaurantPromotion");
export const Sale = mongoose.model("RestaurantSale");
export const Movement = mongoose.model("RestaurantMovement");

OwlModel("RestaurantTable", {
  name: { type: String, required: true },
  token: { type: String, required: true, unique: true },
  active: { type: Boolean, default: true },
});
OwlModel("RestaurantBill", {
  tableId: { type: String, required: true },
  label: String,
  token: { type: String, required: true, unique: true },
  status: { type: String, enum: ["open", "paid"], default: "open" },
  total: { type: Number, default: 0 },
  revision: { type: Number, default: 0 },
  paymentMethod: { type: String, enum: ["cash", "sinpe", "card"] },
  paymentReference: String,
  receivedBy: String,
  paidAt: Date,
});
export const Table = mongoose.model("RestaurantTable");
export const Bill = mongoose.model("RestaurantBill");
Bill.schema.index(
  { tableId: 1 },
  { unique: true, partialFilterExpression: { status: "open" } },
);
