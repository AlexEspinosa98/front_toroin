"use client";
import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Flame, Link2, Sparkles, Wand2 } from "lucide-react";
import { api } from "@/lib/client";
import { useObras } from "@/lib/obras";
import { useSession } from "@/lib/session";
import { fechaCorta, fmtPct } from "@/lib/format";
import { aDate, diasEntre, sumarDias } from "@/lib/fechas";
import { Aviso, Boton, Chip, Esqueleto, Input, Modal, Tarjeta, Titulo, Vacio, useAviso, type Tono } from "@/components/ui";
import { Indicador, SelectorObra } from "@/components/comunes";

type Obra = { id: string; nombre: string };
type Tarea = { id: string; actividad_id: string; nombre: string; ubicacion: string; um: string; inicio: string; fin: string; predecesoras: string[]; notas: string; avance: number; esperado: number; estado: string;
  inicio_real: string | null; fin_real: string | null; fin_proyectado: string | null; atraso_dias: number; critica: boolean; holgura: number | null };
type Datos = { obra: Obra; contrato: { inicio: string; fin: string } | null; hoy: string; tareas: Tarea[]; inicio: string | null; fin_plan: string | null; fin_proyectado: string | null; atraso_proyecto: number; atrasadas: number; criticas_atrasadas: number; terminadas: number;
  sin_programar: { actividad_id: string; nombre: string; ubicacion: string }[] };
type Fila = { actividad_id: string; nombre: string; inicio: string; fin: string; predecesoras: string[]; notas: string };
const TONO: Record<string, Tono> = { Terminada: "ok", "En curso": "info", "Por iniciar": "neutro", Atrasada: "error" };
const PX = 12; // píxeles por día en el diagrama

function Gantt({ d }: { d: Datos }) {
  const { desde, dias, marcas } = useMemo(() => {
    const fechas = [d.hoy, ...d.tareas.flatMap((t) => [t.inicio, t.fin, t.fin_proyectado ?? t.fin]), ...(d.contrato ? [d.contrato.inicio, d.contrato.fin] : [])];
    const min = fechas.reduce((a, b) => (a < b ? a : b)), max = fechas.reduce((a, b) => (a > b ? a : b));
    const desde = sumarDias(min, -2), total = diasEntre(desde, max) + 4;
    const marcas: { x: number; t: string }[] = [];
    for (let i = 0; i <= total; i++) { const f = sumarDias(desde, i); if (f.endsWith("-01") || i === 0) marcas.push({ x: i * PX, t: aDate(f).toLocaleDateString("es-CO", { month: "short", year: "2-digit", timeZone: "UTC" }) }); }
    return { desde, dias: total, marcas };
  }, [d]);
  const x = (f: string) => diasEntre(desde, f) * PX;
  const ancho = dias * PX;
  return (
    <div className="overflow-x-auto rounded-lg border border-borde bg-tarjeta">
      <div style={{ width: ancho + 220, minWidth: "100%" }}>
        <div className="sticky top-0 flex border-b border-borde bg-fondo text-xs text-suave">
          <div className="sticky left-0 z-20 w-[220px] shrink-0 border-r border-borde bg-fondo px-3 py-2 font-semibold">Actividad</div>
          <div className="relative h-8" style={{ width: ancho }}>{marcas.map((m) => <span key={m.x} className="absolute top-2 border-l border-borde pl-1" style={{ left: m.x }}>{m.t}</span>)}</div>
        </div>
        {d.tareas.map((t) => {
          const dur = diasEntre(t.inicio, t.fin) + 1;
          const color = t.estado === "Terminada" ? "bg-ok" : t.critica ? "bg-error" : "bg-marca-texto";
          return (
            <div key={t.id} className="flex border-b border-borde/60 text-xs">
              <div className="sticky left-0 z-10 w-[220px] shrink-0 truncate border-r border-borde bg-tarjeta px-3 py-2" title={t.nombre}>{t.critica && <span className="mr-1 text-error">●</span>}{t.nombre}{t.ubicacion ? ` · ${t.ubicacion}` : ""}</div>
              <div className="relative h-9" style={{ width: ancho }}>
                <div className="absolute inset-y-0 w-0.5 bg-error/70" style={{ left: x(d.hoy) }} title="Hoy" />
                <div className="absolute top-2 h-5 rounded bg-marca-100" style={{ left: x(t.inicio), width: dur * PX }} title={`Plan: ${fechaCorta(t.inicio)} – ${fechaCorta(t.fin)}`}>
                  <div className={`h-full rounded ${color}`} style={{ width: `${Math.min(100, t.avance * 100)}%` }} />
                </div>
                {t.fin_proyectado && t.estado !== "Terminada" && t.fin_proyectado > t.fin && (
                  <div className="absolute top-4 h-1 rounded bg-alerta" style={{ left: x(t.fin) + PX, width: (diasEntre(t.fin, t.fin_proyectado)) * PX }} title={`Proyectado: ${fechaCorta(t.fin_proyectado)}`} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Cronograma() {
  const { me } = useSession();
  const aviso = useAviso();
  const { obras, cargando, obraId, setObraId, error: errObras } = useObras();
  const [res, setRes] = useState<{ obraId: string; d: Datos } | null>(null);
  const [fl, setFl] = useState<{ obraId: string; filas: Fila[] } | null>(null);
  const d = res?.obraId === obraId ? res.d : null;
  const filas = fl?.obraId === obraId ? fl.filas : null;
  const setFilas = (f: Fila[] | null) => setFl(f && { obraId, filas: f });
  const [pred, setPred] = useState<number | null>(null);
  const [error, setError] = useState("");
  const puede = !me.solo_lectura && me.licencia?.escritura;

  useEffect(() => {
    if (!obraId) return;
    let vivo = true;
    api<Datos>(`obras/${obraId}/cronograma`).then((r) => { if (vivo) { setRes({ obraId, d: r }); setError(""); } }).catch((e) => vivo && setError(e.message));
    return () => { vivo = false; };
  }, [obraId]);

  function abrirEditor() {
    if (!d) return;
    setFilas([...d.tareas.map((t) => ({ actividad_id: t.actividad_id, nombre: t.nombre + (t.ubicacion ? ` · ${t.ubicacion}` : ""), inicio: t.inicio, fin: t.fin, predecesoras: t.predecesoras, notas: t.notas })),
      ...d.sin_programar.map((s) => ({ actividad_id: s.actividad_id, nombre: s.nombre + (s.ubicacion ? ` · ${s.ubicacion}` : ""), inicio: "", fin: "", predecesoras: [], notas: "" }))]);
  }
  async function proponer() {
    try {
      const p = await api<{ actividad_id: string; inicio: string; fin: string }[]>(`obras/${obraId}/cronograma/propuesta`);
      setFilas((filas ?? []).map((x) => { const q = p.find((y) => y.actividad_id === x.actividad_id); return q ? { ...x, inicio: q.inicio, fin: q.fin } : x; }));
      aviso("Propuesta cargada: ajuste las fechas y guarde");
    } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo proponer", "error"); }
  }
  async function guardar() {
    if (!filas) return;
    const prog = filas.filter((f) => f.inicio && f.fin);
    try { const r = await api<Datos>(`obras/${obraId}/cronograma`, { method: "PUT", body: { tareas: prog.map((f) => ({ actividad_id: f.actividad_id, inicio: f.inicio, fin: f.fin, predecesoras: f.predecesoras.filter((p) => prog.some((x) => x.actividad_id === p)), notas: f.notas })) } });
      setRes({ obraId, d: r }); setFilas(null); aviso("Cronograma guardado"); } catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); }
  }
  const setF = (i: number, c: Partial<Fila>) => filas && setFilas(filas.map((x, k) => (k === i ? { ...x, ...c } : x)));

  return (
    <>
      <Titulo sub="Programación por actividad, avance real y ruta crítica" acciones={puede && d && !filas && <Boton icono={<CalendarRange className="size-4" aria-hidden />} onClick={abrirEditor}>{d.tareas.length ? "Editar cronograma" : "Programar actividades"}</Boton>}>Cronograma</Titulo>
      <SelectorObra className="mb-5 max-w-sm" obras={obras} valor={obraId} onChange={setObraId} />
      {(error || errObras) && <Aviso tono="error">{error || errObras}</Aviso>}
      {!cargando && !obras.length && !errObras && <Vacio icono={<CalendarRange className="size-6" aria-hidden />} titulo="Primero cree una obra" texto="El cronograma se programa obra por obra." />}
      {obraId && !d && !error && <div className="space-y-3"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Esqueleto key={i} className="h-28" />)}</div><Esqueleto className="h-64" /></div>}

      {d && !filas && (
        <>
          {!d.tareas.length ? <Vacio icono={<CalendarRange className="size-6" aria-hidden />} titulo="Esta obra aún no tiene cronograma" texto={d.sin_programar.length ? "Pulse «Programar actividades» para empezar." : "Cargue primero el contrato con sus actividades."} /> : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Indicador etiqueta="Terminadas" valor={`${d.terminadas} / ${d.tareas.length}`} tono="ok" icono={<Sparkles className="size-5" aria-hidden />} />
                <Indicador etiqueta="Atrasadas" valor={d.atrasadas} tono={d.atrasadas ? "alerta" : "ok"} icono={<Flame className="size-5" aria-hidden />} detalle={d.criticas_atrasadas ? `${d.criticas_atrasadas} en la ruta crítica` : undefined} />
                <Indicador etiqueta="Fin planeado" valor={fechaCorta(d.fin_plan)} detalle={d.contrato ? `Contrato: ${fechaCorta(d.contrato.fin)}` : undefined} icono={<CalendarRange className="size-5" aria-hidden />} />
                <Indicador etiqueta="Fin proyectado" valor={fechaCorta(d.fin_proyectado)} tono={d.atraso_proyecto ? "error" : "ok"} detalle={d.atraso_proyecto ? `${d.atraso_proyecto} días de atraso` : "Sin atraso"} icono={<CalendarRange className="size-5" aria-hidden />} />
              </div>
              {d.sin_programar.length > 0 && <div className="mt-4"><Aviso tono="alerta">{d.sin_programar.length} actividad(es) del contrato no están programadas.</Aviso></div>}
              <div className="mt-4"><Gantt d={d} /></div>
              <p className="mt-2 text-xs text-suave"><span className="text-error">●</span> Ruta crítica (sin holgura) · barra gris = plan, color = avance real (azul normal, rojo crítica, verde terminada) · línea ámbar = atraso proyectado.</p>
              <div className="mt-4 grid gap-2">
                {d.tareas.map((t) => (
                  <Tarjeta key={t.id}>
                    <div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{t.nombre}{t.ubicacion ? ` · ${t.ubicacion}` : ""}</strong><Chip tono={TONO[t.estado] ?? "neutro"}>{t.estado}</Chip>
                      {t.critica && <Chip tono="error" icono={<Flame className="size-3.5" aria-hidden />}>Ruta crítica</Chip>}</div>
                    <p className="mt-1 text-sm text-suave">Plan {fechaCorta(t.inicio)} → {fechaCorta(t.fin)} · avance {fmtPct(t.avance)} (esperado {fmtPct(t.esperado)}){t.holgura != null && !t.critica ? ` · holgura ${t.holgura} días` : ""}
                      {t.atraso_dias > 0 ? ` · termina ${t.atraso_dias} días tarde (${fechaCorta(t.fin_proyectado)})` : ""}{t.fin_real ? ` · terminó ${fechaCorta(t.fin_real)}` : ""}</p>
                  </Tarjeta>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {d && filas && (
        <div className="mt-5"><Tarjeta titulo="Programar actividades" acciones={<Boton variante="secundario" icono={<Wand2 className="size-4" aria-hidden />} onClick={proponer}>Proponer desde el contrato</Boton>}>
          <p className="mb-3 text-sm text-suave">Deje las fechas vacías en lo que no quiera programar. «Predecesoras» son las actividades que deben terminar antes de empezar esta.</p>
          <div className="space-y-2">
            {filas.map((f, i) => (
              <div key={f.actividad_id} className="grid gap-2 rounded-xl border border-borde bg-tarjeta p-3 sm:grid-cols-[1fr_9.5rem_9.5rem_auto] sm:items-center">
                <span className="text-sm font-medium">{f.nombre}</span>
                <Input aria-label="Inicio" type="date" value={f.inicio} onChange={(e) => setF(i, { inicio: e.target.value, fin: f.fin && f.fin < e.target.value ? e.target.value : f.fin })} />
                <Input aria-label="Fin" type="date" min={f.inicio} value={f.fin} onChange={(e) => setF(i, { fin: e.target.value })} />
                <Boton variante="secundario" icono={<Link2 className="size-4" aria-hidden />} onClick={() => setPred(i)} disabled={!f.inicio}>Predecesoras ({f.predecesoras.length})</Boton>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2"><Boton variante="secundario" onClick={() => setFilas(null)}>Cancelar</Boton><Boton onClick={guardar}>Guardar cronograma</Boton></div>
        </Tarjeta></div>
      )}
      <Modal abierto={pred !== null} titulo="Predecesoras" onCerrar={() => setPred(null)}>
        {pred !== null && filas && (
          <div className="space-y-1">
            <p className="mb-2 text-sm text-suave">¿Qué debe terminar antes de «{filas[pred].nombre}»?</p>
            {filas.filter((x, k) => k !== pred && x.inicio && x.fin).map((x) => (
              <label key={x.actividad_id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5" checked={filas[pred].predecesoras.includes(x.actividad_id)}
                onChange={(e) => setF(pred, { predecesoras: e.target.checked ? [...filas[pred].predecesoras, x.actividad_id] : filas[pred].predecesoras.filter((p) => p !== x.actividad_id) })} />{x.nombre}</label>
            ))}
            <div className="flex justify-end pt-2"><Boton onClick={() => setPred(null)}>Listo</Boton></div>
          </div>
        )}
      </Modal>
    </>
  );
}
