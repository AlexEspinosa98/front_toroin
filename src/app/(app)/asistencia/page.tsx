"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { esFestivo, diaSemana, fechaLarga, hoy } from "@/lib/fechas";
import { CheckCheck, CircleAlert, ShieldAlert } from "lucide-react";
import { Aviso, Boton, Campo, Chip, Input, Segmentado, Select, Tarjeta, Titulo, Vacio, enfocarPrimerError, useAviso } from "@/components/ui";
import { ChipHabilitacion, SelectorObra } from "@/components/comunes";
import { useObras } from "@/lib/obras";

type Hab = { estado: "habilitado" | "por-vencer" | "vencido" | "sin-datos"; motivo: string };
type Fila = { trabajador_id: string; nombre: string; cargo: string; habilitacion: Hab; puede_trabajar: boolean; marca: { asistio: boolean; motivo: string | null; detalle: string } | null };
type Resp = { registrada: boolean; personal: Fila[]; motivos: string[] };
type Marca = { asistio?: boolean; motivo?: string; detalle?: string };

export default function Asistencia() {
  const { me } = useSession();
  const aviso = useAviso();
  const { obras, cargando, obraId, setObraId, error: errObras } = useObras();
  const [fecha, setFecha] = useState(hoy());
  const [datos, setDatos] = useState<Resp | null>(null);
  const [marcas, setMarcas] = useState<Record<string, Marca>>({});
  const [intento, setIntento] = useState(false);
  const [error, setError] = useState("");
  const puedeEscribir = !me.solo_lectura && me.licencia?.escritura && ["admin", "gerencia", "sst", "residente", "super_admin"].includes(me.rol);

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
    if (sinMarcar > 0 || sinMotivo > 0) return enfocarPrimerError();
    try {
      await api("asistencia", { method: "PUT", body: { obra_id: obraId, fecha, marcas: hab.map((p) => { const m = marcas[p.trabajador_id]; return { trabajador_id: p.trabajador_id, asistio: !!m.asistio, motivo: m.asistio ? null : m.motivo ?? null, detalle: m.detalle ?? "" }; }) } });
      aviso(`Asistencia guardada: ${presentes} presentes, ${ausentes} ausentes`); void cargar();
    } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo guardar", "error"); }
  }

  return (
    <>
      <Titulo sub="Registro del encargado SST">Asistencia diaria</Titulo>
      <div className="grid max-w-2xl gap-3 sm:grid-cols-[1fr_220px]">
        <SelectorObra obras={obras} valor={obraId} onChange={setObraId} />
        <Campo etiqueta="Fecha"><Input type="date" value={fecha} max={hoy()} onChange={(e) => e.target.value && setFecha(e.target.value)} /></Campo>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-suave">
        {fechaLarga(fecha)}{festivo && <Chip tono="acento">Festivo: {festivo.nombre}</Chip>}{diaSemana(fecha) === 0 && <span>· Domingo</span>}
        {datos?.registrada && <Chip tono="ok" icono={<CheckCheck className="size-3.5" aria-hidden />}>Ya registrada, puede corregirla</Chip>}
      </p>
      {(error || errObras) && <div className="mt-3"><Aviso tono="error">{error || errObras}</Aviso></div>}
      {!cargando && !obras.length && !error && !errObras && <div className="mt-4"><Vacio titulo="Primero cree una obra" texto="La asistencia se registra por obra." /></div>}

      {datos && <>
        <div className="mt-4 grid max-w-2xl grid-cols-3 gap-2">
          {([["Presentes", presentes, "text-ok"], ["Ausentes", ausentes, "text-error"], ["Sin marcar", sinMarcar, "text-suave"]] as const).map(([t, n, c]) => (
            <div key={t} className="rounded-xl border border-borde bg-white p-3 text-center"><p className={`num text-2xl font-extrabold ${c}`}>{n}</p><p className="text-xs font-semibold text-suave">{t}</p></div>
          ))}
        </div>
        {datos.personal.length === 0 ? <div className="mt-5"><Vacio icono={<ShieldAlert className="size-6" aria-hidden />} titulo="No hay personal asignado a esta obra" texto="RRHH asigna el personal desde el módulo Personal, con su fecha de ingreso." /></div> : <>
          <Tarjeta className="mt-5 max-w-3xl" titulo={`Personal habilitado (${hab.length})`} sub="Examen médico y curso de alturas vigentes"
            acciones={puedeEscribir && <Boton variante="secundario" tam="sm" icono={<CheckCheck className="size-4" aria-hidden />} onClick={() => hab.forEach((p) => marcas[p.trabajador_id]?.asistio === undefined && set(p.trabajador_id, { asistio: true }))}>Resto presentes</Boton>}>
            <ul className="divide-y divide-borde">
              {hab.map((p) => { const m = marcas[p.trabajador_id] ?? {}; return (
                <li key={p.trabajador_id} className="py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0"><p className="font-semibold">{p.nombre}</p>
                      <p className="text-xs text-suave">{p.cargo || "Sin cargo registrado"}{p.habilitacion.estado === "por-vencer" && <span className="font-semibold text-alerta"> · {p.habilitacion.motivo}</span>}</p></div>
                    <Segmentado etiqueta={`Asistencia de ${p.nombre}`} valor={m.asistio === undefined ? undefined : m.asistio ? "si" : "no"} ancho deshabilitado={!puedeEscribir}
                      onChange={(v) => set(p.trabajador_id, { asistio: v === "si" })}
                      opciones={[{ valor: "si", texto: "Asistió", tono: "ok" }, { valor: "no", texto: "No asistió", tono: "error" }]} />
                  </div>
                  {intento && m.asistio === undefined && <p className="mt-1 text-sm font-medium text-error" data-error="true" tabIndex={-1}>Marque si asistió o no</p>}
                  {m.asistio === false && <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Select aria-label={`Motivo de ${p.nombre}`} aria-invalid={(intento && !m.motivo) || undefined} value={m.motivo ?? ""} disabled={!puedeEscribir} onChange={(e) => set(p.trabajador_id, { motivo: e.target.value })}>
                      <option value="">Motivo de la inasistencia…</option>{datos.motivos.map((x) => <option key={x}>{x}</option>)}</Select>
                    <Input aria-label="Detalle" placeholder="Detalle (opcional)" maxLength={300} value={m.detalle ?? ""} disabled={!puedeEscribir} onChange={(e) => set(p.trabajador_id, { detalle: e.target.value })} />
                    {intento && !m.motivo && <p className="text-sm font-medium text-error sm:col-span-2">Seleccione el motivo</p>}
                  </div>}
                </li>); })}
            </ul>
          </Tarjeta>
          {noHab.length > 0 && <Tarjeta className="mt-5 max-w-3xl border-error/30" titulo={`No habilitados para ingresar (${noHab.length})`} sub="No pueden registrarse como presentes hasta renovar su examen o curso">
            <ul className="divide-y divide-borde">{noHab.map((p) => <li key={p.trabajador_id} className="flex items-center justify-between gap-2 py-2.5"><div><p className="font-semibold">{p.nombre}</p><p className="text-sm text-error">{p.habilitacion.motivo}</p></div><ChipHabilitacion e={p.habilitacion.estado} /></li>)}</ul>
          </Tarjeta>}
          {puedeEscribir && hab.length > 0 && <div className="sobre-nav sticky z-10 mt-5 flex max-w-3xl flex-col gap-2 rounded-xl border border-borde bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            {intento && (sinMarcar > 0 || sinMotivo > 0) ? <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-error"><CircleAlert className="size-4 shrink-0" aria-hidden />{sinMarcar > 0 ? `Faltan ${sinMarcar} personas por marcar` : `Faltan ${sinMotivo} motivos de inasistencia`}</p>
              : <p className="text-sm text-suave">{presentes} presentes · {ausentes} ausentes · {sinMarcar} sin marcar</p>}
            <Boton tam="lg" onClick={guardar}>Guardar asistencia</Boton></div>}
        </>}
      </>}
    </>
  );
}
