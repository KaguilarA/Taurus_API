import {
  invoicePreview,
  confirmInvoice,
} from "../../services/purchase-invoices.js";

export function createInvoiceController({ readPurchaseInvoice } = {}) {
  return {
    preview: async (req, res) =>
      res.json(
        await invoicePreview(
          req.file,
          String(req.account._id),
          readPurchaseInvoice,
        ),
      ),
    confirm: async (req, res) =>
      res.json(
        await confirmInvoice(req.params.id, req.body, String(req.account._id)),
      ),
  };
}
