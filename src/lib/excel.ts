/** Importación del Excel de personal (formato de la base TOROIN):
 *  PROYECTO | NOMBRE | EXAMEN (fecha, vence, vigencia) | ALTURAS (fecha, vence, vigencia). El archivo se lee en el navegador. */
export type FilaExcelPersonal = { obra: string; nombre: string; examen_fecha: string | null; examen_vence: string | null; alturas_fecha: string | null; alturas_vence: string | null };

const isoDe = (v: unknown): string | null => {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "string") {
    const m = v.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  }
  return null;
};

export async function leerExcelPersonal(file: File): Promise<FilaExcelPersonal[]> {
  const { readSheet } = await import("read-excel-file/browser");
  const filas = (await readSheet(file)) as unknown[][];
  const out: FilaExcelPersonal[] = [];
  for (const f of filas) {
    const [obra, nombre, ef, ev, , af, av] = f;
    if (typeof nombre !== "string" || !nombre.trim() || /^NOMBRE$/i.test(nombre.trim()) || typeof obra !== "string") continue;
    out.push({ obra: obra.trim(), nombre: nombre.trim(), examen_fecha: isoDe(ef), examen_vence: isoDe(ev), alturas_fecha: isoDe(af), alturas_vence: isoDe(av) });
  }
  return out;
}
