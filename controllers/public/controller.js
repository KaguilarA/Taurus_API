import { productsWithInventory } from "../../services/inventory.js";
import { getMenuPage, getMenuRecommendations } from "../../services/menu.js";
import { OwlMongoStatus, OwlMongoCommand } from "owl-expressjs-utils";
import {
  BusinessModel,
  ProductModel,
  ProductTypeModel,
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
    const [settings, menu, recommendations, productTypes, promotions, events] =
      await Promise.all([
        BusinessModel.getOne({ key: "main" }, { lean: true }),
        getMenuPage(req.query),
        getMenuRecommendations(),
        ProductTypeModel.getByCoincidence({ active: true }, { lean: true }),
        PromoModel.getByCoincidence(
          { active: true, starts: { $lte: now }, ends: { $gte: now } },
          { lean: true },
        ),
        EventModel.getByCoincidence(
          {
            active: true,
            ...(production ? { isSample: { $ne: true } } : {}),
            $or: [{ ends: null }, { ends: { $gte: now } }],
          },
          { sort: { starts: 1, createdAt: -1 }, lean: true },
        ),
      ]);
    res.json({
      settings,
      products: menu.items,
      menu,
      recommendations,
      productTypes,
      promotions,
      events,
    });
  };
  const workspace = async (req, res) => {
    const admin = (req.account.role ?? "admin") === "admin";
    const [
      settings,
      recommendations,
      productTypes,
      products,
      promotions,
      sales,
      movements,
      events,
    ] = await Promise.all([
      BusinessModel.getOne({ key: "main" }, { lean: true }),
      admin ? getMenuRecommendations() : [],
      admin
        ? ProductTypeModel.getByCoincidence(
            {},
            { sort: { name: 1 }, lean: true },
          )
        : [],
      admin
        ? ProductModel.getByCoincidence(
            {},
            { sort: { name: 1 }, lean: true },
          ).then((products) => productsWithInventory(products))
        : [],
      admin
        ? PromoModel.getByCoincidence(
            {},
            { sort: { createdAt: -1 }, lean: true },
          )
        : [],
      admin
        ? OrderModel.getByCoincidence(
            {},
            { sort: { createdAt: -1 }, limit: 100, lean: true },
          )
        : [],
      admin
        ? StockMovementModel.getByCoincidence(
            {},
            { sort: { createdAt: -1 }, limit: 100, lean: true },
          )
        : [],
      admin
        ? EventModel.getByCoincidence({}, { sort: { starts: 1 }, lean: true })
        : [],
    ]);
    res.json({
      settings,
      recommendations,
      productTypes,
      products,
      promotions,
      sales,
      movements,
      events,
    });
  };
  return { health, deployment, ready, menu, workspace };
}

export default createPublicController;
