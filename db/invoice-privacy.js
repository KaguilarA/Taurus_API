import { createHash } from "node:crypto";
import { OwlCollection, OwlTransaction } from "owl-expressjs-utils";

// Explicit privacy cleanup for the previous draft implementation. Never copies invoice content.
export async function discardStoredInvoices() {
  let removed = 0;
  for (;;) {
    const batch = await OwlCollection("purchaseinvoices")
      .find(
        {},
        {
          projection: { _id: 1, status: 1, fileHash: 1, invoiceKey: 1 },
        },
      )
      .sort({ _id: 1 })
      .limit(100)
      .toArray();
    if (!batch.length) return removed;
    for (const item of batch) {
      await OwlTransaction(async (session) => {
        const movements = OwlCollection("stockmovements");
        if (item.status === "confirmed") {
          if (!/^[a-f0-9]{64}$/.test(item.fileHash ?? "") || !item.invoiceKey)
            throw new Error(
              "La limpieza de facturas requiere revisar una huella inválida.",
            );
          const first = await movements.findOne(
            { invoiceId: String(item._id) },
            { session, projection: { _id: 1 } },
          );
          if (!first)
            throw new Error(
              "La limpieza encontró una compra sin movimientos asociados.",
            );
          await movements.updateMany(
            { invoiceId: String(item._id) },
            {
              $set: { importGroup: item.fileHash, reason: "Entrada de compra" },
              $unset: { invoiceId: "" },
            },
            { session },
          );
          await movements.updateOne(
            { _id: first._id },
            {
              $set: {
                importKey: item.fileHash,
                importNumberKey: createHash("sha256")
                  .update(item.invoiceKey)
                  .digest("hex"),
              },
            },
            { session },
          );
        }
        await OwlCollection("purchaseinvoices").deleteOne(
          { _id: item._id },
          { session },
        );
      });
      removed++;
    }
  }
}
