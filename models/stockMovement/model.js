const model = {
  productId: String,
  productName: String,
  delta: Number,
  unit: String,
  reason: String,
  saleId: String,
  balance: Number,
};
export const ModelName = "StockMovement";
export default { name: ModelName, model };
