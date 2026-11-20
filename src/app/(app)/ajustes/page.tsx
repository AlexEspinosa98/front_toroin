"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { fechaCorta, fmtCOP } from "@/lib/format";
import { hoy } from "@/lib/fechas";
import { Aviso, Boton, Campo, Input, Select, Tarjeta, Titulo, useAviso } from "@/components/ui";

type Cfg = { semana: "LS" | "LV"; regla_dominical: "legal" | "literal"; modalidad_pago: "jornal" | "destajo"; jornal_base: number; factor_prestacional: number; festivos_extra: string[]; smmlv: number; aux_transporte: number; jornal_minimo: number };
type Fest = { fecha: string; nombre: string };

export default function Ajustes() {
  const { me } = useSession();
  const aviso = useAviso();
  const [c, setC] = useState<Cfg | null>(null);
  const [fest, setFest] = useState<Fest[]>([]);
  const [anio, setAnio] = useState(Number(hoy().slice(0, 4)));
  const [nuevo, setNuevo] = useState("");
  const [error, setError] = useState("");
  const puede = !me.solo_lectura && me.licencia?.escritura && ["admin", "gerencia", "super_admin"].includes(me.rol);

  useEffect(() => { api<Cfg>("config").then(setC).catch((e) => setError(e.message)); }, []);
  useEffect(() => { api<Fest[]>(`festivos?anio=${anio}`).then(setFest).catch(() => setFest([])); }, [anio]);

  async function guardar(x: Cfg) {
    try { const r = await api<Cfg>("config", { method: "PUT", body: x }); setC(r); aviso("Ajustes guardados"); }
    catch (e) { aviso(e instanceof Error ? e.message : "Error", "error"); }
  }
  if (!c) return <>{error ? <Aviso tono="error">{error}</Aviso> : <p className="text-sm text-slate-500">Cargando…</p>}</>;
  const set = <K extends keyof Cfg>(k: K, v: Cfg[K]) => setC({ ...c, [k]: v });

  return (
    <>
      <Titulo sub="Reglas de nómina y calendario de la empresa">Ajustes</Titulo>
      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta titulo="Reglas de pago">
          <div className="grid gap-3">
            <Campo etiqueta="Modalidad de pago"><Select disabled={!puede} value={c.modalidad_pago} onChange={(e) => set("modalidad_pago", e.target.value as Cfg["modalidad_pago"])}><option value="jornal">Jornal (día trabajado)</option><option value="destajo">Destajo (por avance de actividad)</option></Select></Campo>
            <Campo etiqueta="Semana laboral"><Select disabled={!puede} value={c.semana} onChange={(e) => set("semana", e.target.value as Cfg["semana"])}><option value="LS">Lunes a sábado</option><option value="LV">Lunes a viernes</option></Select></Campo>
            <Campo etiqueta="Regla del dominical" ayuda="Legal: se reconoce con la semana completa (art. 173 CST). Literal: más de 5 días asistidos."><Select disabled={!puede} value={c.regla_dominical} onChange={(e) => set("regla_dominical", e.target.value as Cfg["regla_dominical"])}><option value="legal">Legal (semana completa)</option><option value="literal">Más de 5 días</option></Select></Campo>
            <Campo etiqueta="Jornal base (COP)" ayuda={`Se usa cuando el trabajador no tiene jornal propio. Mínimo legal diario: ${fmtCOP(c.jornal_minimo)}`}><Input disabled={!puede} type="number" min={1} value={c.jornal_base} onChange={(e) => set("jornal_base", Number(e.target.value))} /></Campo>
            <Campo etiqueta="Factor prestacional" ayuda="Multiplica el costo de mano de obra por actividad (1 = sin prestaciones)"><Input disabled={!puede} type="number" step="0.01" min={1} max={3} value={c.factor_prestacional} onChange={(e) => set("factor_prestacional", Number(e.target.value))} /></Campo>
            <p className="text-xs text-slate-500">Parámetros legales vigentes: SMMLV {fmtCOP(c.smmlv)} · auxilio de transporte {fmtCOP(c.aux_transporte)} (los administra la plataforma).</p>
            {puede && <Boton onClick={() => guardar(c)}>Guardar ajustes</Boton>}
          </div>
        </Tarjeta>
        <Tarjeta titulo="Días no laborables adicionales" acciones={<span className="text-xs text-slate-500">Se tratan como festivos</span>}>
          {puede && (
            <div className="mb-3 flex gap-2"><Input type="date" value={nuevo} onChange={(e) => setNuevo(e.target.value)} />
              <Boton variante="secundario" disabled={!nuevo || c.festivos_extra.includes(nuevo)} onClick={() => { void guardar({ ...c, festivos_extra: [...c.festivos_extra, nuevo].sort() }); setNuevo(""); }}>Agregar</Boton></div>
          )}
          {!c.festivos_extra.length ? <p className="text-sm text-slate-500">Ninguno.</p> : c.festivos_extra.map((f) => (
            <div key={f} className="flex items-center justify-between py-1 text-sm"><span>{fechaCorta(f)}</span>{puede && <Boton variante="fantasma" onClick={() => guardar({ ...c, festivos_extra: c.festivos_extra.filter((x) => x !== f) })}>Quitar</Boton>}</div>
          ))}
        </Tarjeta>
      </div>
      <div className="mt-6">
        <Tarjeta titulo={`Festivos de Colombia ${anio}`} acciones={<Select value={anio} onChange={(e) => setAnio(Number(e.target.value))}>{[-1, 0, 1, 2].map((d) => <option key={d}>{Number(hoy().slice(0, 4)) + d}</option>)}</Select>}>
          <div className="grid gap-x-6 sm:grid-cols-2">{fest.map((f) => <div key={f.fecha} className="flex justify-between py-1 text-sm"><span>{f.nombre}</span><span className="text-slate-500">{fechaCorta(f.fecha)}</span></div>)}</div>
        </Tarjeta>
      </div>
    </>
  );
}
