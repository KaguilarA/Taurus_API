import { PDFParse } from "pdf-parse";

process.once("message", async (buffer) => {
  const parser = new PDFParse({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
  });
  try {
    const info = await parser.getInfo();
    if (info.total > 20)
      throw new Error("La factura no puede superar 20 páginas.");
    const result = await parser.getText();
    if (result.text.length > 200000)
      throw new Error("La factura contiene demasiado texto.");
    process.send({ text: result.text });
  } catch {
    process.send({
      error:
        "El PDF no se pudo abrir o supera 20 páginas / 200.000 caracteres.",
    });
  } finally {
    await parser.destroy();
    process.disconnect();
  }
});
