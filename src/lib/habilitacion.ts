import { diasEntre, hoy, type Fecha } from "./fechas";

/** Habilitación SST: examen médico y curso de alturas vigentes (alerta a 30 días). Misma regla que el servidor. */
export type EstadoHab = "habilitado" | "por-vencer" | "vencido" | "sin-datos";
export type Hab = { estado: EstadoHab; motivo: string; diasExamen?: number; diasAlturas?: number };
export const DIAS_ALERTA = 30;

type Fechas = { examen_fecha: string | null; examen_vence: string | null; alturas_fecha: string | null; alturas_vence: string | null };

export function habilitacion(t: Fechas, fecha: Fecha = hoy()): Hab {
  if (!t.examen_vence || !t.alturas_vence) return { estado: "sin-datos", motivo: "Faltan fechas de examen o curso de alturas" };
  const de = diasEntre(fecha, t.examen_vence);
  const da = diasEntre(fecha, t.alturas_vence);
  const antesExamen = !!t.examen_fecha && fecha < t.examen_fecha;
  const antesAlturas = !!t.alturas_fecha && fecha < t.alturas_fecha;
  if (de < 0 || antesExamen) return { estado: "vencido", diasExamen: de, diasAlturas: da, motivo: antesExamen ? "Examen médico aún no realizado" : `Examen médico vencido hace ${-de} días` };
  if (da < 0 || antesAlturas) return { estado: "vencido", diasExamen: de, diasAlturas: da, motivo: antesAlturas ? "Curso de alturas aún no realizado" : `Curso de alturas vencido hace ${-da} días` };
  if (Math.min(de, da) <= DIAS_ALERTA) return { estado: "por-vencer", diasExamen: de, diasAlturas: da, motivo: de <= da ? `Examen médico vence en ${de} días` : `Curso de alturas vence en ${da} días` };
  return { estado: "habilitado", diasExamen: de, diasAlturas: da, motivo: "Examen y curso de alturas vigentes" };
}
