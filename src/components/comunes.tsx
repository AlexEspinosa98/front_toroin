"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, CircleCheck, CircleX, Clock, FileUp, Info, ShieldAlert, TriangleAlert, X } from "lucide-react";
import { api } from "@/lib/client";
import { SEMAFORO_TEXTO } from "@/lib/format";
import type { ActividadT, Alerta } from "@/lib/types";
import { Campo, Chip, cx, Select, TONOS, Vacio, type Tono } from "./ui";
import type { ObraBasica } from "@/lib/obras";

const SEMAFORO = {
  "al-dia": { tono: "ok" as const, icono: <CircleCheck className="size-3.5" aria-hidden /> },
  atencion: { tono: "alerta" as const, icono: <Clock className="size-3.5" aria-hidden /> },
  atrasada: { tono: "error" as const, icono: <TriangleAlert className="size-3.5" aria-hidden /> },
  "sin-contrato": { tono: "neutro" as const, icono: <FileUp className="size-3.5" aria-hidden /> },
};
export const ChipSemaforo = ({ s }: { s: string }) => {
  const m = SEMAFORO[s as keyof typeof SEMAFORO] ?? { tono: "neutro" as const, icono: null };
  return <Chip tono={m.tono} icono={m.icono}>{SEMAFORO_TEXTO[s] ?? s}</Chip>;
};

export const nombreActividad = (a: Pick<ActividadT, "nombre" | "ubicacion">) => (a.ubicacion ? `${a.nombre} · ${a.ubicacion}` : a.nombre);

/** Barra de avance con marca opcional de "avance esperado según el tiempo" (bullet chart). */
export function BarraAvance({ valor, meta, etiqueta, ok, tono }: { valor: number; meta?: number; etiqueta: string; ok?: boolean; tono?: "marca" | "ok" | "alerta" | "error" }) {
  const p = Math.max(0, Math.min(1, valor)) * 100;
  const t = tono ?? (ok || p >= 100 ? "ok" : "marca");
  const color = { marca: "bg-marca-texto", ok: "bg-ok", alerta: "bg-alerta", error: "bg-error" }[t];
  return (
    <div className="relative h-2.5 w-full rounded-full bg-marca-100" role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100} aria-label={etiqueta}>
      <div className={cx("h-full rounded-full transition-[width] duration-300", color)} style={{ width: `${p}%` }} />
      {meta !== undefined && (
        <div className="absolute -top-1 h-[18px] w-[3px] rounded-full bg-tinta" style={{ left: `calc(${Math.max(0, Math.min(1, meta)) * 100}% - 1.5px)` }} title="Avance esperado según el tiempo" aria-hidden />
      )}
    </div>
  );
}

/** Indicador (KPI). El tono colorea la cifra y el ícono. */
export function Indicador({ etiqueta, valor, detalle, tono, icono, href }: { etiqueta: string; valor: ReactNode; detalle?: ReactNode; tono?: "ok" | "alerta" | "error" | "acento"; icono?: ReactNode; href?: string }) {
  const cifra = tono === "error" ? "text-error" : tono === "alerta" ? "text-alerta" : tono === "ok" ? "text-ok" : "text-tinta";
  const contenido = (
    <>
      <div className="flex min-h-8 items-center justify-between gap-2">
        <p className="text-sm font-medium text-suave">{etiqueta}</p>
        {icono && <span className={cx("rounded-lg p-1.5", TONOS[(tono ?? "info") as Tono])}>{icono}</span>}
      </div>
      <p className={cx("num mt-1 text-2xl font-extrabold tracking-tight", cifra)}>{valor}</p>
      {detalle && <div className="mt-0.5 text-sm text-suave">{detalle}</div>}
      {href && <ChevronRight aria-hidden className="absolute bottom-3.5 right-3.5 size-4 text-suave opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100" />}
    </>
  );
  const base = "relative min-w-0 rounded-xl border border-borde bg-tarjeta p-4";
  if (href) return <Link href={href} className={cx(base, "group block transition-[border-color,box-shadow] duration-150 hover:border-marca/35 hover:shadow-md")}>{contenido}</Link>;
  return <div className={base}>{contenido}</div>;
}

export function SinContrato({ obraId }: { obraId: string }) {
  return (
    <Vacio
      icono={<FileUp className="size-6" aria-hidden />}
      titulo="Esta obra aún no tiene contrato cargado"
      texto="Cargue el contrato para extraer las actividades, unidades, cantidades y el plazo de ejecución; con eso se habilitan el tablero de avance y la bitácora."
      accion={
        <Link href={`/obras/${obraId}/contrato`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-marca px-4 text-[15px] font-semibold text-sobre-marca shadow-sm transition-colors hover:bg-marca-700">
          <FileUp className="size-4" aria-hidden /> Cargar contrato
        </Link>
      }
    />
  );
}

/** Foto guardada (base64) cargada bajo demanda. */
export function Miniatura({ id, onQuitar }: { id: string; onQuitar?: () => void }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => { let vivo = true; api<{ datos: string }>(`fotos/${id}`).then((f) => vivo && setUri(f.datos)).catch(() => {}); return () => { vivo = false; }; }, [id]);
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg bg-marca-50">
      {uri  ? <img src={uri} alt="Foto de la actividad" className="size-full object-cover" /> : <div className="size-full animate-pulse bg-marca-100/60" />}
      {onQuitar && (
        <button type="button" onClick={onQuitar} aria-label="Quitar foto" className="group absolute right-0 top-0 grid size-11 place-items-center">
          <span className="grid size-7 place-items-center rounded-full bg-black/65 text-white group-hover:bg-black/80"><X className="size-4" aria-hidden /></span>
        </button>
      )}
    </div>
  );
}

const SEVERIDAD = {
  alta: { tono: "error" as const, texto: "Urgente", icono: TriangleAlert },
  media: { tono: "alerta" as const, texto: "Atención", icono: Clock },
  baja: { tono: "neutro" as const, texto: "Informativa", icono: Info },
};
/** Fila de alerta: ícono por severidad, título, detalle y flecha de navegación. */
export function FilaAlerta({ a, compacta }: { a: Alerta; compacta?: boolean }) {
  const s = SEVERIDAD[a.severidad];
  return (
    <Link href={a.href} className={cx("group flex items-start gap-3 rounded-lg transition-colors hover:bg-marca-50", compacta ? "-mx-2 px-2 py-2.5" : "border border-borde bg-tarjeta p-4 hover:border-marca/40")}>
      <span className={cx("mt-0.5 shrink-0 rounded-lg p-1.5", TONOS[s.tono])}><s.icono className="size-4" aria-hidden /></span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2"><strong className="text-sm text-tinta">{a.titulo}</strong>{!compacta && <Chip tono={s.tono}>{s.texto}</Chip>}</span>
        <span className="block text-sm text-suave">{a.detalle}</span>
      </span>
      <ChevronRight className="mt-1 size-4 shrink-0 text-suave transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

const HABILITACION = {
  habilitado: { tono: "ok" as const, texto: "Habilitado", icono: <CircleCheck className="size-3.5" aria-hidden /> },
  "por-vencer": { tono: "alerta" as const, texto: "Por vencer", icono: <Clock className="size-3.5" aria-hidden /> },
  vencido: { tono: "error" as const, texto: "No habilitado", icono: <CircleX className="size-3.5" aria-hidden /> },
  "sin-datos": { tono: "neutro" as const, texto: "Sin datos", icono: <ShieldAlert className="size-3.5" aria-hidden /> },
};
/** Estado de habilitación (examen médico y curso de alturas) con ícono además del color. */
export const ChipHabilitacion = ({ e }: { e: keyof typeof HABILITACION }) => {
  const m = HABILITACION[e] ?? HABILITACION["sin-datos"];
  return <Chip tono={m.tono} icono={m.icono}>{m.texto}</Chip>;
};

/** Selector de obra (recuerda la última usada). Con `todas` agrega la opción «Todas las obras». */
export function SelectorObra({ obras, valor, onChange, todas, className }: { obras: Pick<ObraBasica, "id" | "nombre">[]; valor: string; onChange: (id: string) => void; todas?: boolean; className?: string }) {
  return (
    <Campo etiqueta="Obra" className={className}>
      <Select value={valor} onChange={(e) => onChange(e.target.value)} className="font-semibold text-tinta">
        {todas && <option value="">Todas las obras</option>}
        {!todas && obras.length === 0 && <option value="">Sin obras</option>}
        {obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
      </Select>
    </Campo>
  );
}
