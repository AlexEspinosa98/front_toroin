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
