"use client";
import { createContext, useCallback, useContext, useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ESTADO_TEXTO, ESTADO_TONO } from "@/lib/format";
import type { EstadoLic } from "@/lib/types";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Boton({ variante = "primario", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "primario" | "secundario" | "peligro" | "fantasma" }) {
  const v = {
    primario: "bg-marca text-sobre-marca hover:opacity-90",
    secundario: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
    peligro: "bg-red-600 text-white hover:bg-red-700",
    fantasma: "text-slate-700 hover:bg-slate-100",
  }[variante];
  return <button {...p} className={cx("min-h-11 rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50", v, className)} />;
}

export function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-700">{etiqueta}</span>
      {children}
      {ayuda && <span className="text-xs text-slate-500">{ayuda}</span>}
    </label>
  );
}
const base = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 disabled:bg-slate-100";
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(base, p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(base, p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(base, "min-h-24 py-2", p.className)} />;

export function Tarjeta({ titulo, acciones, children, className }: { titulo?: ReactNode; acciones?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5", className)}>
      {(titulo || acciones) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {titulo && <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>}
          {acciones}
        </header>
      )}
      {children}
    </section>
  );
}

const tonos = {
  verde: "bg-emerald-100 text-emerald-800", ambar: "bg-amber-100 text-amber-900", rojo: "bg-red-100 text-red-800",
  gris: "bg-slate-100 text-slate-700", azul: "bg-sky-100 text-sky-800",
};
export const Insignia = ({ tono = "gris", children }: { tono?: keyof typeof tonos; children: ReactNode }) => (
  <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", tonos[tono])}>{children}</span>
);
export const InsigniaEstado = ({ estado }: { estado: EstadoLic }) => <Insignia tono={ESTADO_TONO[estado]}>{ESTADO_TEXTO[estado]}</Insignia>;

export function Titulo({ children, sub, acciones }: { children: ReactNode; sub?: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 tabIndex={-1} className="text-2xl font-bold text-slate-900">{children}</h1>
        {sub && <p className="mt-1 text-sm text-slate-600">{sub}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  );
}

export function Aviso({ tono = "info", children }: { tono?: "info" | "alerta" | "error" | "ok"; children: ReactNode }) {
  const t = { info: "border-sky-200 bg-sky-50 text-sky-900", alerta: "border-amber-300 bg-amber-50 text-amber-900", error: "border-red-200 bg-red-50 text-red-800", ok: "border-emerald-200 bg-emerald-50 text-emerald-900" }[tono];
  return <div role={tono === "error" ? "alert" : "status"} className={cx("rounded-lg border px-4 py-3 text-sm", t)}>{children}</div>;
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{children}</p>;
}

export function Modal({ abierto, titulo, onCerrar, children }: { abierto: boolean; titulo: string; onCerrar: () => void; children: ReactNode }) {
  const id = useId();
  useEffect(() => {
    if (!abierto) return;
    const f = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [abierto, onCerrar]);
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-slate-900/50 sm:place-items-center" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div role="dialog" aria-modal="true" aria-labelledby={id} className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-xl sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={id} className="text-lg font-semibold">{titulo}</h2>
          <button onClick={onCerrar} aria-label="Cerrar" className="grid size-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---- Avisos temporales ----
type Aviso = { id: number; tono: "ok" | "error"; texto: string };
const ToastCtx = createContext<(texto: string, tono?: "ok" | "error") => void>(() => {});
export const useAviso = () => useContext(ToastCtx);
export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Aviso[]>([]);
  const poner = useCallback((texto: string, tono: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, tono, texto }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), tono === "error" ? 6000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={poner}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 left-1/2 z-[60] flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col gap-2">
        {items.map((i) => (
          <div key={i.id} className={cx("rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg", i.tono === "ok" ? "bg-emerald-700" : "bg-red-700")}>{i.texto}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function Interruptor({ activo, onChange, etiqueta, disabled }: { activo: boolean; onChange: (v: boolean) => void; etiqueta: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={activo} aria-label={etiqueta} disabled={disabled} onClick={() => onChange(!activo)}
      className={cx("relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50", activo ? "bg-emerald-600" : "bg-slate-300")}>
      <span className={cx("absolute top-0.5 size-6 rounded-full bg-white shadow transition-all", activo ? "left-[1.4rem]" : "left-0.5")} />
    </button>
  );
}

export function Tabla({ cabeceras, children }: { cabeceras: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>{cabeceras.map((c) => <th key={c} className="px-3 py-2.5 font-semibold">{c}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}
