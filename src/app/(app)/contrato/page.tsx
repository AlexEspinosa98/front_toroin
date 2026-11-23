"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, FilePlus2, FileText } from "lucide-react";
import { api } from "@/lib/client";
import { fechaCorta, fmtMillones, fmtPct } from "@/lib/format";
import type { ResumenObraT } from "@/lib/types";
import { Aviso, Esqueleto, Tarjeta, Titulo, Vacio } from "@/components/ui";
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
      {!filas && !error && <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((i) => <Esqueleto key={i} className="h-40" />)}</div>}
      {filas && filas.length === 0 && (
        <Vacio icono={<FileText className="size-6" aria-hidden />} titulo="Aún no hay obras" texto="Primero cree una obra; después podrá cargar su contrato y ver el tablero." />
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {filas?.map((f) => (
          <Link key={f.obra.id} href={`/obras/${f.obra.id}`} className="group block rounded-xl transition-shadow duration-150 hover:shadow-md focus-visible:shadow-md">
            <Tarjeta className="h-full transition-colors duration-150 group-hover:border-marca/40" titulo={f.obra.nombre} sub={f.obra.ciudad}
              acciones={<span className="flex items-center gap-1"><ChipSemaforo s={f.resumen.semaforo} /><ChevronRight className="size-4 text-suave transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden /></span>}>
              {f.contrato ? (
                <>
                  <p className="text-sm text-suave">Contrato {f.contrato.numero || "—"} · {f.contrato.contratante || "—"}</p>
                  <p className="text-sm text-suave">{fechaCorta(f.contrato.fecha_inicio)} – {fechaCorta(f.contrato.fecha_fin)} · {f.actividades} actividades</p>
                  <div className="mt-3 flex items-center gap-2"><BarraAvance valor={f.resumen.avance_fisico} meta={f.resumen.avance_tiempo} etiqueta={`Avance de ${f.obra.nombre}`} /><span className="num w-14 text-right text-sm font-semibold">{fmtPct(f.resumen.avance_fisico, 1)}</span></div>
                  <p className="mt-1 text-xs text-suave">Esperado {fmtPct(f.resumen.avance_tiempo, 1)} · {fmtMillones(f.resumen.valor_ejecutado)} de {fmtMillones(f.resumen.valor_contrato)}</p>
                </>
              ) : (
                <p className="flex items-center gap-2 text-sm font-medium text-marca-texto"><FilePlus2 className="size-4" aria-hidden /> Sin contrato cargado. Toque para cargarlo.</p>
              )}
            </Tarjeta>
          </Link>
        ))}
      </div>
    </>
  );
}
