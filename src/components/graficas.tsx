"use client";
import type { ReactNode } from "react";
import { cx } from "./ui";

/** Colores semánticos para series categóricas (no dependen de la marca: estados de licencia, severidades…) */
export const COLOR_ESTADO = {
  ok: "#137a3a",
  info: "var(--grafica-1)",
  alerta: "#c27a0e",
  error: "#c62828",
  neutro: "#8b93a7",
} as const;

type Entrada = { name?: string | number; value?: number | string; color?: string; payload?: Record<string, unknown>; dataKey?: string | number };

/**
 * Tooltip uniforme para todas las gráficas: tarjeta blanca, sombra suave, cifras tabulares.
 * `formato` convierte el valor; `titulo` sobreescribe la etiqueta del eje.
 */
export function TooltipGrafica({ active, payload, label, formato, titulo }: { active?: boolean; payload?: Entrada[]; label?: string | number; formato?: (v: number, nombre: string) => string; titulo?: (label: string | number | undefined, p?: Record<string, unknown>) => ReactNode }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-40 rounded-xl border border-borde bg-white px-3 py-2.5 text-sm shadow-lg">
      <p className="mb-1.5 font-semibold text-tinta">{titulo ? titulo(label, payload[0]?.payload) : label}</p>
      <ul className="space-y-1">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-suave">
              <span aria-hidden className="size-2.5 rounded-sm" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="num font-semibold text-tinta">{formato ? formato(Number(p.value), String(p.name)) : p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Leyenda interactiva: cada ítem es un botón que resalta o filtra su serie */
export function Leyenda({ items, activo, onActivar, className }: { items: { clave: string; texto: string; color: string; valor?: ReactNode }[]; activo?: string | null; onActivar?: (clave: string | null) => void; className?: string }) {
  return (
    <ul className={cx("flex flex-wrap gap-1.5", className)}>
      {items.map((it) => {
        const sel = activo === it.clave;
        const atenuado = activo != null && !sel;
        return (
          <li key={it.clave}>
            <button type="button" aria-pressed={sel} onClick={() => onActivar?.(sel ? null : it.clave)}
              className={cx("inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-all duration-150",
                sel ? "border-marca-texto bg-marca-50 text-tinta" : "border-borde bg-white text-suave hover:border-borde-campo/60 hover:text-tinta",
                atenuado && "opacity-60")}>
              <span aria-hidden className="size-2.5 rounded-full" style={{ background: it.color }} />
              {it.texto}
              {it.valor != null && <span className="num font-semibold text-tinta">{it.valor}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Contenedor de gráfica con alto fijo (evita saltos de diseño mientras carga) */
export function MarcoGrafica({ alto = 260, children, etiqueta }: { alto?: number; children: ReactNode; etiqueta: string }) {
  return <div role="img" aria-label={etiqueta} style={{ height: alto }} className="w-full min-w-0">{children}</div>;
}
