import { PDFParse } from "pdf-parse";
import { createWorker } from "tesseract.js";
import language from "@tesseract.js-data/eng";
import { parseQuimarText } from "./invoice-reading.js";

// No URLs, remote OCR, invoice cache, output files or application logging.
process.once("message", async ({ buffer, mimetype }) => {
  let parser, worker;
  try {
    let reading,
      pages = 1;
    if (mimetype === "application/pdf") {
      parser = new PDFParse({
        data: new Uint8Array(buffer),
        isEvalSupported: false,
      });
      const info = await parser.getInfo();
      pages = info.total;
      if (pages > 20) throw new Error("Too many pages");
      const result = await parser.getText();
      if (result.text.length > 200000) throw new Error("Too much text");
      reading = parseQuimarText(result.text);
    }
    if (reading)
      process.send({ reading: { ...reading, source: "quimar-pdf" } });
    else {
      if (pages > 3) throw new Error("Too many scanned pages");
      worker = await createWorker("eng", 1, {
        langPath: language.langPath,
        gzip: language.gzip,
        cacheMethod: "none",
        errorHandler: () => {},
      });
      await worker.setParameters({
        tessedit_pageseg_mode: "6",
        preserve_interword_spaces: "1",
      });
      let content = "";
      for (let page = 1; page <= pages; page++) {
        const image = parser
          ? (
              await parser.getScreenshot({
                partial: [page],
                desiredWidth: 1800,
              })
            ).pages[0].data
          : buffer;
        const result = await worker.recognize(image);
        content += result.data.text + "\n";
        if (parser) image.fill(0);
        if (content.length > 200000) throw new Error("Too much text");
      }
      reading = parseQuimarText(content, { ocr: true });
      if (!reading) throw new Error("Unreadable invoice");
      process.send({ reading: { ...reading, source: "local-ocr" } });
    }
  } catch {
    process.send({
      error:
        "No se pudo leer una factura completa de Quimar. Usá PDF digital (hasta 20 páginas), un escaneo de hasta 3 páginas o una foto más clara.",
    });
  } finally {
    buffer.fill(0);
    await worker?.terminate();
    await parser?.destroy();
    if (process.connected) process.disconnect();
  }
});
