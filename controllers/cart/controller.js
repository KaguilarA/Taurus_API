import { OwlTransaction } from "owl-expressjs-utils";
import {
  UserModel,
  CartModel,
  TableModel,
  OrderModel,
  ProductModel,
  StockMovementModel,
  BusinessModel,
} from "../../models/models.js";
import { saleLine } from "../../services/validation.js";

import QRCode from "qrcode";

import { Problem, text, usernameInput } from "../../services/validation.js";
import {
  reserveItems,
  recordMovements,
  paymentMethod,
} from "../../services/orders.js";
import {
  billActivity as findBillActivity,
  hasStaffOrders,
} from "../../services/order-activity.js";
import { assertProductionPassword } from "../../config/runtime.js";
import { token } from "../../services/tokens.js";
const publicOrder = (order) => ({
  _id: order._id,
  items: order.items.map((i) => ({
    name: i.name,
    category: i.category,
    serving: i.serving,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    amount: i.amount,
  })),
  total: order.total,
  status: order.status,
  orderStatus: order.orderStatus,
  notes: order.notes,
  createdAt: order.createdAt,
});
async function billView(bill) {
  // Keep totals and lines from the same snapshot while another device orders/pays.
  return OwlTransaction(
    async (session) => {
      const current = await CartModel.getById(bill._id, { session: session });
      const orders = await OrderModel.getByCoincidence(
        { billId: bill.id },
        { sort: { createdAt: 1 }, session: session, lean: true },
      );
      return {
        token: current.token,
        label: current.label,
        status: current.status,
        total: current.total,
        balance: current.status === "paid" ? 0 : current.total,
        paymentMethod: current.paymentMethod,
        paidAt: current.paidAt,
        orders: orders.map(publicOrder),
      };
    },
    { readConcern: { level: "snapshot" } },
  );
}
async function findBill(value) {
  const bill = await CartModel.getOne({ token: value });
  if (!bill)
    throw new Problem("Cuenta no encontrada. Escaneá el QR de tu mesa.", 404);
  return bill;
}

export function createPublicOrderingController({ production, origin } = {}) {
  const join = async (req, res) => {
    const table = await TableModel.getOne({
      token: req.params.token,
      active: true,
    });
    if (!table)
      throw new Problem("Este QR no está disponible. Consultá al mesero.", 404);
    let bill = await CartModel.getOne({ tableId: table.id, status: "open" });
    if (!bill) {
      try {
        bill = await CartModel.save({
          tableId: table.id,
          label: table.name,
          token: token(),
        });
      } catch (err) {
        if (err.code !== 11000) throw err;
        bill = await CartModel.getOne({ tableId: table.id, status: "open" });
        if (!bill) throw err;
      }
    }
    res.json(await billView(bill));
  };
  const getBill = async (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(await billView(await findBill(req.params.token)));
  };
  const billActivity = async (req, res) => {
    const { bill, hasOrders } = await findBillActivity(req.params.token);
    res.json({ hasOrders, closed: bill.status !== "open" });
  };
  const placeOrder = async (req, res) => {
    const bill = await findBill(req.params.token);
    const requestId = `guest:${bill.id}:${text(req.body.requestId, "Identificador", 100, true)}`;
    const notes = text(req.body.notes ?? "", "Notas", 500);
    let order;
    try {
      await OwlTransaction(async (session) => {
        order = await OrderModel.getOne({ requestId }, { session: session });
        if (order) return;
        const open = await CartModel.updateWhere(
          { _id: bill._id, status: "open" },
          { $inc: { revision: 1 } },
          { new: true, session },
        );
        if (!open)
          throw new Problem(
            "Esta cuenta ya fue pagada. Iniciá una nueva visita desde el QR.",
            409,
          );
        const table = await TableModel.getOne(
          {
            _id: bill.tableId,
            active: true,
          },
          { session: session },
        );
        if (!table) throw new Problem("Esta mesa ya no admite pedidos.", 409);
        const { lines, movements, total } = await reserveItems(
          req.body.items,
          session,
        );
        [order] = await OrderModel.saveMany(
          [
            {
              requestId,
              label: bill.label,
              billId: bill.id,
              status: "open",
              orderStatus: "pending",
              notes,
              items: lines,
              total,
            },
          ],
          { session },
        );
        await CartModel.updateWhere(
          { _id: bill._id },
          { $set: { total: Math.round((open.total + total) * 100) / 100 } },
          { session },
        );
        await recordMovements(movements, order, session);
      });
    } catch (err) {
      if (err.code !== 11000) throw err;
      order = await OrderModel.getOne({ requestId });
      if (!order) throw err;
    }
    res.status(201).json(publicOrder(order));
  };
  return { join, getBill, billActivity, placeOrder };
}

export function createStaffOrderingController({ production, origin } = {}) {
  const orderActivity = async (req, res) =>
    res.json({ hasOrders: await hasStaffOrders(req.account.role ?? "admin") });
  const service = async (req, res) => {
    const bills = await CartModel.getByCoincidence(
      { status: "open" },
      { select: "-token -__v", sort: { createdAt: 1 }, lean: true },
    );
    const kitchen = req.account.role === "kitchen";
    const orders = await OrderModel.getByCoincidence(
      {
        billId: { $in: bills.map((b) => String(b._id)) },
        ...(kitchen ? { orderStatus: { $ne: "delivered" } } : {}),
      },
      { sort: { createdAt: 1 }, lean: true },
    );
    res.json({
      bills: kitchen
        ? bills.filter((b) =>
            orders.some((order) => order.billId === String(b._id)),
          )
        : bills,
      orders,
    });
  };
  const updateOrder = async (req, res) => {
    const next = req.body.status;
    const role = req.account.role ?? "admin";
    if (
      !(
        ["admin", "kitchen"].includes(role) &&
        ["preparing", "ready"].includes(next)
      ) &&
      !(["admin", "waiter"].includes(role) && next === "delivered")
    )
      throw new Problem("Tu rol no permite esta transición.", 403);
    const previous = {
      preparing: "pending",
      ready: "preparing",
      delivered: "ready",
    }[next];
    await OwlTransaction(async (session) => {
      const order = await OrderModel.updateWhere(
        { _id: req.params.id, status: "open", orderStatus: previous },
        {
          $set: {
            orderStatus: next,
            ...(next === "delivered"
              ? {
                  deliveredBy: String(req.account._id),
                  deliveredAt: new Date(),
                }
              : {}),
          },
        },
        { new: true, session },
      );
      if (!order)
        throw new Problem("El pedido cambió. Actualizá el panel.", 409);
      const bill = await CartModel.updateWhere(
        { _id: order.billId, status: "open" },
        { $inc: { revision: 1 } },
        { session },
      );
      if (!bill) throw new Problem("La cuenta ya está cerrada.", 409);
    });
    res.json({ ok: true });
  };
  const pay = async (req, res) => {
    const method = paymentMethod(req.body.method);
    const reference = text(req.body.reference ?? "", "Referencia", 150);
    let bill;
    await OwlTransaction(async (session) => {
      bill = await CartModel.getById(req.params.id, { session: session });
      if (!bill) throw new Problem("Cuenta no encontrada.", 404);
      if (bill.status === "paid") {
        if (
          bill.paymentMethod !== method ||
          bill.paymentReference !== reference
        )
          throw new Problem("Esta cuenta ya fue pagada con otros datos.", 409);
        return;
      }
      const orders = await OrderModel.getByCoincidence(
        { billId: bill.id },
        { session: session },
      );
      if (!orders.length || orders.some((o) => o.orderStatus !== "delivered"))
        throw new Problem(
          "Primero entregá todos los pedidos de esta cuenta.",
          409,
        );
      bill.status = "paid";
      bill.paymentMethod = method;
      bill.paymentReference = reference;
      bill.receivedBy = String(req.account._id);
      bill.paidAt = new Date();
      bill.revision++;
      bill = await CartModel.update(
        bill._id,
        {
          $set: {
            status: bill.status,
            paymentMethod: bill.paymentMethod,
            paymentReference: bill.paymentReference,
            receivedBy: bill.receivedBy,
            paidAt: bill.paidAt,
            revision: bill.revision,
          },
        },
        { session, runValidators: true },
      );
      await OrderModel.updateMany(
        { billId: bill.id, status: "open" },
        {
          $set: {
            status: "paid",
            paymentMethod: method,
            paidAt: bill.paidAt,
          },
        },
        { session },
      );
    });
    res.json({
      _id: bill._id,
      status: bill.status,
      total: bill.total,
      paymentMethod: bill.paymentMethod,
    });
  };

  return { orderActivity, service, updateOrder, pay };
}

export function createCartController({ origin, production } = {}) {
  const registerSale = async (req, res) => {
    const method = paymentMethod(req.body.paymentMethod ?? "cash");
    const requestId = text(req.body.requestId, "Identificador", 100, true);
    const label = text(
      req.body.label ?? "Venta de mostrador",
      "Cuenta",
      150,
      true,
    );
    const items = req.body.items;
    if (!Array.isArray(items) || !items.length || items.length > 100)
      throw new Problem("Agrega entre 1 y 100 líneas.");
    let sale;
    try {
      await OwlTransaction(async (session) => {
        sale = await OrderModel.getOne({ requestId }, { session: session });
        if (sale) return;
        const settings = await BusinessModel.getOne(
          { key: "main" },
          { session: session },
        );
        if (!settings)
          throw new Problem(
            "Completá la información del negocio antes de registrar pedidos.",
            409,
          );
        const lines = [];
        const movements = [];
        for (const input of items) {
          const product = await ProductModel.getOne(
            {
              _id: input.productId,
              active: true,
            },
            { session: session },
          );
          if (!product) throw new Problem("Producto no disponible.", 409);
          const line = saleLine(product, input, settings.servings);
          if (line.consumed) {
            const updated = await ProductModel.updateWhere(
              { _id: product._id, stock: { $gte: line.consumed } },
              { $inc: { stock: -line.consumed } },
              { new: true, session },
            );
            if (!updated)
              throw new Problem(
                `Inventario insuficiente: ${product.name}.`,
                409,
              );
            movements.push({
              productId: String(product._id),
              productName: product.name,
              delta: -line.consumed,
              unit: product.inventory,
              reason: "Venta",
              balance: updated.stock,
            });
          }
          lines.push(line);
        }
        [sale] = await OrderModel.saveMany(
          [
            {
              requestId,
              label,
              paymentMethod: method,
              paidAt: new Date(),
              items: lines,
              total:
                Math.round(
                  lines.reduce((sum, item) => sum + item.amount, 0) * 100,
                ) / 100,
            },
          ],
          { session },
        );
        await StockMovementModel.saveMany(
          movements.map((m) => ({ ...m, saleId: String(sale._id) })),
          { session, ordered: true },
        );
      });
    } catch (err) {
      if (err.code !== 11000) throw err;
      sale = await OrderModel.getOne({ requestId });
      if (!sale) throw err;
    }
    res.status(201).json(sale);
  };
  const voidSale = async (req, res) => {
    const reason = text(req.body.reason, "Motivo", 250, true);
    await OwlTransaction(async (session) => {
      const sale = await OrderModel.updateWhere(
        { _id: req.params.id, status: "paid", billId: { $exists: false } },
        { $set: { status: "void" } },
        { new: true, session },
      );
      if (!sale) throw new Problem("Venta no encontrada o ya anulada.", 409);
      for (const item of sale.items)
        if (item.consumed) {
          const product = await ProductModel.update(
            item.productId,
            { $inc: { stock: item.consumed } },
            { new: true, session },
          );
          await StockMovementModel.saveMany(
            [
              {
                productId: item.productId,
                productName: item.name,
                delta: item.consumed,
                unit: product.inventory,
                reason: `Anulación: ${reason}`,
                saleId: String(sale._id),
                balance: product.stock,
              },
            ],
            { session },
          );
        }
    });
    res.json({ ok: true });
  };
  const reports = async (req, res) => {
    const from = new Date(req.query.from ?? "2000-01-01");
    const to = new Date(req.query.to ?? "2100-01-01");
    if (!Number.isFinite(+from) || !Number.isFinite(+to) || from > to)
      throw new Problem("Rango de fechas inválido.");
    const match = {
      status: "paid",
      $or: [
        { paidAt: { $gte: from, $lt: to } },
        { paidAt: { $exists: false }, createdAt: { $gte: from, $lt: to } },
      ],
    };
    const [summary, ranking] = await Promise.all([
      OrderModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$total" },
            count: { $sum: 1 },
          },
        },
      ]),
      OrderModel.aggregate([
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
        { $sort: { quantity: -1, revenue: -1 } },
      ]),
    ]);
    res.json({
      revenue: summary[0]?.revenue ?? 0,
      count: summary[0]?.count ?? 0,
      ranking,
    });
  };
  return { registerSale, voidSale, reports };
}

export default createCartController;
