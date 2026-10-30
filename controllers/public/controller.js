import {
  Settings,
  Product,
  Promotion,
  Sale,
  Movement,
  Event,
} from "../../models/models.js";

import mongoose from "mongoose";

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
      if (application.draining || mongoose.connection.readyState !== 1)
        return res.status(503).json({ ok: false });
      await mongoose.connection.db.command({ ping: 1 }, { maxTimeMS: 2000 });
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  };
  const menu = async (req, res) => {
    const now = new Date();
    const products = await Product.find({ active: true })
      .select("-stock -minimum -__v")
      .lean();
    res.json({
      settings: await Settings.getOne({ key: "main" }),
      products,
      promotions: await Promotion.find({
        active: true,
        starts: { $lte: now },
        ends: { $gte: now },
      }).lean(),
      events: await Event.find({
        active: true,
        ...(production ? { isSample: { $ne: true } } : {}),
        $or: [{ ends: null }, { ends: { $gte: now } }],
      })
        .sort({ starts: 1, createdAt: -1 })
        .lean(),
    });
  };
  const workspace = async (req, res) =>
    res.json({
      settings: await Settings.getOne({ key: "main" }),
      products:
        (req.account.role ?? "admin") === "admin"
          ? await Product.find().sort({ name: 1 }).lean()
          : [],
      promotions:
        (req.account.role ?? "admin") === "admin"
          ? await Promotion.find().sort({ createdAt: -1 }).lean()
          : [],
      sales:
        (req.account.role ?? "admin") === "admin"
          ? await Sale.find().sort({ createdAt: -1 }).limit(100).lean()
          : [],
      movements:
        (req.account.role ?? "admin") === "admin"
          ? await Movement.find().sort({ createdAt: -1 }).limit(100).lean()
          : [],
      events:
        (req.account.role ?? "admin") === "admin"
          ? await Event.find().sort({ starts: 1 }).lean()
          : [],
    });
  return { health, deployment, ready, menu, workspace };
}

export default createPublicController;
