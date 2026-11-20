"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { esFestivo, diaSemana, fechaLarga, hoy } from "@/lib/fechas";
import { Aviso, Boton, Campo, Input, Insignia, Select, Tarjeta, Titulo, Vacio, useAviso } from "@/components/ui";

type Obra = { id: string; nombre: string };
type Hab = { estado: "habilitado" | "por-vencer" | "vencido" | "sin-datos"; motivo: string };
type Fila = { trabajador_id: string; nombre: string; cargo: string; habilitacion: Hab; puede_trabajar: boolean; marca: { asistio: boolean; motivo: string | null; detalle: string } | null };
type Resp = { registrada: boolean; personal: Fila[]; motivos: string[] };
type Marca = { asistio?: boolean; motivo?: string; detalle?: string };
const TONO = { habilitado: "verde", "por-vencer": "ambar", vencido: "rojo", "sin-datos": "gris" } as const;

export default function Asistencia() {
  const { me } = useSession();
  const aviso = useAviso();
  const [obras, setObras] = useState<Obra[]>([]);
  const [obraId, setObraId] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [datos, setDatos] = useState<Resp | null>(null);
  const [marcas, setMarcas] = useState<Record<string, Marca>>({});
  const [intento, setIntento] = useState(false);
  const [error, setError] = useState("");
  const puedeEscribir = !me.solo_lectura && me.licencia?.escritura && ["admin", "gerencia", "sst", "residente", "super_admin"].includes(me.rol);

  useEffect(() => { api<Obra[]>("obras").then((o) => { setObras(o); setObraId((x) => x || o[0]?.id || ""); }).catch((e) => setError(e.message)); }, []);
  const cargar = useCallback(() => {
    if (!obraId) return;
    api<Resp>(`asistencia?obra_id=${obraId}&fecha=${fecha}`).then((r) => {
      setDatos(r); setIntento(false); setError("");
      const m: Record<string, Marca> = {};
      for (const p of r.personal) if (p.marca) m[p.trabajador_id] = { asistio: p.marca.asistio, motivo: p.marca.motivo ?? undefined, detalle: p.marca.detalle };
      setMarcas(m);
    }).catch((e) => setError(e.message));
  }, [obraId, fecha]);
  useEffect(() => { void cargar(); }, [cargar]);

  const hab = useMemo(() => (datos?.personal ?? []).filter((p) => p.puede_trabajar), [datos]);
  const noHab = useMemo(() => (datos?.personal ?? []).filter((p) => !p.puede_trabajar), [datos]);
  const presentes = hab.filter((p) => marcas[p.trabajador_id]?.asistio === true).length;
  const ausentes = hab.filter((p) => marcas[p.trabajador_id]?.asistio === false).length;
  const sinMarcar = hab.length - presentes - ausentes;
  const sinMotivo = hab.filter((p) => marcas[p.trabajador_id]?.asistio === false && !marcas[p.trabajador_id]?.motivo).length;
  const festivo = esFestivo(fecha);
  const set = (id: string, m: Marca) => setMarcas((x) => ({ ...x, [id]: { ...x[id], ...m } }));

  async function guardar() {
    setIntento(true);
    if (sinMarcar > 0 || sinMotivo > 0) return;
    try {
      await api("asistencia", { method: "PUT", body: { obra_id: obraId, fecha, marcas: hab.map((p) => { const m = marcas[p.trabajador_id]; return { trabajador_id: p.trabajador_id, asistio: !!m.asistio, motivo: m.asistio ? null : m.motivo ?? null, detalle: m.detalle ?? "" }; }) } });
      aviso(`Asistencia guardada: ${presentes} presentes, ${ausentes} ausentes`); void cargar();
    } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo guardar", "error"); }
  }

  return (
    <>
      <Titulo sub="Registro del encargado SST">Asistencia diaria</Titulo>
      <div className="grid max-w-2xl gap-3 sm:grid-cols-[1fr_220px]">
        <Campo etiqueta="Obra"><Select value={obraId} onChange={(e) => setObraId(e.target.value)}>{obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Select></Campo>
        <Campo etiqueta="Fecha"><Input type="date" value={fecha} max={hoy()} onChange={(e) => e.target.value && setFecha(e.target.value)} /></Campo>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
        {fechaLarga(fecha)}{festivo && <Insignia tono="azul">Festivo: {festivo.nombre}</Insignia>}{diaSemana(fecha) === 0 && <span>· Domingo</span>}
        {datos?.registrada && <Insignia tono="verde">Ya registrada, puede corregirla</Insignia>}
      </p>
      {error && <div className="mt-3"><Aviso tono="error">{error}</Aviso></div>}
      {!obras.length && !error && <div className="mt-4"><Vacio>Primero cree una obra.</Vacio></div>}

      {datos && <>
        <div className="mt-4 grid max-w-2xl grid-cols-3 gap-2">
          {([["Presentes", presentes, "text-green-700"], ["Ausentes", ausentes, "text-red-700"], ["Sin marcar", sinMarcar, "text-slate-500"]] as const).map(([t, n, c]) => (
            <div key={t} className="rounded-xl border border-slate-200 bg-white p-3 text-center"><p className={`text-2xl font-extrabold ${c}`}>{n}</p><p className="text-xs font-semibold text-slate-500">{t}</p></div>
          ))}
        </div>
        {datos.personal.length === 0 ? <div className="mt-5"><Vacio>No hay personal asignado a esta obra en esa fecha. Asígnelo desde el módulo Personal.</Vacio></div> : <>
          <Tarjeta className="mt-5 max-w-3xl" titulo={`Personal habilitado (${hab.length})`}
            acciones={puedeEscribir && <Boton variante="secundario" className="!min-h-9" onClick={() => hab.forEach((p) => marcas[p.trabajador_id]?.asistio === undefined && set(p.trabajador_id, { asistio: true }))}>Resto presentes</Boton>}>
            <ul className="divide-y divide-slate-100">
              {hab.map((p) => { const m = marcas[p.trabajador_id] ?? {}; return (
                <li key={p.trabajador_id} className="py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0"><p className="font-semibold">{p.nombre}</p>
                      <p className="text-xs text-slate-500">{p.cargo || "Sin cargo registrado"}{p.habilitacion.estado === "por-vencer" && <span className="font-semibold text-amber-700"> · {p.habilitacion.motivo}</span>}</p></div>
                    <div className="flex gap-2" role="group" aria-label={`Asistencia de ${p.nombre}`}>
                      <Boton variante={m.asistio === true ? "primario" : "secundario"} disabled={!puedeEscribir} onClick={() => set(p.trabajador_id, { asistio: true })}>Asistió</Boton>
                      <Boton variante={m.asistio === false ? "peligro" : "secundario"} disabled={!puedeEscribir} onClick={() => set(p.trabajador_id, { asistio: false })}>No asistió</Boton>
                    </div>
                  </div>
                  {intento && m.asistio === undefined && <p className="mt-1 text-sm font-medium text-red-700">Marque si asistió o no</p>}
                  {m.asistio === false && <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Select aria-label={`Motivo de ${p.nombre}`} value={m.motivo ?? ""} disabled={!puedeEscribir} onChange={(e) => set(p.trabajador_id, { motivo: e.target.value })}>
                      <option value="">Motivo de la inasistencia…</option>{datos.motivos.map((x) => <option key={x}>{x}</option>)}</Select>
                    <Input aria-label="Detalle" placeholder="Detalle (opcional)" maxLength={300} value={m.detalle ?? ""} disabled={!puedeEscribir} onChange={(e) => set(p.trabajador_id, { detalle: e.target.value })} />
                    {intento && !m.motivo && <p className="text-sm font-medium text-red-700 sm:col-span-2">Seleccione el motivo</p>}
                  </div>}
                </li>); })}
            </ul>
          </Tarjeta>
          {noHab.length > 0 && <Tarjeta className="mt-5 max-w-3xl border-red-200" titulo={`No habilitados para ingresar (${noHab.length})`}>
            <p className="mb-2 text-sm text-slate-500">No pueden registrarse como presentes hasta renovar su examen o curso.</p>
            <ul className="divide-y divide-slate-100">{noHab.map((p) => <li key={p.trabajador_id} className="flex items-center justify-between gap-2 py-2.5"><div><p className="font-semibold">{p.nombre}</p><p className="text-sm text-red-700">{p.habilitacion.motivo}</p></div><Insignia tono={TONO[p.habilitacion.estado]}>No habilitado</Insignia></li>)}</ul>
          </Tarjeta>}
          {puedeEscribir && hab.length > 0 && <div className="sticky bottom-3 z-10 mt-5 flex max-w-3xl flex-col gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between">
            {intento && (sinMarcar > 0 || sinMotivo > 0) ? <p role="alert" className="text-sm font-medium text-red-700">{sinMarcar > 0 ? `Faltan ${sinMarcar} personas por marcar` : `Faltan ${sinMotivo} motivos de inasistencia`}</p>
              : <p className="text-sm text-slate-500">{presentes} presentes · {ausentes} ausentes · {sinMarcar} sin marcar</p>}
            <Boton onClick={guardar}>Guardar asistencia</Boton></div>}
        </>}
      </>}
    </>
  );
}
