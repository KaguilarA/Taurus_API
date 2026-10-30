// Older orders keep their stored data; their item status is derived on read.
export function itemStatus(item, orderStatus) {
  if (item.fulfillmentStatus) return item.fulfillmentStatus;
  if (orderStatus === "delivered") return "delivered";
  return item.category === "food"
    ? orderStatus === "ready"
      ? "ready"
      : "preparing"
    : "pending";
}

export function orderItems(order) {
  return order.items.map((item) => ({
    ...(item._id ? { _id: item._id } : {}),
    productId: item.productId,
    name: item.name,
    category: item.category,
    serving: item.serving,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    amount: item.amount,
    consumed: item.consumed,
    fulfillmentStatus: itemStatus(item, order.orderStatus),
  }));
}

export function overallStatus(items) {
  if (items.every((item) => item.fulfillmentStatus === "delivered"))
    return "delivered";
  if (items.some((item) => item.fulfillmentStatus === "preparing"))
    return "preparing";
  if (items.some((item) => item.fulfillmentStatus === "ready")) return "ready";
  return "pending";
}

export function needsKitchen(order) {
  return order.items.some(
    (item) =>
      item.category === "food" &&
      itemStatus(item, order.orderStatus) !== "delivered",
  );
}
