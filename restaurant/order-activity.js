import { Bill, Sale } from "./models.js";
import { Problem } from "./domain.js";

export async function hasStaffOrders(role) {
  return !!(await Sale.exists({
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
  const bill = await Bill.findOne({ token });
  if (!bill) throw new Problem("Cuenta no encontrada.", 404);
  const hasOrders =
    bill.status === "open" &&
    !!(await Sale.exists({ billId: bill.id, status: "open" }));
  return { bill, hasOrders };
}
