"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { SEMAFORO_TEXTO, SEMAFORO_TONO } from "@/lib/format";
import type { ActividadT } from "@/lib/types";
import { Insignia } from "./ui";

export const ChipSemaforo = ({ s }: { s: string }) => <Insignia tono={SEMAFORO_TONO[s] ?? "gris"}>{SEMAFORO_TEXTO[s] ?? s}</Insignia>;
export const nombreActividad = (a: Pick<ActividadT, "nombre" | "ubicacion">) => (a.ubicacion ? `${a.nombre} · ${a.ubicacion}` : a.nombre);

export function BarraAvance({ valor, etiqueta, ok }: { valor: number; etiqueta: string; ok?: boolean }) {
  const p = Math.max(0, Math.min(1, valor));
  return (
    <div role="progressbar" aria-label={etiqueta} aria-valuenow={Math.round(p * 100)} aria-valuemin={0} aria-valuemax={100} className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div className={`h-full rounded-full ${ok || p >= 1 ? "bg-green-600" : "bg-marca"}`} style={{ width: `${p * 100}%` }} />
    </div>
  );
}

export function Indicador({ etiqueta, valor, detalle, tono }: { etiqueta: string; valor: React.ReactNode; detalle?: React.ReactNode; tono?: "ok" | "alerta" | "error" }) {
  const c = tono === "error" ? "text-red-700" : tono === "alerta" ? "text-amber-700" : tono === "ok" ? "text-green-700" : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold text-slate-500">{etiqueta}</p>
      <p className={`text-xl font-extrabold ${c}`}>{valor}</p>
      {detalle && <p className="truncate text-xs text-slate-500">{detalle}</p>}
    </div>
  );
}

export function SinContrato({ obraId }: { obraId: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
      <p className="font-semibold">Esta obra aún no tiene contrato cargado</p>
      <p className="mt-1 text-sm text-slate-500">Cargue el contrato para tener las actividades, el tablero de avance y la bitácora.</p>
      <Link href={`/obras/${obraId}/contrato`} className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-marca px-4 text-sm font-semibold text-sobre-marca">Cargar contrato</Link>
    </div>
  );
}

/** Foto guardada (base64) cargada bajo demanda. */
export function Miniatura({ id, onQuitar }: { id: string; onQuitar?: () => void }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => { let vivo = true; api<{ datos: string }>(`fotos/${id}`).then((f) => vivo && setUri(f.datos)).catch(() => {}); return () => { vivo = false; }; }, [id]);
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
      {uri /* eslint-disable-next-line @next/next/no-img-element */ ? <img src={uri} alt="Foto de la actividad" className="size-full object-cover" /> : <div className="size-full animate-pulse" />}
      {onQuitar && <button type="button" onClick={onQuitar} aria-label="Quitar foto" className="absolute right-1 top-1 grid size-8 place-items-center rounded-full bg-black/60 text-white">✕</button>}
    </div>
  );
}
