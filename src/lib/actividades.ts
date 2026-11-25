import type { ActividadT } from "./types";

/** Ítems del contrato (los subítems van colgados de ellos). */
export const soloItems = (acts: ActividadT[]) => acts.filter((a) => !a.padre_id);

/** Subítems de un ítem, en el orden en que vienen. */
export const subitemsDe = (acts: ActividadT[], padreId: string) => acts.filter((a) => a.padre_id === padreId);

/** Lo que el cliente paga por cada unidad de la actividad; en un subítem se deriva de lo que representa del ítem. */
export function valorUnitario(a: ActividadT, acts: ActividadT[]): number {
  if (!a.padre_id) return a.valor_unitario;
  const padre = acts.find((x) => x.id === a.padre_id);
  if (!padre || !a.aporta_avance || !a.cantidad) return 0;
  return (a.equivale * padre.valor_unitario) / a.cantidad;
}

/** Dónde se registra el avance: los ítems medidos por subítems ya no reciben avance directo. */
export const registrables = (acts: ActividadT[]) => acts.filter((a) => a.registrable);
