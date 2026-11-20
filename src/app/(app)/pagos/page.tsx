"use client";
import { Fragment, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { descargarCSV, quincenas } from "@/lib/csv";
import { fechaCorta, fmtCOP, fmtNum } from "@/lib/format";
import { hoy } from "@/lib/fechas";
import { Aviso, Boton, Campo, Input, Insignia, Select, Tabla, Tarjeta, Titulo, Vacio, useAviso } from "@/components/ui";
import { Indicador } from "@/components/comunes";

type Obra = { id: string; nombre: string };
type Det = { fecha: string; actividad: string; ubicacion: string; um: string; parte: number; tarifa: number; valor: number; medido: boolean; integrantes: number };
type Fila = { trabajador_id: string; nombre: string; cedula: string; cargo: string; jornal: number; dias: { dias_asistidos: number; domingos: number; festivos: number }; detalle: Det[]; sin_tarifa: number; basico: number; descansos: number; dias_descanso: number; ajuste_minimo: number; devengado: number; auxilio: number; salud: number; pension: number; neto: number };
type Costo = { actividad_id: string; nombre: string; ubicacion: string; um: string; cantidad: number; ingreso: number; costo: number; margen: number; costo_unitario: number; valor_unitario: number };
type Resp = { config: { modalidad_pago: string; jornal_minimo: number; jornal_base: number }; filas: Fila[]; totales: Record<string, number>; costos: Costo[]; sin_tarifa: number };
type Tarifa = { id: string; nombre: string; ubicacion: string; um: string; valor_unitario: number; tarifa: number | null };
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default function Pagos() {
  const { me } = useSession();
  const aviso = useAviso();
  const h = hoy();
  const [anio, setAnio] = useState(Number(h.slice(0, 4)));
  const [mes, setMes] = useState(Number(h.slice(5, 7)));
  const [per, setPer] = useState<"q1" | "q2" | "mes">(Number(h.slice(8, 10)) <= 15 ? "q1" : "q2");
  const [obras, setObras] = useState<Obra[]>([]);
  const [obraId, setObraId] = useState("");
  const [datos, setDatos] = useState<Resp | null>(null);
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [desde, hasta] = quincenas(anio, mes)[per];
  const puede = !me.solo_lectura && me.licencia?.escritura && ["admin", "gerencia", "super_admin"].includes(me.rol);

  useEffect(() => { api<Obra[]>("obras").then((o) => { setObras(o); setObraId((x) => x || o[0]?.id || ""); }).catch((e) => setError(e.message)); }, []);
  const cargar = useCallback(() => {
    api<Resp>(`pagos?desde=${desde}&hasta=${hasta}${obraId ? `&obra_id=${obraId}` : ""}`).then((r) => { setDatos(r); setError(""); }).catch((e) => setError(e.message));
    if (obraId) api<Tarifa[]>(`tarifas?obra_id=${obraId}`).then(setTarifas).catch(() => setTarifas([]));
  }, [desde, hasta, obraId]);
  useEffect(() => { setDatos(null); cargar(); }, [cargar]);

  async function fijar(id: string, v: string) {
    try { await api(`actividades/${id}/tarifa`, { method: "PATCH", body: { tarifa: v === "" ? null : Number(v) } }); aviso("Tarifa guardada"); cargar(); }
    catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); }
  }
  const f = datos?.filas ?? [];
  const destajo = datos?.config.modalidad_pago === "destajo";
  const exportar = () => descargarCSV(`prenomina-${desde}_${hasta}.csv`, [
    ["Nombre", "Cédula", "Cargo", "Días", "Descansos", "Básico", "Descansos $", "Ajuste mínimo", "Devengado", "Aux. transporte", "Salud", "Pensión", "Neto"],
    ...f.map((x) => [x.nombre, x.cedula, x.cargo, x.dias.dias_asistidos, x.dias_descanso, Math.round(x.basico), Math.round(x.descansos), Math.round(x.ajuste_minimo), Math.round(x.devengado), Math.round(x.auxilio), Math.round(x.salud), Math.round(x.pension), Math.round(x.neto)]),
  ]);

  return (
    <>
      <Titulo sub={`Modalidad: ${destajo ? "destajo por actividad" : "jornal"} · se cambia en Ajustes`} acciones={<Boton variante="secundario" onClick={exportar} disabled={!f.length}>Exportar prenómina</Boton>}>Pagos al personal</Titulo>
      <div className="grid max-w-4xl gap-3 sm:grid-cols-4">
        <Campo etiqueta="Mes"><Select value={mes} onChange={(e) => setMes(Number(e.target.value))}>{MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</Select></Campo>
        <Campo etiqueta="Año"><Select value={anio} onChange={(e) => setAnio(Number(e.target.value))}>{[-1, 0, 1].map((d) => <option key={d}>{Number(h.slice(0, 4)) + d}</option>)}</Select></Campo>
        <Campo etiqueta="Periodo"><Select value={per} onChange={(e) => setPer(e.target.value as "q1" | "q2" | "mes")}><option value="q1">Primera quincena</option><option value="q2">Segunda quincena</option><option value="mes">Mes completo</option></Select></Campo>
        <Campo etiqueta="Obra"><Select value={obraId} onChange={(e) => setObraId(e.target.value)}><option value="">Todas</option>{obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Select></Campo>
      </div>
      <p className="mt-1 text-sm text-slate-500">{fechaCorta(desde)} – {fechaCorta(hasta)}</p>
      {error && <div className="mt-3"><Aviso tono="error">{error}</Aviso></div>}
      {datos && (
        <>
          {destajo && datos.sin_tarifa > 0 && <div className="mt-3"><Aviso tono="alerta">Hay {datos.sin_tarifa} registro(s) de avance en actividades sin tarifa: no suman al pago. Defina las tarifas abajo.</Aviso></div>}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Indicador etiqueta="Devengado" valor={fmtCOP(datos.totales.devengado)} />
            <Indicador etiqueta="Aux. transporte" valor={fmtCOP(datos.totales.auxilio)} />
            <Indicador etiqueta="Deducciones" valor={fmtCOP(datos.totales.salud + datos.totales.pension)} detalle="Salud 4 % + pensión 4 %" />
            <Indicador etiqueta="Neto a pagar" valor={fmtCOP(datos.totales.neto)} tono="ok" />
          </div>
          <div className="mt-4">
            {!f.length ? <Vacio>No hay personal con asistencia en este periodo.</Vacio> : (
              <Tarjeta>
                <Tabla cabeceras={["Trabajador", "Días", "Básico", "Descansos", "Ajuste mín.", "Devengado", "Aux.", "Deduc.", "Neto", ""]}>
                  {f.map((x) => (
                    <Fragment key={x.trabajador_id}>
                      <tr>
                        <td className="px-3 py-2"><div className="font-medium">{x.nombre}</div><div className="text-xs text-slate-500">{x.cargo}</div></td>
                        <td className="px-3 py-2">{x.dias.dias_asistidos}{x.dias_descanso ? ` + ${x.dias_descanso}` : ""}</td>
                        <td className="px-3 py-2">{fmtCOP(x.basico)}</td><td className="px-3 py-2">{fmtCOP(x.descansos)}</td>
                        <td className="px-3 py-2">{x.ajuste_minimo > 0 ? <Insignia tono="ambar">{fmtCOP(x.ajuste_minimo)}</Insignia> : "—"}</td>
                        <td className="px-3 py-2">{fmtCOP(x.devengado)}</td><td className="px-3 py-2">{fmtCOP(x.auxilio)}</td><td className="px-3 py-2">{fmtCOP(x.salud + x.pension)}</td>
                        <td className="px-3 py-2 font-semibold">{fmtCOP(x.neto)}</td>
                        <td className="px-3 py-2 text-right">{destajo && <Boton variante="fantasma" onClick={() => setAbierto(abierto === x.trabajador_id ? null : x.trabajador_id)}>Detalle</Boton>}</td>
                      </tr>
                      {abierto === x.trabajador_id && (
                        <tr><td colSpan={10} className="bg-slate-50 px-3 py-2 text-sm">
                          {x.detalle.length ? x.detalle.map((d, i) => (
                            <div key={i} className="flex flex-wrap gap-x-3 py-0.5"><span className="w-24">{fechaCorta(d.fecha)}</span><span className="flex-1">{d.actividad}{d.ubicacion ? ` · ${d.ubicacion}` : ""}</span>
                              <span>{fmtNum(d.parte)} {d.um}{d.medido ? "" : " (repartido)"} × {fmtCOP(d.tarifa)}</span><b>{fmtCOP(d.valor)}</b></div>
                          )) : "Sin avance registrado."}
                        </td></tr>
                      )}
                    </Fragment>
                  ))}
                </Tabla>
              </Tarjeta>
            )}
          </div>
          {datos.costos.length > 0 && (
            <div className="mt-6">
              <Tarjeta titulo="Costo de mano de obra por actividad">
                <Tabla cabeceras={["Actividad", "Cantidad", "Ingreso contrato", "Costo MO", "Margen", "Costo unitario"]}>
                  {datos.costos.map((c) => (
                    <tr key={c.actividad_id}><td className="px-3 py-2">{c.nombre}{c.ubicacion ? ` · ${c.ubicacion}` : ""}</td><td className="px-3 py-2">{fmtNum(c.cantidad)} {c.um}</td>
                      <td className="px-3 py-2">{fmtCOP(c.ingreso)}</td><td className="px-3 py-2">{fmtCOP(c.costo)}</td>
                      <td className={`px-3 py-2 ${c.margen < 0 ? "text-red-700" : ""}`}>{fmtCOP(c.margen)}</td>
                      <td className="px-3 py-2">{fmtCOP(c.costo_unitario)} <span className="text-xs text-slate-500">vs {fmtCOP(c.valor_unitario)}</span></td></tr>
                  ))}
                </Tabla>
              </Tarjeta>
            </div>
          )}
        </>
      )}
      {obraId && tarifas.length > 0 && (
        <div className="mt-6">
          <Tarjeta titulo="Tarifas de destajo por actividad" acciones={<span className="text-xs text-slate-500">Lo que se paga a la cuadrilla por unidad</span>}>
            <Tabla cabeceras={["Actividad", "Unidad", "Valor contrato", "Tarifa destajo"]}>
              {tarifas.map((t) => (
                <tr key={t.id}><td className="px-3 py-2">{t.nombre}{t.ubicacion ? ` · ${t.ubicacion}` : ""}</td><td className="px-3 py-2">{t.um}</td><td className="px-3 py-2">{fmtCOP(t.valor_unitario)}</td>
                  <td className="px-3 py-2">{puede ? <Input key={t.id + t.tarifa} type="number" min={0} defaultValue={t.tarifa ?? ""} className="w-32" onBlur={(e) => { if (e.target.value !== String(t.tarifa ?? "")) void fijar(t.id, e.target.value); }} /> : t.tarifa ? fmtCOP(t.tarifa) : "—"}</td></tr>
              ))}
            </Tabla>
          </Tarjeta>
        </div>
      )}
    </>
  );
}
