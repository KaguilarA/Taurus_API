const model = {
  fileHash: { type: String, required: true, unique: true },
  // Assigned only at confirmation: different scans of one invoice cannot add stock twice.
  invoiceKey: { type: String, unique: true, sparse: true },
  supplier: { type: String, required: true },
  invoiceNumber: String,
  currency: String,
  source: { type: String, enum: ["quimar-pdf", "vision"], required: true },
  status: { type: String, enum: ["draft", "confirmed"], default: "draft" },
  createdBy: String,
  confirmedBy: String,
  confirmedAt: Date,
  updatePurchasePrices: Boolean,
  lines: [
    {
      description: String,
      quantity: Number,
      unitsPerPack: Number,
      mode: String,
      packPrice: Number,
      discountPercent: Number,
      taxPercent: Number,
    },
  ],
  entries: [
    {
      lineIndex: Number,
      productId: String,
      quantity: Number,
      unitsPerPack: Number,
      mode: String,
      delta: Number,
      unit: String,
      balance: Number,
      purchasePrice: Number,
    },
  ],
};
export default { name: "PurchaseInvoice", model };
