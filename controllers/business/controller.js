import { BusinessModel } from "../../models/models.js";
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
  return { update };
}

export default createBusinessController;
