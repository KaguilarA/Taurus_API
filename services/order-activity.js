import { needsKitchen } from "./order-progress.js";
import { CartModel, OrderModel } from "../models/models.js";
import { Problem } from "./validation.js";

export async function hasStaffOrders(role) {
  const filter = { status: "open", billId: { $exists: true } };
  if (role !== "kitchen") return !!(await OrderModel.exists(filter));
  const orders = await OrderModel.getByCoincidence(
    { ...filter, "items.category": "food", orderStatus: { $ne: "delivered" } },
    { select: "items orderStatus", lean: true },
  );
  return orders.some(needsKitchen);
}

export async function billActivity(token) {
  if (typeof token !== "string" || !/^[a-f0-9]{48}$/.test(token))
    throw new Problem("Cuenta no encontrada.", 404);
  const bill = await CartModel.getOne({ token });
  if (!bill) throw new Problem("Cuenta no encontrada.", 404);
  const hasOrders =
    bill.status === "open" &&
    !!(await OrderModel.exists({ billId: bill.id, status: "open" }));
  return { bill, hasOrders };
}
