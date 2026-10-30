import { getMenuPage } from "../../services/menu.js";
import { OwlMongoStatus, OwlMongoCommand } from "owl-expressjs-utils";
import {
  BusinessModel,
  ProductModel,
  PromoModel,
  OrderModel,
  StockMovementModel,
  EventModel,
} from "../../models/models.js";

import { deploymentInfo } from "../../services/deployment.js";

export function createPublicController({
  origin,
  production,
  application = {},
} = {}) {
  const health = (req, res) => res.json({ ok: true });
  const deployment = (req, res) => res.json(deploymentInfo());
  const ready = async (req, res) => {
    try {
      if (application.draining || OwlMongoStatus() !== 1)
        return res.status(503).json({ ok: false });
      await OwlMongoCommand({ ping: 1 }, { maxTimeMS: 2000 });
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  };
  const menu = async (req, res) => {
    const now = new Date();
    const menu = await getMenuPage(req.query);
    res.json({
      settings: await BusinessModel.getOne({ key: "main" }),
      products: menu.items,
      menu,
      promotions: await PromoModel.getByCoincidence(
        {
          active: true,
          starts: { $lte: now },
          ends: { $gte: now },
        },
        { lean: true },
      ),
      events: await EventModel.getByCoincidence(
        {
          active: true,
          ...(production ? { isSample: { $ne: true } } : {}),
          $or: [{ ends: null }, { ends: { $gte: now } }],
        },
        { sort: { starts: 1, createdAt: -1 }, lean: true },
      ),
    });
  };
  const workspace = async (req, res) =>
    res.json({
      settings: await BusinessModel.getOne({ key: "main" }),
      products:
        (req.account.role ?? "admin") === "admin"
          ? await ProductModel.getByCoincidence(
              {},
              { sort: { name: 1 }, lean: true },
            )
          : [],
      promotions:
        (req.account.role ?? "admin") === "admin"
          ? await PromoModel.getByCoincidence(
              {},
              { sort: { createdAt: -1 }, lean: true },
            )
          : [],
      sales:
        (req.account.role ?? "admin") === "admin"
          ? await OrderModel.getByCoincidence(
              {},
              { sort: { createdAt: -1 }, limit: 100, lean: true },
            )
          : [],
      movements:
        (req.account.role ?? "admin") === "admin"
          ? await StockMovementModel.getByCoincidence(
              {},
              { sort: { createdAt: -1 }, limit: 100, lean: true },
            )
          : [],
      events:
        (req.account.role ?? "admin") === "admin"
          ? await EventModel.getByCoincidence(
              {},
              { sort: { starts: 1 }, lean: true },
            )
          : [],
    });
  return { health, deployment, ready, menu, workspace };
}

export default createPublicController;
