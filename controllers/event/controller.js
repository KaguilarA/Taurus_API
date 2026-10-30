import { OwlController } from "owl-expressjs-utils";
import { EventModel } from "../../models/models.js";

import { Problem, text, image } from "../../services/validation.js";

function eventInput(body) {
  if (!["music", "karaoke", "sports", "other"].includes(body.kind ?? "other"))
    throw new Problem("Tipo de evento inválido.");
  const starts = body.starts ? new Date(body.starts) : null;
  const ends = body.ends ? new Date(body.ends) : null;
  if (
    (starts && !Number.isFinite(+starts)) ||
    (ends && !Number.isFinite(+ends)) ||
    !!starts !== !!ends ||
    (starts && ends && starts >= ends)
  )
    throw new Problem(
      "Definí inicio y fin válidos, o dejá ambas fechas pendientes.",
    );
  return {
    title: text(body.title, "Título", 150, true),
    kind: body.kind ?? "other",
    description: text(body.description ?? "", "Descripción", 1000),
    image: image(body.image),
    starts,
    ends,
    location: text(body.location ?? "", "Lugar", 200),
    admission: text(body.admission ?? "", "Entrada", 100),
    active: body.active !== false,
    isSample: body.isSample === true,
  };
}
export function createEventController() {
  const crud = OwlController({ entityId: "Event", model: EventModel });
  const register = async (req, res) => {
    req.body = eventInput(req.body);
    return crud.register(req, res);
  };
  const update = async (req, res) => {
    const event = await EventModel.update(req.params.id, eventInput(req.body), {
      new: true,
      runValidators: true,
    });
    if (!event) throw new Problem("Evento no encontrado.", 404);
    res.json(event);
  };
  return { register, update };
}

export default createEventController;
