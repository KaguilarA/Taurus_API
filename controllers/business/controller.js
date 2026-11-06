import { BusinessModel } from "../../models/models.js";
import { seoDefaults, seoInput } from "../../services/seo.js";
import { Problem } from "../../services/validation.js";
import { businessInput } from "../../services/business.js";

export function createBusinessController({ origin, production } = {}) {
  const update = async (req, res) => {
    const data = businessInput(req.body);
    res.json(
      await BusinessModel.updateWhere(
        { key: "main" },
        { $set: data },
        { new: true, upsert: true, runValidators: true },
      ),
    );
  };
  const readSeo = async (req, res) => {
    const business = await BusinessModel.getOne(
      { key: "main" },
      { select: "seo", lean: true },
    );
    res.json({ ...seoDefaults, ...business?.seo });
  };
  const updateSeo = async (req, res) => {
    const seo = seoInput(req.body);
    const business = await BusinessModel.updateWhere(
      { key: "main" },
      { $set: { seo } },
      { new: true, runValidators: true },
    );
    if (!business) throw new Problem("Configurá primero el negocio.", 409);
    res.json(seo);
  };
  return { update, readSeo, updateSeo };
}

export default createBusinessController;
