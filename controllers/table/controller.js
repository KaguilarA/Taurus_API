import { Table } from "../../models/models.js";
import QRCode from "qrcode";
import { token } from "../../services/tokens.js";
import { Problem, text } from "../../services/validation.js";
export function createTableController({ origin } = {}) {
  const getTables = async (req, res) => {
    const tables = await Table.find().sort({ createdAt: 1 }).lean();
    res.json(
      await Promise.all(
        tables.map(async (table) => {
          const url = `${origin}/?mesa=${table.token}`;
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
      await Table.create({
        name: text(req.body.name, "Mesa o posición", 100, true),
        token: token(),
      }),
    );
  const updateTable = async (req, res) => {
    if (typeof req.body.active !== "boolean")
      throw new Problem("Estado inválido.");
    const table = await Table.findByIdAndUpdate(
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
