"use client";
import {
  cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from "react";
import { CircleAlert, CircleCheck, Info, Inbox, Search, TriangleAlert, X } from "lucide-react";
import { ESTADO_TEXTO, ESTADO_TONO } from "@/lib/format";
import type { EstadoLic } from "@/lib/types";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Las gráficas respetan la preferencia de movimiento reducido del sistema */
export const ANIMAR = typeof window === "undefined" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Colores de gráficas (marcas no textuales ≥3:1 sobre blanco). Se derivan del color de la empresa. */
export const COLOR_GRAFICA = { uno: "var(--grafica-1)", dos: "var(--grafica-2)", rejilla: "#e1e5ee", eje: "#525a70" };

/** Tras un envío fallido, lleva el foco al primer campo con error (WCAG: focus-management) */
export function enfocarPrimerError(contenedor?: Element | null) {
  requestAnimationFrame(() => {
    const el = (contenedor ?? document).querySelector<HTMLElement>('[aria-invalid="true"], [data-error="true"]');
    el?.focus();
    el?.scrollIntoView({ block: "center", behavior: ANIMAR ? "smooth" : "auto" });
  });
}

// ---------------- Botón ----------------
type Variante = "primario" | "secundario" | "peligro" | "fantasma";
export function Boton({
  variante = "primario", tam = "md", icono, cargando, className, children, ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; tam?: "sm" | "md" | "lg"; icono?: ReactNode; cargando?: boolean }) {
  const v: Record<Variante, string> = {
    primario: "bg-marca text-sobre-marca shadow-sm hover:bg-marca-700 active:bg-marca-700",
    secundario: "border border-borde-campo/60 bg-white text-tinta hover:border-marca/50 hover:bg-marca-50 active:bg-marca-100",
    fantasma: "text-tinta hover:bg-marca-50 active:bg-marca-100",
    peligro: "border border-error/40 bg-white text-error hover:bg-error-50 active:bg-error-50",
  };
  // En celular todo control mide al menos 44 px; en escritorio el tamaño "sm" se compacta
  const t = { sm: "min-h-11 px-3 text-sm pointer-fine:min-h-9", md: "min-h-11 px-4 text-[15px]", lg: "min-h-12 px-5 text-base" };
  return (
    <button
      {...p}
      disabled={p.disabled || cargando}
      aria-busy={cargando || undefined}
      className={cx("inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50", v[variante], t[tam], className)}
    >
      {cargando ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : icono}
      {children}
    </button>
  );
}

/** Botón de solo ícono con área táctil de 44 × 44 px y nombre accesible obligatorio */
export function BotonIcono({ etiqueta, children, peligro, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { etiqueta: string; peligro?: boolean }) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      {...p}
      className={cx(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-suave transition-colors duration-150",
        peligro ? "hover:bg-error-50 hover:text-error active:bg-error-50" : "hover:bg-marca-50 hover:text-marca-texto active:bg-marca-100",
        className,
      )}
    >
      {children}
    </button>
  );
}

// ---------------- Campos ----------------
/**
 * Campo de formulario con etiqueta visible. Si el hijo es un Input/Select/Textarea, la etiqueta se enlaza con `htmlFor`
 * y el error o la ayuda se conectan con `aria-describedby` (el lector de pantalla los lee junto al campo).
 */
export function Campo({ etiqueta, ayuda, error, children, className }: { etiqueta: string; ayuda?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  const id = useId();
  const msgId = error ? `${id}-err` : ayuda ? `${id}-ayuda` : undefined;
  const mensaje = error ? (
    <p id={msgId} role="alert" className="flex items-center gap-1 text-sm font-medium text-error"><CircleAlert className="size-4 shrink-0" aria-hidden /> {error}</p>
  ) : ayuda ? (
    <p id={msgId} className="text-sm text-suave">{ayuda}</p>
  ) : null;
  const t = isValidElement(children) ? children.type : null;
  if (t === Input || t === Select || t === Textarea || t === "input" || t === "select" || t === "textarea") {
    const hijo = children as ReactElement<Record<string, unknown>>;
    const idCampo = (hijo.props.id as string | undefined) ?? id;
    const desc = [hijo.props["aria-describedby"] as string | undefined, msgId].filter(Boolean).join(" ") || undefined;
    return (
      <div className={cx("flex min-w-0 flex-col gap-1.5", className)}>
        <label htmlFor={idCampo} className="text-sm font-semibold text-texto">{etiqueta}</label>
        {cloneElement(hijo, { id: idCampo, "aria-describedby": desc, "aria-invalid": error ? true : hijo.props["aria-invalid"] })}
        {mensaje}
      </div>
    );
  }
  // Contenido compuesto: la etiqueta envuelve al control
  return (
    <label className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="text-sm font-semibold text-texto">{etiqueta}</span>
      {children}
      {mensaje}
    </label>
  );
}
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx("input", p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx("input", p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx("input", p.className)} />;

/** Etiqueta + control compuesto (p. ej. un selector segmentado). Usa un grupo con nombre en vez de <label>, que activaría solo el primer botón. */
export function Grupo({ etiqueta, ayuda, children, className }: { etiqueta: string; ayuda?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div role="group" aria-label={etiqueta} className={cx("flex min-w-0 flex-col items-start gap-1.5", className)}>
      <span aria-hidden className="text-sm font-semibold text-texto">{etiqueta}</span>
      {children}
      {ayuda && <span className="text-sm text-suave">{ayuda}</span>}
    </div>
  );
}

/** Caja de búsqueda con ícono y etiqueta accesible */
export function Buscador({ valor, onChange, etiqueta, placeholder, className }: { valor: string; onChange: (v: string) => void; etiqueta: string; placeholder?: string; className?: string }) {
  return (
    <label className={cx("relative block", className)}>
      <span className="sr-only">{etiqueta}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-suave" aria-hidden />
      <input type="search" className="input pl-9" placeholder={placeholder ?? etiqueta} value={valor} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

// ---------------- Tarjeta ----------------
export function Tarjeta({ titulo, sub, acciones, children, className }: { titulo?: ReactNode; sub?: ReactNode; acciones?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-xl border border-borde bg-tarjeta p-4 sm:p-5", className)}>
      {(titulo || acciones) && (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0 flex-1 basis-36">
            {titulo && <h2 className="text-base font-bold text-tinta">{titulo}</h2>}
            {sub && <p className="text-sm text-suave">{sub}</p>}
          </div>
          {acciones}
        </header>
      )}
      {children}
    </section>
  );
}

// ---------------- Etiqueta de estado ----------------
export type Tono = "ok" | "alerta" | "error" | "info" | "neutro" | "acento";
/** Los nombres antiguos (verde, ambar…) se siguen aceptando */
type TonoAntiguo = "verde" | "ambar" | "rojo" | "gris" | "azul";
const ALIAS: Record<TonoAntiguo, Tono> = { verde: "ok", ambar: "alerta", rojo: "error", gris: "neutro", azul: "info" };
export const TONOS: Record<Tono, string> = {
  ok: "bg-ok-50 text-ok",
  alerta: "bg-alerta-50 text-alerta",
  error: "bg-error-50 text-error",
  info: "bg-marca-50 text-marca-texto",
  acento: "bg-acento-50 text-acento-texto",
  neutro: "bg-fondo text-suave",
};
export function Chip({ tono = "neutro", children, icono }: { tono?: Tono | TonoAntiguo; children: ReactNode; icono?: ReactNode }) {
  const t = tono in ALIAS ? ALIAS[tono as TonoAntiguo] : (tono as Tono);
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", TONOS[t])}>
      {icono}
      {children}
    </span>
  );
}
/** Compatibilidad: mismo componente con el nombre anterior */
export const Insignia = Chip;
export const InsigniaEstado = ({ estado }: { estado: EstadoLic }) => <Chip tono={ESTADO_TONO[estado]}>{ESTADO_TEXTO[estado]}</Chip>;

// ---------------- Encabezado de página ----------------
export function Titulo({ children, sub, acciones }: { children: ReactNode; sub?: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {/* tabIndex -1: recibe el foco al cambiar de pantalla (lectores de pantalla) */}
        <h1 tabIndex={-1} className="text-2xl font-extrabold tracking-tight text-balance text-tinta outline-none sm:text-[28px]">{children}</h1>
        {sub && <div className="mt-0.5 text-[15px] text-suave">{sub}</div>}
      </div>
      {acciones && <div className="flex shrink-0 flex-wrap gap-2">{acciones}</div>}
    </div>
  );
}

// ---------------- Aviso en página ----------------
export function Aviso({ tono = "info", children }: { tono?: "info" | "alerta" | "error" | "ok"; children: ReactNode }) {
  const t = {
    info: { c: "border-marca/20 bg-marca-50 text-tinta", i: Info },
    alerta: { c: "border-alerta/30 bg-alerta-50 text-alerta", i: TriangleAlert },
    error: { c: "border-error/30 bg-error-50 text-error", i: CircleAlert },
    ok: { c: "border-ok/30 bg-ok-50 text-ok", i: CircleCheck },
  }[tono];
  return (
    <div role={tono === "error" ? "alert" : "status"} className={cx("flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm", t.c)}>
      <t.i className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// ---------------- Estado vacío ----------------
export function Vacio({ children, icono, titulo, texto, accion }: { children?: ReactNode; icono?: ReactNode; titulo?: string; texto?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-borde-campo/50 bg-white px-6 py-10 text-center">
      <span className="rounded-full bg-marca-50 p-3 text-marca-texto">{icono ?? <Inbox className="size-6" aria-hidden />}</span>
      {titulo && <p className="font-bold text-tinta">{titulo}</p>}
      {(texto ?? children) && <div className={cx("max-w-md text-sm", titulo ? "text-suave" : "font-medium text-suave")}>{texto ?? children}</div>}
      {accion && <div className="mt-2">{accion}</div>}
    </div>
  );
}

// ---------------- Esqueleto de carga ----------------
export function Esqueleto({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-pulse rounded-xl bg-marca-100/60", className)} />;
}

// ---------------- Selector segmentado (pestañas / opciones) ----------------
export function Segmentado<T extends string>({
  opciones, valor, onChange, etiqueta, ancho, deshabilitado,
}: {
  opciones: { valor: T; texto: string; tono?: "ok" | "error" }[];
  valor?: T;
  onChange: (v: T) => void;
  etiqueta: string;
  /** Ocupa todo el ancho en celular (botones más grandes para uso en obra) */
  ancho?: boolean;
  /** Solo lectura: se ve el valor pero no se puede cambiar */
  deshabilitado?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // Flechas izquierda/derecha mueven la selección (patrón de radiogroup accesible)
  const teclado = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + opciones.length) % opciones.length;
    onChange(opciones[n].valor);
    refs.current[n]?.focus();
  };
  const activoIdx = opciones.findIndex((o) => o.valor === valor);
  return (
    <div role="radiogroup" aria-label={etiqueta} className={cx("max-w-full overflow-x-auto rounded-lg border border-borde-campo/50 bg-fondo p-1", ancho ? "flex w-full sm:inline-flex sm:w-auto" : "inline-flex")}>
      {opciones.map((o, i) => {
        const activo = o.valor === valor;
        const colorActivo = o.tono === "ok" ? "bg-ok text-white" : o.tono === "error" ? "bg-error text-white" : "bg-white text-tinta shadow-sm";
        return (
          <button
            key={o.valor}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={activo}
            tabIndex={activo || (activoIdx < 0 && i === 0) ? 0 : -1}
            disabled={deshabilitado}
            onKeyDown={(e) => teclado(e, i)}
            onClick={() => onChange(o.valor)}
            className={cx(
              "min-h-11 shrink-0 whitespace-nowrap rounded-md px-3 text-sm font-semibold transition-colors duration-150 pointer-fine:min-h-10 disabled:cursor-not-allowed",
              deshabilitado && !activo && "opacity-50",
              ancho && "flex-1 sm:flex-none",
              activo ? colorActivo : "text-suave hover:text-tinta active:bg-white/60",
            )}
          >
            {o.texto}
          </button>
        );
      })}
    </div>
  );
}

// ---------------- Interruptor ----------------
export function Interruptor({ activo, onChange, etiqueta, disabled }: { activo: boolean; onChange: (v: boolean) => void; etiqueta: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={activo} aria-label={etiqueta} disabled={disabled} onClick={() => onChange(!activo)}
      className={cx("relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150 disabled:opacity-50", activo ? "bg-ok" : "bg-borde-campo/60")}>
      <span className={cx("absolute top-0.5 size-6 rounded-full bg-white shadow transition-all duration-150", activo ? "left-[1.4rem]" : "left-0.5")} />
    </button>
  );
}

// ---------------- Tabla ----------------
export function Tabla({ cabeceras, children }: { cabeceras: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-borde bg-white">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead className="bg-fondo text-xs uppercase tracking-wide text-suave">
          <tr>{cabeceras.map((c) => <th key={c} className="px-3 py-2.5 font-semibold">{c}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-borde [&_tr:hover]:bg-marca-50/60">{children}</tbody>
      </table>
    </div>
  );
}

/**
 * Devuelve el último valor recibido mientras `vigente` fue verdadero. Sirve para que la animación de
 * salida de una ventana siga mostrando su contenido anterior en vez de quedar vacía.
 * Es el patrón "último valor en una ref": se lee y escribe durante el render a propósito y no
 * afecta a ningún otro render, por eso se aísla aquí con las excepciones de lint justificadas.
 */
function useUltimo<T>(valor: T, vigente: boolean): T {
  const ref = useRef(valor);
  // eslint-disable-next-line react-hooks/refs
  if (vigente) ref.current = valor;
  // eslint-disable-next-line react-hooks/refs
  return ref.current;
}

// ---------------- Confirmación (reemplaza window.confirm) ----------------
interface PedidoConfirmacion { titulo: string; texto?: string; aceptar?: string; peligro?: boolean }
type FnConfirmar = (p: PedidoConfirmacion) => Promise<boolean>;
const ConfirmarCtx = createContext<FnConfirmar>(async () => false);
export const useConfirmar = () => useContext(ConfirmarCtx);

function ProveedorConfirmacion({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<(PedidoConfirmacion & { resolver: (v: boolean) => void }) | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const confirmar = useCallback<FnConfirmar>((p) => new Promise((resolver) => setPedido({ ...p, resolver })), []);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (pedido && !d.open) d.showModal();
    if (!pedido && d.open) d.close();
  }, [pedido]);
  const responder = (v: boolean) => { pedido?.resolver(v); setPedido(null); };
  const p = useUltimo(pedido, pedido !== null);
  return (
    <ConfirmarCtx.Provider value={confirmar}>
      {children}
      <dialog
        ref={ref}
        className="ventana m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-white p-0 shadow-xl"
        aria-labelledby="confirmar-titulo"
        aria-describedby="confirmar-texto"
        onCancel={(e) => { e.preventDefault(); responder(false); }}
      >
        {p && (
          <div className="p-5">
            <div className="flex items-start gap-3">
              <span className={cx("rounded-full p-2", p.peligro ? "bg-error-50 text-error" : "bg-marca-50 text-marca-texto")}><TriangleAlert className="size-5" aria-hidden /></span>
              <div>
                <h2 id="confirmar-titulo" className="text-lg font-bold text-tinta">{p.titulo}</h2>
                {p.texto && <p id="confirmar-texto" className="mt-1 text-sm text-suave">{p.texto}</p>}
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {/* Foco inicial en la opción segura */}
              <Boton variante="secundario" onClick={() => responder(false)} autoFocus>Cancelar</Boton>
              <Boton variante={p.peligro ? "peligro" : "primario"} className={p.peligro ? "!border-transparent !bg-error !text-white hover:!bg-error/90" : ""} onClick={() => responder(true)}>
                {p.aceptar ?? "Aceptar"}
              </Boton>
            </div>
          </div>
        )}
      </dialog>
    </ConfirmarCtx.Provider>
  );
}

// ---------------- Ventana modal (hoja inferior en celular) ----------------
export function Modal({
  abierto, onCerrar, titulo, children, pie, sucio,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  children: ReactNode;
  pie?: ReactNode;
  /** Hay cambios sin guardar: se pide confirmación antes de cerrar */
  sucio?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const confirmar = useConfirmar();
  const tituloId = useId();
  const abiertoRef = useRef(abierto);
  const c = useUltimo({ titulo, children, pie }, abierto);
  useLayoutEffect(() => {
    abiertoRef.current = abierto;
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) {
      d.showModal();
      // Foco inicial: el campo marcado como principal o, si no hay, el título (no el botón Cerrar)
      requestAnimationFrame(() => (d.querySelector<HTMLElement>("[data-autofocus]") ?? d.querySelector<HTMLElement>("h2"))?.focus());
    }
    if (!abierto && d.open) d.close();
  }, [abierto]);
  const intentarCerrar = async () => {
    if (sucio && !(await confirmar({ titulo: "¿Descartar los cambios?", texto: "Lo que escribió en este formulario no se ha guardado.", aceptar: "Descartar", peligro: true }))) return;
    onCerrar();
  };
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        // Si el navegador permite cancelar el cierre (Esc), se pregunta antes de cerrar
        if (!e.cancelable) return;
        e.preventDefault();
        intentarCerrar();
      }}
      onClose={() => {
        // Cierre que el navegador no dejó interceptar: si hay cambios, se reabre y se pregunta
        if (!abiertoRef.current) return;
        if (sucio) { ref.current?.showModal(); intentarCerrar(); } else onCerrar();
      }}
      onClick={(e) => e.target === ref.current && intentarCerrar()}
      className="ventana fixed inset-x-0 bottom-0 top-auto m-0 h-fit max-h-[90dvh] w-full max-w-none overflow-hidden rounded-t-2xl bg-white p-0 shadow-2xl sm:inset-0 sm:m-auto sm:max-w-xl sm:rounded-2xl"
      aria-labelledby={tituloId}
    >
      <div className="flex max-h-[90dvh] flex-col">
        {/* Asa visual de la hoja en celular */}
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-borde sm:hidden" aria-hidden />
        <header className="flex items-center justify-between gap-2 border-b border-borde py-2 pl-5 pr-2">
          <h2 id={tituloId} tabIndex={-1} className="min-w-0 text-lg font-bold text-tinta outline-none">{c.titulo}</h2>
          <BotonIcono etiqueta="Cerrar" onClick={intentarCerrar}><X className="size-5" /></BotonIcono>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{c.children}</div>
        {c.pie && <footer className="flex justify-end gap-2 border-t border-borde px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{c.pie}</footer>}
      </div>
    </dialog>
  );
}

// ---------------- Avisos temporales (toast) ----------------
type Toast = { id: number; tono: "ok" | "error"; texto: string };
const ToastCtx = createContext<(texto: string, tono?: "ok" | "error") => void>(() => {});
export const useAviso = () => useContext(ToastCtx);

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const capa = useRef<HTMLDivElement>(null);
  const poner = useCallback((texto: string, tono: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-2), { id, tono, texto }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), tono === "error" ? 6000 : 3500);
  }, []);
  // La capa va en la "top layer" y se reinserta para quedar por encima de cualquier ventana abierta
  useEffect(() => {
    const el = capa.current;
    if (!el || !("showPopover" in el)) return;
    try {
      if (el.matches(":popover-open")) el.hidePopover();
      if (items.length) el.showPopover();
    } catch { /* navegador sin soporte de popover: la capa se muestra igual con z-index */ }
  }, [items]);
  return (
    <ToastCtx.Provider value={poner}>
      <ProveedorConfirmacion>{children}</ProveedorConfirmacion>
      <div ref={capa} popover="manual" aria-live="polite" className="avisos pointer-events-none fixed inset-x-0 bottom-auto z-[60] m-0 flex w-full flex-col items-center gap-2 overflow-visible border-0 bg-transparent p-0 px-4">
        {items.map((i) => (
          <div key={i.id} role={i.tono === "error" ? "alert" : "status"}
            className={cx("animar-aviso pointer-events-auto flex max-w-md items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg", i.tono === "ok" ? "bg-tinta" : "bg-error")}>
            {i.tono === "ok" ? <CircleCheck className="size-5 shrink-0 text-marca2" aria-hidden /> : <CircleAlert className="size-5 shrink-0" aria-hidden />}
            <span>{i.texto}</span>
            <button className="-mr-2 ml-1 inline-flex size-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white" aria-label="Cerrar aviso"
              onClick={() => setItems((x) => x.filter((y) => y.id !== i.id))}>
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
