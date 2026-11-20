// Utilidades de fecha sobre cadenas ISO (YYYY-MM-DD), calculadas en UTC para evitar desfases de zona horaria.
export type Fecha = string;

export const aDate = (f: Fecha): Date => { const [y, m, d] = f.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export const aISO = (d: Date): Fecha => d.toISOString().slice(0, 10);
export const hoy = (): Fecha => { const d = new Date(); return aISO(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))); };
export const sumarDias = (f: Fecha, n: number): Fecha => { const d = aDate(f); d.setUTCDate(d.getUTCDate() + n); return aISO(d); };
export const diasEntre = (a: Fecha, b: Fecha): number => Math.round((aDate(b).getTime() - aDate(a).getTime()) / 86400000);
/** 0 = domingo … 6 = sábado */
export const diaSemana = (f: Fecha): number => aDate(f).getUTCDay();
export const rango = (desde: Fecha, hasta: Fecha): Fecha[] => { const o: Fecha[] = []; for (let f = desde; f <= hasta; f = sumarDias(f, 1)) o.push(f); return o; };
export const finDeMes = (anio: number, mes: number): Fecha => aISO(new Date(Date.UTC(anio, mes, 0)));
export const inicioDeMes = (anio: number, mes: number): Fecha => `${anio}-${String(mes).padStart(2, "0")}-01`;

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const nombreMes = (m: number) => MESES[m - 1];
export const nombreDia = (f: Fecha) => DIAS[diaSemana(f)];
export const fechaLarga = (f: Fecha): string => { const d = aDate(f); return `${nombreDia(f)} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`; };

// ---- Festivos de Colombia (Ley 51 de 1983, Ley Emiliani) ----
function domingoPascua(anio: number): Fecha {
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
const alLunes = (f: Fecha): Fecha => { const ds = diaSemana(f); return ds === 1 ? f : sumarDias(f, (8 - ds) % 7); };
export type Festivo = { fecha: Fecha; nombre: string };
const cache = new Map<number, Festivo[]>();
export function festivosColombia(anio: number): Festivo[] {
  const c = cache.get(anio); if (c) return c;
  const f = (m: number, d: number) => `${anio}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const p = domingoPascua(anio);
  const lista: Festivo[] = [
    { fecha: f(1, 1), nombre: "Año Nuevo" }, { fecha: alLunes(f(1, 6)), nombre: "Reyes Magos" }, { fecha: alLunes(f(3, 19)), nombre: "San José" },
    { fecha: sumarDias(p, -3), nombre: "Jueves Santo" }, { fecha: sumarDias(p, -2), nombre: "Viernes Santo" }, { fecha: f(5, 1), nombre: "Día del Trabajo" },
    { fecha: sumarDias(p, 43), nombre: "Ascensión del Señor" }, { fecha: sumarDias(p, 64), nombre: "Corpus Christi" }, { fecha: sumarDias(p, 71), nombre: "Sagrado Corazón" },
    { fecha: alLunes(f(6, 29)), nombre: "San Pedro y San Pablo" }, { fecha: f(7, 20), nombre: "Independencia" }, { fecha: f(8, 7), nombre: "Batalla de Boyacá" },
    { fecha: alLunes(f(8, 15)), nombre: "Asunción de la Virgen" }, { fecha: alLunes(f(10, 12)), nombre: "Día de la Raza" }, { fecha: alLunes(f(11, 1)), nombre: "Todos los Santos" },
    { fecha: alLunes(f(11, 11)), nombre: "Independencia de Cartagena" }, { fecha: f(12, 8), nombre: "Inmaculada Concepción" }, { fecha: f(12, 25), nombre: "Navidad" },
  ].sort((a, b) => a.fecha.localeCompare(b.fecha));
  cache.set(anio, lista);
  return lista;
}
export function esFestivo(f: Fecha, extra: Fecha[] = []): Festivo | undefined {
  return festivosColombia(Number(f.slice(0, 4))).find((x) => x.fecha === f) ?? (extra.includes(f) ? { fecha: f, nombre: "Festivo adicional" } : undefined);
}
