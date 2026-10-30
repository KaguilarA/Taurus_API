import { OwlController } from "owl-expressjs-utils";
import { PromoModel } from "../../models/models.js";

import { Promotion } from "../../models/models.js";
import { Problem, text, image } from "../../services/validation.js";

function promotionInput(body) {
  const starts = new Date(body.starts),
    ends = new Date(body.ends);
  if (!Number.isFinite(+starts) || !Number.isFinite(+ends) || starts >= ends)
    throw new Problem("Fechas de promoción inválidas.");
  return {
    title: text(body.title, "Título", 150, true),
    description: text(body.description ?? "", "Descripción"),
    image: image(body.image),
    starts,
    ends,
    active: body.active !== false,
  };
}

export function createPromoController() {
  const crud = OwlController({ entityId: "Promo", model: PromoModel });
  const register = async (req, res) => {
    req.body = promotionInput(req.body);
    return crud.register(req, res);
  };
  const update = async (req, res) => {
    const promo = await PromoModel.update(
      req.params.id,
      promotionInput(req.body),
      { new: true, runValidators: true },
    );
    if (!promo) throw new Problem("Promoción no encontrada.", 404);
    res.json(promo);
  };
  return { register, update };
}

export default createPromoController;
