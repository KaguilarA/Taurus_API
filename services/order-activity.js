import { CartModel, OrderModel } from "../models/models.js";

import { Problem } from "./validation.js";

export async function hasStaffOrders(role) {
  return !!(await OrderModel.exists({
    status: "open",
    billId: { $exists: true },
    ...(role === "kitchen"
      ? { orderStatus: { $in: ["pending", "preparing", "ready"] } }
      : {}),
  }));
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
