import { agruparRenglones, parsearContratoSinco, type ContratoLeido } from "./contratoParser";

/** Lee un PDF de contrato SINCO en el navegador (el archivo no sale del equipo del usuario). */
export async function leerContratoPDF(file: File): Promise<ContratoLeido> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const lineas: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const items = tc.items.filter((i): i is typeof i & { str: string; transform: number[] } => "str" in i).map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5] }));
    lineas.push(...agruparRenglones(items));
  }
  const c = parsearContratoSinco(lineas);
  c.archivo = file.name;
  return c;
}
