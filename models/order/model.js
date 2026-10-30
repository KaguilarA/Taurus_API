const model = {
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
      fulfillmentStatus: {
        type: String,
        enum: ["pending", "preparing", "ready", "delivered"],
      },
      serving: String,
      quantity: Number,
      unitPrice: Number,
      amount: Number,
      consumed: Number,
    },
  ],
};
export const ModelName = "Order";
export default { name: ModelName, model };
