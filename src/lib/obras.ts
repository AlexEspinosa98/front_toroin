"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./client";

export type ObraBasica = { id: string; nombre: string; ciudad: string; estado: string };
const CLAVE = "obraActiva";

/**
 * Lista de obras y obra seleccionada. La última obra usada se recuerda entre pantallas
 * (Asistencia, Bitácora, Finanzas, EPP…) para no tener que elegirla de nuevo cada vez.
 * Con `todas` la opción por defecto es «todas las obras» (cadena vacía) y no se usa la recordada.
 */
export function useObras({ todas = false }: { todas?: boolean } = {}) {
  const [obras, setObras] = useState<ObraBasica[] | null>(null);
  const [obraId, setObra] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    api<ObraBasica[]>("obras")
      .then((o) => {
        setObras(o);
        let guardada = "";
        try { guardada = localStorage.getItem(CLAVE) ?? ""; } catch { /* sin almacenamiento */ }
        setObra((x) => x || (todas ? "" : o.some((y) => y.id === guardada) ? guardada : o[0]?.id ?? ""));
      })
      .catch((e) => setError(e.message));
  }, [todas]);
  const setObraId = useCallback((id: string) => {
    setObra(id);
    if (id) try { localStorage.setItem(CLAVE, id); } catch { /* sin almacenamiento */ }
  }, []);
  return { obras: obras ?? [], cargando: obras === null && !error, obraId, setObraId, error };
}
