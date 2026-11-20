"use client";
import { useEffect, useState } from "react";
import { BellRing, CircleCheck } from "lucide-react";
import { api } from "@/lib/client";
import type { Alerta } from "@/lib/types";
import { Aviso, Chip, Titulo, Vacio } from "@/components/ui";
import { FilaAlerta } from "@/components/comunes";

export type { Alerta };

export default function Alertas() {
  const [d, setD] = useState<{ total: number; altas: number; alertas: Alerta[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<NonNullable<typeof d>>("alertas").then(setD).catch((e) => setError(e.message)); }, []);
  return (
    <>
      <Titulo sub="Lo que necesita su atención hoy; se actualiza cada vez que entra"
        acciones={d && d.total > 0 ? <Chip tono={d.altas ? "error" : "alerta"} icono={<BellRing className="size-3.5" aria-hidden />}>{d.total} pendiente{d.total === 1 ? "" : "s"}{d.altas ? ` · ${d.altas} urgente${d.altas === 1 ? "" : "s"}` : ""}</Chip> : undefined}>Alertas</Titulo>
      {error && <Aviso tono="error">{error}</Aviso>}
      {d && !d.alertas.length && <Vacio icono={<CircleCheck className="size-6 text-ok" aria-hidden />} titulo="Todo en orden" texto="No hay alertas pendientes." />}
      <div className="grid gap-3">{d?.alertas.map((a, i) => <FilaAlerta key={i} a={a} />)}</div>
    </>
  );
}
