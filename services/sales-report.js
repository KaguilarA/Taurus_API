import { OrderModel } from "../models/models.js";

// Paid orders are the source for both private reports and public recommendations.
// Historical line names/prices remain intact; voided and open orders never rank.
export function salesRanking(match = { status: "paid" }) {
  return OrderModel.aggregate([
    { $match: match },
    { $unwind: "$items" },
    {
      $group: {
        _id: { productId: "$items.productId", category: "$items.category" },
        name: { $last: "$items.name" },
        quantity: { $sum: "$items.quantity" },
        revenue: { $sum: "$items.amount" },
      },
    },
    { $sort: { quantity: -1, revenue: -1, "_id.productId": 1 } },
  ]);
}
