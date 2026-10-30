import { TableModel } from "../../models/models.js";

import QRCode from "qrcode";
import { token } from "../../services/tokens.js";
import { Problem, text } from "../../services/validation.js";
export function createTableController({ origin } = {}) {
  const getTables = async (req, res) => {
    const tables = await TableModel.getByCoincidence(
      {},
      { sort: { createdAt: 1 }, lean: true },
    );
    res.json(
      await Promise.all(
        tables.map(async (table) => {
          const url = `${origin}/cuenta?mesa=${table.token}`;
          return {
            ...table,
            url,
            qr: await QRCode.toDataURL(url, { width: 360, margin: 2 }),
          };
        }),
      ),
    );
  };
  const registerTable = async (req, res) =>
    res.status(201).json(
      await TableModel.save({
        name: text(req.body.name, "Mesa o posición", 100, true),
        token: token(),
      }),
    );
  const updateTable = async (req, res) => {
    if (typeof req.body.active !== "boolean")
      throw new Problem("Estado inválido.");
    const table = await TableModel.update(
      req.params.id,
      { active: req.body.active },
      { new: true },
    );
    if (!table) throw new Problem("Mesa no encontrada.", 404);
    res.json(table);
  };
  return { getTables, registerTable, updateTable };
}

export default createTableController;
