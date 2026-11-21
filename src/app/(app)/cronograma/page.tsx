"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { fechaCorta, fmtPct } from "@/lib/format";
import { aDate, diasEntre, hoy, sumarDias } from "@/lib/fechas";
import { Aviso, Boton, Campo, Input, Insignia, Modal, Select, Tarjeta, Titulo, Vacio, useAviso } from "@/components/ui";
import { Indicador } from "@/components/comunes";

type Obra = { id: string; nombre: string };
type Tarea = { id: string; actividad_id: string; nombre: string; ubicacion: string; um: string; inicio: string; fin: string; predecesoras: string[]; notas: string; avance: number; esperado: number; estado: string;
  inicio_real: string | null; fin_real: string | null; fin_proyectado: string | null; atraso_dias: number; critica: boolean; holgura: number | null };
type Datos = { obra: Obra; contrato: { inicio: string; fin: string } | null; hoy: string; tareas: Tarea[]; inicio: string | null; fin_plan: string | null; fin_proyectado: string | null; atraso_proyecto: number; atrasadas: number; criticas_atrasadas: number; terminadas: number;
  sin_programar: { actividad_id: string; nombre: string; ubicacion: string }[] };
type Fila = { actividad_id: string; nombre: string; inicio: string; fin: string; predecesoras: string[]; notas: string };
const TONO = { Terminada: "verde", "En curso": "azul", "Por iniciar": "gris", Atrasada: "rojo" } as const;
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
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <div style={{ width: ancho + 220, minWidth: "100%" }}>
        <div className="sticky top-0 flex border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
          <div className="sticky left-0 z-20 w-[220px] shrink-0 border-r border-slate-200 bg-slate-50 px-3 py-2 font-semibold">Actividad</div>
          <div className="relative h-8" style={{ width: ancho }}>{marcas.map((m) => <span key={m.x} className="absolute top-2 border-l border-slate-200 pl-1" style={{ left: m.x }}>{m.t}</span>)}</div>
        </div>
        {d.tareas.map((t) => {
          const dur = diasEntre(t.inicio, t.fin) + 1;
          const color = t.estado === "Terminada" ? "bg-emerald-500" : t.critica ? "bg-red-500" : "bg-sky-500";
          return (
            <div key={t.id} className="flex border-b border-slate-100 text-xs">
              <div className="sticky left-0 z-10 w-[220px] shrink-0 truncate border-r border-slate-200 bg-white px-3 py-2" title={t.nombre}>{t.critica && <span className="mr-1 text-red-600">●</span>}{t.nombre}{t.ubicacion ? ` · ${t.ubicacion}` : ""}</div>
              <div className="relative h-9" style={{ width: ancho }}>
                <div className="absolute inset-y-0 w-0.5 bg-red-500/70" style={{ left: x(d.hoy) }} title="Hoy" />
                <div className="absolute top-2 h-5 rounded bg-slate-200" style={{ left: x(t.inicio), width: dur * PX }} title={`Plan: ${fechaCorta(t.inicio)} – ${fechaCorta(t.fin)}`}>
                  <div className={`h-full rounded ${color}`} style={{ width: `${Math.min(100, t.avance * 100)}%` }} />
                </div>
                {t.fin_proyectado && t.estado !== "Terminada" && t.fin_proyectado > t.fin && (
                  <div className="absolute top-4 h-1 rounded bg-amber-500" style={{ left: x(t.fin) + PX, width: (diasEntre(t.fin, t.fin_proyectado)) * PX }} title={`Proyectado: ${fechaCorta(t.fin_proyectado)}`} />
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
  const [obras, setObras] = useState<Obra[]>([]);
  const [obraId, setObraId] = useState("");
  const [d, setD] = useState<Datos | null>(null);
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [pred, setPred] = useState<number | null>(null);
  const [error, setError] = useState("");
  const puede = !me.solo_lectura && me.licencia?.escritura;

  useEffect(() => { api<Obra[]>("obras").then((o) => { setObras(o); setObraId((x) => x || o[0]?.id || ""); }).catch((e) => setError(e.message)); }, []);
  const cargar = useCallback(() => { if (obraId) api<Datos>(`obras/${obraId}/cronograma`).then((r) => { setD(r); setError(""); }).catch((e) => setError(e.message)); }, [obraId]);
  useEffect(() => { setD(null); setFilas(null); cargar(); }, [cargar]);

  function abrirEditor() {
    if (!d) return;
    setFilas([...d.tareas.map((t) => ({ actividad_id: t.actividad_id, nombre: t.nombre + (t.ubicacion ? ` · ${t.ubicacion}` : ""), inicio: t.inicio, fin: t.fin, predecesoras: t.predecesoras, notas: t.notas })),
      ...d.sin_programar.map((s) => ({ actividad_id: s.actividad_id, nombre: s.nombre + (s.ubicacion ? ` · ${s.ubicacion}` : ""), inicio: "", fin: "", predecesoras: [], notas: "" }))]);
  }
  async function proponer() {
    try {
      const p = await api<{ actividad_id: string; inicio: string; fin: string }[]>(`obras/${obraId}/cronograma/propuesta`);
      setFilas((f) => (f ?? []).map((x) => { const q = p.find((y) => y.actividad_id === x.actividad_id); return q ? { ...x, inicio: q.inicio, fin: q.fin } : x; }));
      aviso("Propuesta cargada: ajuste las fechas y guarde");
    } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo proponer", "error"); }
  }
  async function guardar() {
    if (!filas) return;
    const prog = filas.filter((f) => f.inicio && f.fin);
    try { const r = await api<Datos>(`obras/${obraId}/cronograma`, { method: "PUT", body: { tareas: prog.map((f) => ({ actividad_id: f.actividad_id, inicio: f.inicio, fin: f.fin, predecesoras: f.predecesoras.filter((p) => prog.some((x) => x.actividad_id === p)), notas: f.notas })) } });
      setD(r); setFilas(null); aviso("Cronograma guardado"); } catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); }
  }
  const setF = (i: number, c: Partial<Fila>) => setFilas((f) => f!.map((x, k) => (k === i ? { ...x, ...c } : x)));

  return (
    <>
      <Titulo sub="Programación por actividad, avance real y ruta crítica" acciones={puede && d && !filas && <Boton onClick={abrirEditor}>{d.tareas.length ? "Editar cronograma" : "Programar actividades"}</Boton>}>Cronograma</Titulo>
      <div className="max-w-md"><Campo etiqueta="Obra"><Select value={obraId} onChange={(e) => setObraId(e.target.value)}>{obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Select></Campo></div>
      {error && <div className="mt-3"><Aviso tono="error">{error}</Aviso></div>}

      {d && !filas && (
        <>
          {!d.tareas.length ? <div className="mt-4"><Vacio>Esta obra aún no tiene cronograma. {d.sin_programar.length ? "Pulse «Programar actividades»." : "Cargue primero el contrato con sus actividades."}</Vacio></div> : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Indicador etiqueta="Terminadas" valor={`${d.terminadas} / ${d.tareas.length}`} />
                <Indicador etiqueta="Atrasadas" valor={d.atrasadas} tono={d.atrasadas ? "alerta" : "ok"} detalle={d.criticas_atrasadas ? `${d.criticas_atrasadas} en la ruta crítica` : undefined} />
                <Indicador etiqueta="Fin planeado" valor={fechaCorta(d.fin_plan)} detalle={d.contrato ? `Contrato: ${fechaCorta(d.contrato.fin)}` : undefined} />
                <Indicador etiqueta="Fin proyectado" valor={fechaCorta(d.fin_proyectado)} tono={d.atraso_proyecto ? "error" : "ok"} detalle={d.atraso_proyecto ? `${d.atraso_proyecto} días de atraso` : "Sin atraso"} />
              </div>
              {d.sin_programar.length > 0 && <div className="mt-3"><Aviso tono="alerta">{d.sin_programar.length} actividad(es) del contrato no están programadas.</Aviso></div>}
              <div className="mt-4"><Gantt d={d} /></div>
              <p className="mt-2 text-xs text-slate-500"><span className="text-red-600">●</span> Ruta crítica (sin holgura) · barra gris = plan, color = avance real (azul normal, rojo crítica, verde terminada) · línea ámbar = atraso proyectado.</p>
              <div className="mt-4 grid gap-2">
                {d.tareas.map((t) => (
                  <Tarjeta key={t.id}>
                    <div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{t.nombre}{t.ubicacion ? ` · ${t.ubicacion}` : ""}</strong><Insignia tono={TONO[t.estado as keyof typeof TONO] ?? "gris"}>{t.estado}</Insignia>
                      {t.critica && <Insignia tono="rojo">Ruta crítica</Insignia>}</div>
                    <p className="mt-1 text-xs text-slate-600">Plan {fechaCorta(t.inicio)} → {fechaCorta(t.fin)} · avance {fmtPct(t.avance)} (esperado {fmtPct(t.esperado)}){t.holgura != null && !t.critica ? ` · holgura ${t.holgura} días` : ""}
                      {t.atraso_dias > 0 ? ` · termina ${t.atraso_dias} días tarde (${fechaCorta(t.fin_proyectado)})` : ""}{t.fin_real ? ` · terminó ${fechaCorta(t.fin_real)}` : ""}</p>
                  </Tarjeta>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {d && filas && (
        <div className="mt-5"><Tarjeta titulo="Programar actividades" acciones={<Boton variante="secundario" onClick={proponer}>Proponer desde el contrato</Boton>}>
          <p className="mb-3 text-xs text-slate-500">Deje las fechas vacías en lo que no quiera programar. «Predecesoras» son las actividades que deben terminar antes de empezar esta.</p>
          <div className="space-y-2">
            {filas.map((f, i) => (
              <div key={f.actividad_id} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_9.5rem_9.5rem_auto] sm:items-center">
                <span className="text-sm font-medium">{f.nombre}</span>
                <Input aria-label="Inicio" type="date" value={f.inicio} onChange={(e) => setF(i, { inicio: e.target.value, fin: f.fin && f.fin < e.target.value ? e.target.value : f.fin })} />
                <Input aria-label="Fin" type="date" min={f.inicio} value={f.fin} onChange={(e) => setF(i, { fin: e.target.value })} />
                <Boton variante="secundario" onClick={() => setPred(i)} disabled={!f.inicio}>Predecesoras ({f.predecesoras.length})</Boton>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2"><Boton variante="secundario" onClick={() => setFilas(null)}>Cancelar</Boton><Boton onClick={guardar}>Guardar cronograma</Boton></div>
        </Tarjeta></div>
      )}
      <Modal abierto={pred !== null} titulo="Predecesoras" onCerrar={() => setPred(null)}>
        {pred !== null && filas && (
          <div className="space-y-1">
            <p className="mb-2 text-sm text-slate-600">¿Qué debe terminar antes de «{filas[pred].nombre}»?</p>
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
