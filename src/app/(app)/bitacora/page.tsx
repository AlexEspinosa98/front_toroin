"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { fechaCorta, fmtNum, fmtPct } from "@/lib/format";
import { diaSemana, fechaLarga, hoy, sumarDias } from "@/lib/fechas";
import { procesarFoto } from "@/lib/fotos";
import type { ActividadT, DatosObra, RegistroT } from "@/lib/types";
import { Aviso, Boton, Campo, Input, Insignia, Modal, Select, Tarjeta, Textarea, Titulo, Vacio, useAviso } from "@/components/ui";
import { BarraAvance, Miniatura, SinContrato, nombreActividad } from "@/components/comunes";

type Persona = { trabajador_id: string; nombre: string; cargo: string; asistio: boolean | null };
type Contexto = { asistencia_registrada: boolean; personal: Persona[]; motivos_atraso: string[] };
type TareaV = { id: string; actividad_id: string; desde: string; hasta: string | null; instruccion: string };
type Duracion = "hoy" | "semana" | "indefinida";
const num = (s: string) => Number(s.replace(",", "."));
const lunesDe = (f: string) => { const ds = diaSemana(f); return sumarDias(f, ds === 0 ? -6 : 1 - ds); };
const hastaSegun = (f: string, d: Duracion) => (d === "hoy" ? f : d === "semana" ? sumarDias(f, diaSemana(f) === 6 ? 7 : diaSemana(f) === 0 ? 6 : 6 - diaSemana(f)) : null);
const vigencia = (t: TareaV, f: string) => (t.desde === f && t.hasta === f ? "Solo hoy" : `${t.desde < f ? `desde ${fechaCorta(t.desde).slice(0, 6)}` : "desde hoy"} · ${!t.hasta ? "hasta nuevo aviso" : t.hasta === f ? "solo hoy" : `hasta ${fechaCorta(t.hasta).slice(0, 6)}`}`);

export default function Bitacora() {
  const { me } = useSession();
  const [obras, setObras] = useState<{ id: string; nombre: string }[]>([]);
  const [obraId, setObraId] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [paso, setPaso] = useState<"tareas" | "avance">("tareas");
  const [d, setD] = useState<DatosObra | null>(null);
  const [ctxDia, setCtxDia] = useState<Contexto | null>(null);
  const [tareas, setTareas] = useState<Record<string, TareaV>>({});
  const [registros, setRegistros] = useState<RegistroT[]>([]);
  const [semana, setSemana] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const puedeEscribir = !me.solo_lectura && me.licencia?.escritura && ["admin", "gerencia", "residente", "super_admin"].includes(me.rol);

  useEffect(() => { api<{ id: string; nombre: string }[]>("obras").then((o) => { setObras(o); setObraId((x) => x || o[0]?.id || ""); }).catch((e) => setError(e.message)); }, []);
  const cargar = useCallback(async () => {
    if (!obraId) return;
    try {
      const [dd, cx, tr, rs, sem] = await Promise.all([
        api<DatosObra>(`obras/${obraId}/contrato`), api<Contexto>(`bitacora/contexto?obra_id=${obraId}&fecha=${fecha}`),
        api<Record<string, TareaV>>(`tareas?obra_id=${obraId}&fecha=${fecha}`), api<RegistroT[]>(`bitacora?obra_id=${obraId}&fecha=${fecha}`),
        api<RegistroT[]>(`bitacora?obra_id=${obraId}&desde=${lunesDe(fecha)}&hasta=${sumarDias(fecha, -1)}`),
      ]);
      setD(dd); setCtxDia(cx); setTareas(tr); setRegistros(rs); setError("");
      const m: Record<string, number> = {};
      for (const r of sem) for (const t of r.trabajadores ?? []) { const v = r.por_trabajador?.[t] ?? r.cantidad / (r.trabajadores.length || 1); m[`${t}|${r.actividad_id}`] = (m[`${t}|${r.actividad_id}`] ?? 0) + v; }
      setSemana(m);
    } catch (e) { setError((e as Error).message); }
  }, [obraId, fecha]);
  useEffect(() => { void cargar(); }, [cargar]);

  const disponibles = useMemo(() => (ctxDia?.personal ?? []).filter((p) => p.asistio !== false), [ctxDia]);
  const ausentes = useMemo(() => (ctxDia?.personal ?? []).filter((p) => p.asistio === false), [ctxDia]);
  const conTarea = disponibles.filter((p) => tareas[p.trabajador_id]).length;
  const actsConGente = new Set(disponibles.map((p) => tareas[p.trabajador_id]?.actividad_id).filter(Boolean));

  return (
    <>
      <Titulo sub="En la mañana asigne qué hace cada persona; al final del día registre cuánto avanzó cada una">Bitácora de obra</Titulo>
      <div className="grid max-w-2xl gap-3 sm:grid-cols-[1fr_220px]">
        <Campo etiqueta="Obra"><Select value={obraId} onChange={(e) => setObraId(e.target.value)}>{obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Select></Campo>
        <Campo etiqueta="Fecha"><Input type="date" value={fecha} max={hoy()} onChange={(e) => e.target.value && setFecha(e.target.value)} /></Campo>
      </div>
      {error && <div className="mt-3"><Aviso tono="error">{error}</Aviso></div>}
      {d && !d.contrato && <div className="mt-5"><SinContrato obraId={obraId} /></div>}
      {d?.contrato && ctxDia && <>
        <div className="mt-4 grid max-w-3xl grid-cols-3 gap-2">
          {([["Disponibles", disponibles.length, ctxDia.asistencia_registrada ? "según asistencia" : "sin asistencia aún"], ["Con tarea", `${conTarea}/${disponibles.length}`, conTarea < disponibles.length ? `${disponibles.length - conTarea} sin tarea` : "todos asignados"], ["Avance guardado", `${registros.length}/${Math.max(actsConGente.size, registros.length)}`, "actividades"]] as const).map(([t, v, s]) => (
            <div key={t} className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs font-semibold text-slate-500">{t}</p><p className="text-xl font-extrabold">{v}</p><p className="truncate text-xs text-slate-500">{s}</p></div>))}
        </div>
        {!ctxDia.asistencia_registrada && <div className="mt-3 max-w-3xl"><Aviso tono="alerta">El SST aún no registra la asistencia de {fechaLarga(fecha)}. Se muestra todo el personal habilitado de la obra. <Link href="/asistencia" className="font-semibold underline">Ir a asistencia</Link></Aviso></div>}
        <div className="mt-5 flex max-w-3xl gap-2" role="group" aria-label="Paso de la bitácora">
          <Boton className="flex-1" variante={paso === "tareas" ? "primario" : "secundario"} onClick={() => setPaso("tareas")}>1. Tareas del día</Boton>
          <Boton className="flex-1" variante={paso === "avance" ? "primario" : "secundario"} onClick={() => setPaso("avance")}>2. Avance del día</Boton>
        </div>
        {paso === "tareas"
          ? <PasoTareas obraId={obraId} fecha={fecha} d={d} disponibles={disponibles} ausentes={ausentes} personal={ctxDia.personal} tareas={tareas} puedeEscribir={!!puedeEscribir} recargar={cargar} irAvance={() => setPaso("avance")} />
          : <PasoAvance obraId={obraId} fecha={fecha} d={d} disponibles={disponibles} personal={ctxDia.personal} tareas={tareas} registros={registros} semana={semana} motivos={ctxDia.motivos_atraso} puedeEscribir={!!puedeEscribir} recargar={cargar} irTareas={() => setPaso("tareas")} />}
      </>}
    </>
  );
}

// ---------- Paso 1: asignar tareas ----------
function PasoTareas({ obraId, fecha, d, disponibles, ausentes, personal, tareas, puedeEscribir, recargar, irAvance }: { obraId: string; fecha: string; d: DatosObra; disponibles: Persona[]; ausentes: Persona[]; personal: Persona[]; tareas: Record<string, TareaV>; puedeEscribir: boolean; recargar: () => Promise<void>; irAvance: () => void }) {
  const aviso = useAviso();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [abierto, setAbierto] = useState(false);
  const [actividad, setActividad] = useState<string | undefined>();
  const [duracion, setDuracion] = useState<Duracion>("semana");
  const [instruccion, setInstruccion] = useState("");
  const [buscar, setBuscar] = useState("");
  const [intento, setIntento] = useState(false);
  const acts = d.actividades;
  const sinTarea = disponibles.filter((p) => !tareas[p.trabajador_id]);
  const grupos = acts.map((a) => ({ a, gente: disponibles.filter((p) => tareas[p.trabajador_id]?.actividad_id === a.id) })).filter((g) => g.gente.length);
  const alternar = (id: string) => setSel((s) => { const x = new Set(s); x.has(id) ? x.delete(id) : x.add(id); return x; });
  const grupo = (ids: string[]) => setSel((s) => { const todos = ids.every((i) => s.has(i)); const x = new Set(s); ids.forEach((i) => (todos ? x.delete(i) : x.add(i))); return x; });
  const abrir = () => { const as = new Set([...sel].map((id) => tareas[id]?.actividad_id ?? "")); setActividad(as.size === 1 ? [...as][0] || undefined : undefined); setInstruccion(""); setBuscar(""); setIntento(false); setAbierto(true); };
  const hasta = hastaSegun(fecha, duracion);
  async function asignar() {
    setIntento(true);
    if (actividad === undefined) return;
    try {
      await api("tareas/asignar", { method: "POST", body: { obra_id: obraId, trabajador_ids: [...sel], actividad_id: actividad, desde: fecha, hasta, instruccion: instruccion.trim() } });
      const a = acts.find((x) => x.id === actividad);
      aviso(actividad ? `${sel.size} ${sel.size === 1 ? "persona asignada" : "personas asignadas"} a ${a ? nombreActividad(a) : ""}` : `Tarea quitada a ${sel.size}`);
      setSel(new Set()); setAbierto(false); await recargar();
    } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo asignar", "error"); }
  }
  const q = buscar.trim().toLowerCase();
  const lista = acts.filter((a) => !q || `${a.nombre} ${a.ubicacion} ${a.item}`.toLowerCase().includes(q));
  const fila = (p: Persona) => { const t = tareas[p.trabajador_id]; const m = sel.has(p.trabajador_id); return (
    <li key={p.trabajador_id}><label className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 ${m ? "bg-slate-100" : "hover:bg-slate-50"}`}>
      <input type="checkbox" className="size-5" checked={m} disabled={!puedeEscribir} onChange={() => alternar(p.trabajador_id)} />
      <span className="min-w-0 flex-1"><span className="block font-semibold">{p.nombre}</span><span className="block text-xs text-slate-500">{t ? vigencia(t, fecha) : p.cargo || "Sin cargo registrado"}{t?.instruccion && <span className="block text-marca">“{t.instruccion}”</span>}</span></span></label></li>); };

  return (
    <>
      {disponibles.length === 0 ? <div className="mt-4 max-w-3xl"><Vacio>No hay personal disponible. RRHH asigna el personal a la obra y el SST registra la asistencia del día.</Vacio></div> : (
        <div className="mt-4 max-w-3xl space-y-4">
          <p className="text-sm text-slate-500">Marque a una o varias personas y asígneles la actividad. La tarea queda vigente hoy, toda la semana o hasta nuevo aviso.</p>
          {sinTarea.length > 0 && <Tarjeta className="border-amber-300" titulo={<span className="text-amber-700">Sin tarea asignada ({sinTarea.length})</span>} acciones={puedeEscribir && <Boton variante="fantasma" className="!min-h-9" onClick={() => grupo(sinTarea.map((p) => p.trabajador_id))}>{sinTarea.every((p) => sel.has(p.trabajador_id)) ? "Quitar selección" : "Seleccionar todos"}</Boton>}><ul className="divide-y divide-slate-100">{sinTarea.map(fila)}</ul></Tarjeta>}
          {grupos.map(({ a, gente }) => { const pct = Math.min(1, a.ejecutado / a.cantidad); return (
            <Tarjeta key={a.id} titulo={nombreActividad(a)} acciones={puedeEscribir && <Boton variante="fantasma" className="!min-h-9" onClick={() => grupo(gente.map((p) => p.trabajador_id))}>{gente.every((p) => sel.has(p.trabajador_id)) ? "Quitar selección" : "Seleccionar"}</Boton>}>
              <div className="mb-2 flex items-center gap-2 text-xs text-slate-500"><span className="w-24"><BarraAvance valor={pct} etiqueta={`Avance ${a.nombre}`} /></span>{fmtPct(pct)} ejecutado · {gente.length} {gente.length === 1 ? "persona" : "personas"}</div>
              <ul className="divide-y divide-slate-100">{gente.map(fila)}</ul></Tarjeta>); })}
          {ausentes.length > 0 && <details className="rounded-xl border border-slate-200 bg-white px-4 py-1"><summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-slate-500">No asistieron hoy ({ausentes.length})</summary><ul className="pb-2 text-sm text-slate-500">{ausentes.map((p) => <li key={p.trabajador_id} className="py-1">{p.nombre}</li>)}</ul></details>}
          {sinTarea.length === 0 && <div className="flex flex-col items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-semibold text-green-800">Todo el personal disponible tiene tarea. Al final del día, registre el avance.</p><Boton variante="secundario" onClick={irAvance}>Ir al avance del día</Boton></div>}
        </div>)}
      {sel.size > 0 && puedeEscribir && <div className="sticky bottom-3 z-10 mt-5 flex max-w-3xl items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg"><p className="text-sm font-semibold">{sel.size} {sel.size === 1 ? "persona seleccionada" : "personas seleccionadas"}</p><div className="flex gap-2"><Boton variante="fantasma" onClick={() => setSel(new Set())}>Cancelar</Boton><Boton onClick={abrir}>Asignar tarea</Boton></div></div>}
      <Modal abierto={abierto} onCerrar={() => setAbierto(false)} titulo={`Asignar tarea a ${sel.size} ${sel.size === 1 ? "persona" : "personas"}`}>
        <div className="space-y-4">
          <p className="text-sm text-slate-500">{[...sel].map((id) => personal.find((p) => p.trabajador_id === id)?.nombre).filter(Boolean).join(", ")}</p>
          <fieldset className="min-w-0"><legend className="mb-1.5 text-sm font-semibold">¿Qué actividad hará?</legend>
            <Input placeholder="Buscar actividad o torre" value={buscar} onChange={(e) => setBuscar(e.target.value)} className="mb-2" />
            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
              {lista.map((a: ActividadT) => { const pct = Math.min(1, a.ejecutado / a.cantidad); const fin = pct >= 1; return (
                <li key={a.id}><label className={`flex min-h-12 items-center gap-3 px-3 py-2 ${fin ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-slate-50"} ${actividad === a.id ? "bg-slate-100" : ""}`}>
                  <input type="radio" name="actividad" className="size-5" checked={actividad === a.id} disabled={fin} onChange={() => setActividad(a.id)} />
                  <span className="min-w-0 flex-1"><span className="block font-semibold">{nombreActividad(a)}</span><span className="block text-xs text-slate-500">{fin ? "Terminada" : `Saldo ${fmtNum(a.cantidad - a.ejecutado)} ${a.um} · ${fmtPct(pct)} ejecutado`}</span></span></label></li>); })}
              <li><label className={`flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50 ${actividad === "" ? "bg-slate-100" : ""}`}><input type="radio" name="actividad" className="size-5" checked={actividad === ""} onChange={() => setActividad("")} /><span className="font-semibold text-slate-500">Sin tarea (quitar la asignación)</span></label></li>
            </ul>
            {intento && actividad === undefined && <p role="alert" className="mt-1 text-sm font-medium text-red-700">Elija la actividad</p>}
          </fieldset>
          {actividad !== "" && <>
            <div><p className="mb-1.5 text-sm font-semibold">¿Por cuánto tiempo?</p>
              <div className="flex gap-2" role="group" aria-label="Duración de la tarea">{(["hoy", "semana", "indefinida"] as const).map((x) => <Boton key={x} className="flex-1" variante={duracion === x ? "primario" : "secundario"} onClick={() => setDuracion(x)}>{x === "hoy" ? "Solo hoy" : x === "semana" ? "Hasta el sábado" : "Sin fecha fin"}</Boton>)}</div>
              <p className="mt-1 text-xs text-slate-500">{duracion === "hoy" ? `Solo el ${fechaCorta(fecha)}.` : duracion === "semana" ? `Del ${fechaCorta(fecha)} al ${fechaCorta(hasta)}.` : `Desde el ${fechaCorta(fecha)} hasta nuevo aviso.`}</p></div>
            <Campo etiqueta="Instrucción (opcional)" ayuda="Ej.: empezar por el piso 3, apartamentos 301 a 304"><Textarea rows={2} maxLength={300} value={instruccion} onChange={(e) => setInstruccion(e.target.value)} /></Campo></>}
          <div className="flex justify-end gap-2"><Boton variante="secundario" onClick={() => setAbierto(false)}>Cancelar</Boton><Boton onClick={asignar}>{actividad === "" ? "Quitar tarea" : "Asignar"}</Boton></div>
        </div>
      </Modal>
    </>
  );
}

// ---------- Paso 2: avance del día ----------
function PasoAvance({ obraId, fecha, d, disponibles, personal, tareas, registros, semana, motivos, puedeEscribir, recargar, irTareas }: { obraId: string; fecha: string; d: DatosObra; disponibles: Persona[]; personal: Persona[]; tareas: Record<string, TareaV>; registros: RegistroT[]; semana: Record<string, number>; motivos: string[]; puedeEscribir: boolean; recargar: () => Promise<void>; irTareas: () => void }) {
  const porActividad = new Map<string, Persona[]>();
  for (const p of disponibles) { const a = tareas[p.trabajador_id]?.actividad_id; if (a) porActividad.set(a, [...(porActividad.get(a) ?? []), p]); }
  for (const r of registros) if (!porActividad.has(r.actividad_id)) porActividad.set(r.actividad_id, []);
  const tarjetas = d.actividades.filter((a) => porActividad.has(a.id)).map((a) => ({ a, registro: registros.find((r) => r.actividad_id === a.id), gente: porActividad.get(a.id)! })).sort((x, y) => Number(!!x.registro) - Number(!!y.registro));
  if (tarjetas.length === 0) return <div className="mt-4 max-w-3xl"><Vacio>Aún no hay tareas asignadas para este día. Primero asigne a cada persona la actividad que va a hacer. <Boton className="ml-2" onClick={irTareas}>Asignar tareas</Boton></Vacio></div>;
  return (
    <div className="mt-4 max-w-3xl space-y-4">
      <p className="text-sm text-slate-500">Escriba cuánto avanzó cada persona hoy. La app suma el total de la actividad y lo descuenta del saldo del contrato.</p>
      {tarjetas.map(({ a, registro, gente }) => <TarjetaAvance key={`${fecha}|${a.id}|${registro?.creado ?? "nuevo"}`} obraId={obraId} fecha={fecha} a={a} registro={registro} gente={gente} personal={personal} semana={semana} motivos={motivos} puedeEscribir={puedeEscribir} recargar={recargar} obraNombre={d.obra.nombre} />)}
    </div>
  );
}

function TarjetaAvance({ obraId, fecha, a, registro, gente, personal, semana, motivos, puedeEscribir, recargar, obraNombre }: { obraId: string; fecha: string; a: ActividadT; registro?: RegistroT; gente: Persona[]; personal: Persona[]; semana: Record<string, number>; motivos: string[]; puedeEscribir: boolean; recargar: () => Promise<void>; obraNombre: string }) {
  const aviso = useAviso();
  const camara = useRef<HTMLInputElement>(null);
  const ids = [...new Set([...gente.map((p) => p.trabajador_id), ...(registro?.trabajadores ?? [])])];
  const nombre = (id: string) => personal.find((p) => p.trabajador_id === id)?.nombre ?? "—";
  const [valores, setValores] = useState<Record<string, string>>(() => { const m: Record<string, string> = {}; for (const id of ids) { const v = registro?.por_trabajador?.[id] ?? (registro?.trabajadores?.includes(id) ? registro.cantidad / registro.trabajadores.length : undefined); m[id] = v === undefined ? "" : String(Math.round(v * 100) / 100); } return m; });
  const [horas, setHoras] = useState(String(registro?.horas_atraso ?? 0));
  const [motivo, setMotivo] = useState<string | undefined>(registro?.motivo_atraso ?? undefined);
  const [acciones, setAcciones] = useState(registro?.acciones ?? "");
  const [obs, setObs] = useState(registro?.observaciones ?? "");
  const [fotos, setFotos] = useState<string[]>(registro?.fotos ?? []);
  const [intento, setIntento] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [sucio, setSucio] = useState(false);
  const cambia = <T,>(f: (v: T) => void) => (v: T) => { f(v); setSucio(true); };

  const total = Object.values(valores).reduce((s, v) => s + (v.trim() ? num(v) || 0 : 0), 0);
  const saldo = a.cantidad - a.ejecutado + (registro?.cantidad ?? 0);
  const errores: string[] = [];
  if (Object.entries(valores).some(([, v]) => v.trim() && !(num(v) >= 0))) errores.push("Hay valores que no son números válidos");
  if (Object.values(valores).every((v) => !v.trim())) errores.push("Escriba el avance de al menos una persona (0 si no avanzó)");
  if (total > saldo + 1e-9) errores.push(`El total (${fmtNum(total)} ${a.um}) supera el saldo del contrato (${fmtNum(saldo)} ${a.um})`);
  if (num(horas) > 0 && !motivo) errores.push("Seleccione el motivo del atraso");
  if (num(horas) > 0 && !acciones.trim()) errores.push("Describa la acción para recuperar el atraso");

  async function guardar() {
    setIntento(true);
    if (errores.length) return;
    const por: Record<string, number> = {};
    for (const [id, v] of Object.entries(valores)) if (v.trim()) por[id] = num(v);
    try {
      await api("bitacora", { method: "PUT", body: { obra_id: obraId, fecha, actividad_id: a.id, cantidad: total, trabajadores: Object.keys(por), por_trabajador: por, horas_atraso: num(horas) || 0, motivo_atraso: num(horas) > 0 ? motivo : null, acciones: acciones.trim(), observaciones: obs.trim(), fotos } });
      aviso(`Avance guardado: ${fmtNum(total)} ${a.um} en ${nombreActividad(a)}`); await recargar();
    } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo guardar", "error"); }
  }
  async function eliminar() {
    if (!registro || !confirm(`¿Eliminar el avance de hoy en ${nombreActividad(a)}? Se borran también sus fotos.`)) return;
    try { await api(`bitacora/${registro.id}`, { method: "DELETE" }); aviso("Avance eliminado"); await recargar(); } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo eliminar", "error"); }
  }
  async function subir(files: FileList | null) {
    if (!files?.length) return;
    setSubiendo(true);
    try {
      const hora = new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
      const nuevas: string[] = [];
      for (const f of [...files]) { const uri = await procesarFoto(f, `${obraNombre} · ${fecha} ${hora} · ${nombreActividad(a)}`); nuevas.push((await api<{ id: string }>("fotos", { method: "POST", body: { obra_id: obraId, datos: uri } })).id); }
      setFotos((x) => [...x, ...nuevas]); setSucio(true);
    } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo procesar la foto", "error"); } finally { setSubiendo(false); if (camara.current) camara.current.value = ""; }
  }
  const pctTotal = Math.min(1, (a.ejecutado - (registro?.cantidad ?? 0) + total) / a.cantidad);
  const lectura = !puedeEscribir;
  return (
    <section className={`rounded-xl border bg-white p-4 sm:p-5 ${registro && !sucio ? "border-green-300" : "border-slate-200"}`}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 basis-48"><h2 className="font-bold">{nombreActividad(a)}</h2>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500"><span className="w-24"><BarraAvance valor={pctTotal} etiqueta={`Avance ${a.nombre}`} /></span>Saldo {fmtNum(Math.max(0, saldo - total))} {a.um} después de hoy</div></div>
        {registro && !sucio ? <Insignia tono="verde">Guardado</Insignia> : sucio ? <Insignia tono="ambar">Sin guardar</Insignia> : <Insignia>Pendiente</Insignia>}
      </header>
      <ul className="divide-y divide-slate-100">{ids.map((id) => { const sem = semana[`${id}|${a.id}`] ?? 0; return (
        <li key={id} className="flex items-center gap-3 py-2"><label htmlFor={`av-${a.id}-${id}`} className="min-w-0 flex-1"><span className="block font-semibold">{nombre(id)}</span><span className="block text-xs text-slate-500">{sem > 0 ? `Esta semana en esta actividad: ${fmtNum(sem)} ${a.um}` : "Primer día en esta actividad esta semana"}</span></label>
          <div className="flex shrink-0 items-center gap-1.5"><Input id={`av-${a.id}-${id}`} className="w-24 text-right" inputMode="decimal" placeholder="0" disabled={lectura} value={valores[id] ?? ""} onChange={(e) => cambia(setValores)({ ...valores, [id]: e.target.value })} /><span className="w-8 text-sm text-slate-500">{a.um}</span></div></li>); })}</ul>
      <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"><span className="text-sm font-semibold">Total de la actividad hoy</span><span className="text-lg font-extrabold">{fmtNum(total)} {a.um}</span></div>
      <details className="mt-3" open={!!registro?.horas_atraso || undefined}><summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-marca">Atraso, acciones y fotos {num(horas) > 0 && <Insignia tono="ambar">{horas} h de atraso</Insignia>} {fotos.length > 0 && <Insignia tono="azul">{fotos.length} fotos</Insignia>}</summary>
        <div className="space-y-4 pt-2">
          <Campo etiqueta="Horas de atraso / desperdicio" ayuda="0 si no hubo atraso"><Input className="max-w-40" inputMode="decimal" disabled={lectura} value={horas} onChange={(e) => cambia(setHoras)(e.target.value)} /></Campo>
          {num(horas) > 0 && <>
            <fieldset><legend className="mb-1.5 text-sm font-semibold">Motivo del atraso</legend><div className="flex flex-wrap gap-2">{motivos.map((m) => <button key={m} type="button" disabled={lectura} aria-pressed={motivo === m} onClick={() => cambia(setMotivo)(m)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${motivo === m ? "border-marca bg-marca text-sobre-marca" : "border-slate-300 bg-white"}`}>{m}</button>)}</div></fieldset>
            <Campo etiqueta="Acciones para recuperar el atraso"><Textarea rows={2} disabled={lectura} value={acciones} onChange={(e) => cambia(setAcciones)(e.target.value)} /></Campo></>}
          <Campo etiqueta="Observaciones (opcional)"><Textarea rows={2} disabled={lectura} value={obs} onChange={(e) => cambia(setObs)(e.target.value)} /></Campo>
          <div><p className="mb-1.5 text-sm font-semibold">Fotos de la actividad</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{fotos.map((id) => <Miniatura key={id} id={id} onQuitar={lectura ? undefined : () => { setFotos((x) => x.filter((y) => y !== id)); setSucio(true); }} />)}
              {!lectura && <button type="button" onClick={() => camara.current?.click()} disabled={subiendo} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-sm font-semibold text-marca hover:bg-slate-50">{subiendo ? "Procesando" : "+ Agregar"}</button>}</div>
            <input ref={camara} type="file" accept="image/*" capture="environment" multiple className="sr-only" tabIndex={-1} onChange={(e) => subir(e.target.files)} /></div>
        </div></details>
      {intento && errores.length > 0 && <ul role="alert" className="mt-3 space-y-1 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{errores.map((e) => <li key={e}>{e}</li>)}</ul>}
      {!lectura && <footer className="mt-3 flex items-center justify-between gap-2">{registro ? <Boton variante="fantasma" className="!text-red-700" onClick={eliminar}>Eliminar</Boton> : <span />}<Boton onClick={guardar} disabled={!!registro && !sucio}>{registro ? (sucio ? "Guardar cambios" : "Guardado") : "Guardar avance"}</Boton></footer>}
    </section>
  );
}
