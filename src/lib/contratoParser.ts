// Lector del contrato "Detallado por grupos" exportado desde SINCO ERP.
// Recibe las líneas de texto del PDF (ya agrupadas por renglón) y devuelve el contrato con la forma de la API
// (snake_case) más advertencias para que una persona lo valide antes de guardar.

export type ActividadLeida = {
  id?: string; item: string; grupo: number; capitulo: string; nombre: string; ubicacion: string; um: string;
  cantidad: number; valor_unitario: number; valor_total: number; tarifa?: number | null; advertencias: string[];
};
export type ContratoLeido = {
  numero: string; contratante: string; nit_contratante: string; contratista: string; proyecto: string; descripcion: string; tipo: string;
  fecha_inicio: string; fecha_fin: string; valor_total: number; valor_antes_aiu: number; aiu: number; pct_administracion: number; pct_imprevistos: number;
  pct_utilidad: number; iva_utilidad: number; pct_rete_garantia: number; rete_garantia: number; valor_neto: number; forma_pago: string;
  pagos: { fecha: string; valor: number; concepto: string }[]; actividades: ActividadLeida[]; advertencias: string[]; archivo: string;
};

const UM = "M2|M3|ML|UND|UN|GL|KG|M|DIA|HR|VJ";
const num = (s?: string) => { if (!s) return 0; const n = Number(s.replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };
const fecha = (s?: string) => { const m = s?.match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };
export const normalizarUM = (um: string) => { const u = um.toUpperCase(); return u === "UN" || u === "UND" ? "UND" : u; };
const CAPITULOS_EXCLUIDOS = /^(CANTIDADES DE OBRA|PROGRAMACI[ÓO]N DE PAGOS|VALOR|UNITARIO|ITEM)/i;

export function contratoVacio(): ContratoLeido {
  return { numero: "", contratante: "", nit_contratante: "", contratista: "", proyecto: "", descripcion: "", tipo: "Mano de Obra", fecha_inicio: "", fecha_fin: "", valor_total: 0,
    valor_antes_aiu: 0, aiu: 0, pct_administracion: 0, pct_imprevistos: 0, pct_utilidad: 0, iva_utilidad: 0, pct_rete_garantia: 0, rete_garantia: 0, valor_neto: 0,
    forma_pago: "CORTE DE OBRA", pagos: [], actividades: [], advertencias: [], archivo: "" };
}

export function parsearContratoSinco(lineas: string[]): ContratoLeido {
  const texto = lineas.join("\n");
  const buscar = (re: RegExp) => texto.match(re)?.[1]?.trim() ?? "";
  const advertencias: string[] = [];
  const c: ContratoLeido = {
    numero: buscar(/CONTRATO NO\.\s*(\d+)/i), contratante: buscar(/^Empresa\s+(.+)$/im), nit_contratante: buscar(/^NIT\s+([\d.-]+)/im),
    contratista: buscar(/Contratista\s*:\s*(.+?)\s+NIT/i), proyecto: "", descripcion: buscar(/Descripcion:\s*(.+)/i), tipo: buscar(/Tipo Contrato\s*:\s*(.+)/i),
    fecha_inicio: fecha(buscar(/Fecha Inicio:\s*([\d/]+)/i)), fecha_fin: fecha(buscar(/Fecha Terminacion:\s*([\d/]+)/i)),
    valor_total: num(buscar(/^Valor Total\s+([\d,.]+)/im)) || num(buscar(/Valor Contrato\s*:\s*([\d,.]+)/i)),
    valor_antes_aiu: num(buscar(/Valor Contrato Antes de AIU\s+([\d,.]+)/i)), aiu: num(buscar(/^AIU\s+([\d,.]+)/im)),
    pct_administracion: num(buscar(/% Administracion:\s*([\d.]+)\s*%/i)), pct_imprevistos: num(buscar(/% Imprevistos:\s*([\d.]+)\s*%/i)),
    pct_utilidad: num(buscar(/% Utilidad\s*:\s*([\d.]+)\s*%/i)), iva_utilidad: num(buscar(/^IVA Sobre Utilidad\s+([\d,.]+)/im)),
    pct_rete_garantia: num(buscar(/% Ret Garantias:\s*([\d.]+)\s*%/i)), rete_garantia: num(buscar(/Rete Garant[íi]a\s+([\d,.]+)/i)),
    valor_neto: num(buscar(/Valor Neto\s+([\d,.]+)/i)), forma_pago: buscar(/Forma de Pago:\s*(.+)/i), pagos: [], actividades: [], advertencias, archivo: "",
  };
  const iProy = lineas.findIndex((l) => /^Proyecto:/i.test(l));
  if (iProy >= 0) {
    const base = lineas[iProy].replace(/^Proyecto:\s*/i, "").replace(/^[\d\s-]+-\s*/, "");
    const sig = (lineas[iProy + 1] ?? "").split(/Tipo Contrato/i)[0].trim();
    c.proyecto = [base, sig].filter(Boolean).join(" ").trim();
  }
  const reGrupo = new RegExp(String.raw`^GRUPO No\.\s*(\d+)\s+(.+?)\s+(${UM})\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)$`, "i");
  const reItemUM = new RegExp(String.raw`\b(${UM})\s+1\s+[\d,.]+\s+[\d,.]+$`, "i");
  let capitulo = "";
  const fin = lineas.findIndex((l) => /Valor Contrato Antes de AIU/i.test(l));
  const cuerpo = lineas.slice(0, fin > 0 ? fin : lineas.length);
  for (let i = 0; i < cuerpo.length; i++) {
    const l = cuerpo[i];
    const g = l.match(reGrupo);
    if (!g) { if (/^[A-ZÑÁÉÍÓÚ ]{4,}$/.test(l) && !CAPITULOS_EXCLUIDOS.test(l) && !/^GRUPO/.test(l)) capitulo = l.trim(); continue; }
    const bloque: string[] = [];
    for (let j = i + 1; j < cuerpo.length && !reGrupo.test(cuerpo[j]); j++) {
      if (/^[A-ZÑÁÉÍÓÚ ]{4,}$/.test(cuerpo[j]) && !CAPITULOS_EXCLUIDOS.test(cuerpo[j])) break;
      bloque.push(cuerpo[j]);
    }
    const item = bloque.join(" ").match(/\b(\d{2}\.\d{3})\b/)?.[1] ?? "";
    const umItem = bloque.map((b) => b.match(reItemUM)?.[1]).find(Boolean);
    const cantidad = num(g[4]), valorUnitario = num(g[5]), valorTotal = num(g[6]), umGrupo = normalizarUM(g[3]);
    const adv: string[] = [];
    if (Math.abs(cantidad * valorUnitario - valorTotal) > 1) adv.push(`Cantidad × valor unitario no coincide con el total (${(cantidad * valorUnitario).toFixed(2)})`);
    if (umItem && normalizarUM(umItem) !== umGrupo) adv.push(`Unidad del grupo (${g[3]}) distinta a la del ítem (${umItem}). Confirme la unidad correcta.`);
    if (!item) adv.push("No se encontró el código del ítem");
    c.actividades.push({ item, grupo: Number(g[1]), capitulo, nombre: g[2].replace(/\s+/g, " ").trim(), ubicacion: detectarUbicacion(bloque), um: umGrupo, cantidad, valor_unitario: valorUnitario, valor_total: valorTotal, advertencias: adv });
  }
  const iPagos = lineas.findIndex((l) => /PROGRAMACI[ÓO]N DE PAGOS/i.test(l));
  if (iPagos >= 0) for (const l of lineas.slice(iPagos + 1)) {
    const m = l.match(/^(\d{2}\/\d{2}\/\d{4})\s+([\d,]+\.\d{2})\s*(.+)$/);
    if (m) c.pagos.push({ fecha: fecha(m[1]), valor: num(m[2]), concepto: m[3].trim() });
  }
  const suma = c.actividades.reduce((s, a) => s + a.valor_total, 0);
  if (c.actividades.length === 0) advertencias.push('No se encontraron actividades. ¿El PDF es un contrato SINCO "Detallado por grupos"?');
  else if (Math.abs(suma - c.valor_total) <= 1) advertencias.push("Los precios unitarios ya incluyen AIU e IVA (la suma de actividades es igual al valor total). El avance se valora directamente con esos precios.");
  else if (Math.abs(suma - c.valor_antes_aiu) <= 1) advertencias.push("Los precios unitarios NO incluyen AIU: el avance se valora antes de AIU.");
  else advertencias.push(`La suma de actividades (${suma.toFixed(2)}) no coincide con el valor del contrato. Revise antes de guardar.`);
  const sumaPagos = c.pagos.reduce((s, p) => s + p.valor, 0);
  if (c.pagos.length && c.rete_garantia && Math.abs(sumaPagos - c.valor_total) < 10) advertencias.push("La programación de pagos suma el valor total sin descontar la retención en garantía.");
  const fp = c.pagos.map((p) => p.fecha);
  if (new Set(fp).size < fp.length) advertencias.push("Hay pagos programados con la misma fecha.");
  if (!c.fecha_inicio || !c.fecha_fin) advertencias.push("No se encontraron las fechas de inicio y terminación.");
  return c;
}

function detectarUbicacion(bloque: string[]): string {
  for (let k = 0; k < bloque.length; k++) {
    const m = bloque[k].match(/\bTORRE\s*(\d{1,2})(?!\d)/i);
    if (m) return `TORRE ${m[1]}`;
    if (/\bTORRE\b/i.test(bloque[k])) { const sig = bloque.slice(k + 1).find((b) => /^\d{1,2}\s/.test(b)); if (sig) return `TORRE ${sig.match(/^(\d{1,2})/)![1]}`; }
  }
  return "";
}

/** Agrupa los fragmentos de texto de pdf.js en renglones (por coordenada Y). */
export function agruparRenglones(items: { str: string; x: number; y: number }[]): string[] {
  const filas: { y: number; partes: { x: number; s: string }[] }[] = [];
  for (const it of items) {
    if (!it.str.trim()) continue;
    let f = filas.find((r) => Math.abs(r.y - it.y) <= 2);
    if (!f) filas.push((f = { y: it.y, partes: [] }));
    f.partes.push({ x: it.x, s: it.str });
  }
  return filas.sort((a, b) => b.y - a.y)
    .map((f) => f.partes.sort((a, b) => a.x - b.x).map((p) => p.s).join(" ").replace(/\s+/g, " ").replace(/\s+:/g, " :").trim()).filter(Boolean);
}
