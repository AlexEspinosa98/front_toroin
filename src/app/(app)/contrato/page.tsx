"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { fechaCorta, fmtMillones, fmtPct } from "@/lib/format";
import type { ResumenObraT } from "@/lib/types";
import { Aviso, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { BarraAvance, ChipSemaforo } from "@/components/comunes";

type Fila = { obra: { id: string; nombre: string; ciudad: string }; resumen: ResumenObraT; contrato: { numero: string; contratante: string; fecha_inicio: string; fecha_fin: string; valor_total: number } | null; actividades: number };

export default function Contratos() {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<Fila[]>("contratos").then(setFilas).catch((e) => setError(e.message)); }, []);
  return (
    <>
      <Titulo sub="Contrato, actividades y avance de cada obra">Contrato y tablero</Titulo>
      {error && <Aviso tono="error">{error}</Aviso>}
      {filas && filas.length === 0 && <Vacio>Primero cree una obra.</Vacio>}
      <div className="grid gap-4 md:grid-cols-2">
        {filas?.map((f) => (
          <Link key={f.obra.id} href={`/obras/${f.obra.id}`} className="block">
            <Tarjeta titulo={f.obra.nombre} acciones={<ChipSemaforo s={f.resumen.semaforo} />}>
              {f.contrato ? (
                <>
                  <p className="text-sm text-slate-500">Contrato {f.contrato.numero || "—"} · {f.contrato.contratante || "—"}</p>
                  <p className="text-sm text-slate-500">{fechaCorta(f.contrato.fecha_inicio)} – {fechaCorta(f.contrato.fecha_fin)} · {f.actividades} actividades</p>
                  <div className="mt-3 flex items-center gap-2"><BarraAvance valor={f.resumen.avance_fisico} etiqueta={`Avance de ${f.obra.nombre}`} /><span className="w-14 text-right text-sm font-semibold">{fmtPct(f.resumen.avance_fisico, 1)}</span></div>
                  <p className="mt-1 text-xs text-slate-500">Esperado {fmtPct(f.resumen.avance_tiempo, 1)} · {fmtMillones(f.resumen.valor_ejecutado)} de {fmtMillones(f.resumen.valor_contrato)}</p>
                </>
              ) : <p className="text-sm text-slate-500">Sin contrato cargado. Toque para cargarlo.</p>}
            </Tarjeta>
          </Link>
        ))}
      </div>
    </>
  );
}
