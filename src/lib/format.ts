import type { EstadoLic } from "./types";

export const fecha = (s?: string | null) =>
  s ? new Date(s.length === 10 ? s + "T00:00:00" : s).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const fechaHora = (s?: string | null) =>
  s ? new Date(s).toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export const ESTADO_TEXTO: Record<EstadoLic, string> = {
  prueba: "Prueba", activa: "Activa", por_vencer: "Por vencer", gracia: "En gracia",
  vencida: "Vencida", suspendida: "Suspendida", cancelada: "Cancelada", sin_licencia: "Sin licencia",
};
export const ESTADO_TONO: Record<EstadoLic, "verde" | "ambar" | "rojo" | "gris" | "azul"> = {
  prueba: "azul", activa: "verde", por_vencer: "ambar", gracia: "ambar", vencida: "rojo", suspendida: "rojo", cancelada: "gris", sin_licencia: "gris",
};
export const TIPO_TEXTO: Record<string, string> = { prueba: "Prueba", periodo: "Por periodo", hasta_fecha: "Hasta una fecha", ilimitada: "Ilimitada" };
export const ROL_TEXTO: Record<string, string> = {
  super_admin: "Super admin", soporte: "Soporte", admin: "Administrador", gerencia: "Gerencia", rrhh: "RRHH", sst: "Encargado SST", residente: "Ingeniero residente",
};
export const limiteTexto = (n: number | null | undefined) => (n == null ? "Sin límite" : String(n));

// ---- Cifras de negocio ----
const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
export const fmtCOP = (n: number) => cop.format(Math.round(n));
export const fmtMillones = (n: number) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M` : fmtCOP(n));
export const fmtNum = (n: number, dec = 2) => n.toLocaleString("es-CO", { maximumFractionDigits: dec });
export const fmtPct = (n: number, dec = 0) => `${(n * 100).toLocaleString("es-CO", { maximumFractionDigits: dec })} %`;
export const fechaCorta = (f?: string | null) => {
  if (!f) return "—";
  const [y, m, d] = f.slice(0, 10).split("-").map(Number);
  return `${d} ${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][m - 1]} ${y}`;
};
export const SEMAFORO_TEXTO: Record<string, string> = { "al-dia": "Al día", atencion: "Atención", atrasada: "Atrasada", "sin-contrato": "Sin contrato" };
export const SEMAFORO_TONO: Record<string, "verde" | "ambar" | "rojo" | "gris"> = { "al-dia": "verde", atencion: "ambar", atrasada: "rojo", "sin-contrato": "gris" };
