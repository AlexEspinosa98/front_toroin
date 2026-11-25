"use client";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Banknote, ChevronRight, Download, Info, Scale, TriangleAlert, Wallet } from "lucide-react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { descargarCSV, quincenas } from "@/lib/csv";
import { fechaCorta, fmtCOP, fmtMillones, fmtNum, fmtPct } from "@/lib/format";
import { hoy, nombreMes } from "@/lib/fechas";
import { useObras } from "@/lib/obras";
import { Aviso, Boton, Buscador, Campo, Chip, cx, Esqueleto, Input, Segmentado, Tarjeta, Titulo, Vacio, useAviso } from "@/components/ui";
import { Indicador, SelectorObra } from "@/components/comunes";

type Det = { fecha: string; obra_id: string; actividad: string; ubicacion: string; um: string; cantidad_total: number; integrantes: number; parte: number; medido: boolean; tarifa: number; valor: number; pagado: boolean };
type Sem = { domingo: string; reconocido: boolean };
type Fila = {
  trabajador_id: string; nombre: string; cedula: string; cargo: string; jornal: number; promedio_diario: number;
  modalidad: "jornal" | "destajo" | "mixta"; dias_jornal: number; dias_destajo: number; basico_jornal: number;
  dias: { dias_asistidos: number; domingos: number; festivos: number; semanas?: Sem[] };
  detalle: Det[]; sin_tarifa: number; basico: number; descansos: number; dias_descanso: number; ajuste_minimo: number; devengado: number; auxilio: number; salud: number; pension: number; neto: number;
};
type Costo = { actividad_id: string; nombre: string; ubicacion: string; um: string; cantidad: number; dias_persona: number; ingreso: number; costo: number; margen: number; costo_unitario: number; valor_unitario: number; tarifa: number | null; padre_id: string; padre: string };
type Cfg = { modalidad_pago: "jornal" | "destajo"; regla_dominical: string; jornal_minimo: number; jornal_base: number; factor_prestacional: number; smmlv: number; aux_transporte: number };
type Resp = { config: Cfg; filas: Fila[]; totales: Record<string, number>; costos: Costo[]; sin_tarifa: number };
type Tarifa = { id: string; nombre: string; ubicacion: string; um: string; valor_unitario: number; tarifa: number | null; padre_id: string; padre: string; equivale: number; um_item: string; aporta_avance: boolean; se_paga: boolean };
type Periodo = "q1" | "q2" | "mes";

const nombreAct = (a: { actividad?: string; nombre?: string; ubicacion: string }) => `${a.actividad ?? a.nombre}${a.ubicacion ? ` · ${a.ubicacion}` : ""}`;

export default function Pagos() {
  const { me } = useSession();
  const aviso = useAviso();
  const h = hoy();
  const { obras, obraId, setObraId } = useObras({ todas: true });
  const [mes, setMes] = useState(h.slice(0, 7));
  const [per, setPer] = useState<Periodo>(Number(h.slice(8, 10)) <= 15 ? "q1" : "q2");
  const [vista, setVista] = useState<"personas" | "actividades">("personas");
  const [buscar, setBuscar] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [res, setRes] = useState<{ clave: string; datos: Resp } | null>(null);
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");
  const [anio, m] = mes.split("-").map(Number);
  const [desde, hasta] = quincenas(anio, m)[per];
  const finMes = quincenas(anio, m).mes[1].slice(8);
  const periodoTxt = `${fechaCorta(desde)} – ${fechaCorta(hasta)}`;
  const puede = !me.solo_lectura && me.licencia?.escritura && ["admin", "gerencia", "super_admin"].includes(me.rol);

  const clave = `${desde}|${hasta}|${obraId}|${version}`;
  useEffect(() => {
    let vivo = true;
    api<Resp>(`pagos?desde=${desde}&hasta=${hasta}${obraId ? `&obra_id=${obraId}` : ""}`)
      .then((r) => { if (vivo) { setRes({ clave, datos: r }); setError(""); } })
      .catch((e) => vivo && setError(e.message));
    return () => { vivo = false; };
  }, [desde, hasta, obraId, clave]);
  useEffect(() => {
    let vivo = true;
    if (obraId) api<Tarifa[]>(`tarifas?obra_id=${obraId}`).then((t) => vivo && setTarifas(t)).catch(() => vivo && setTarifas([]));
    return () => { vivo = false; };
  }, [obraId, version]);
  const datos = res?.clave === clave ? res.datos : null;

  async function fijar(id: string, v: string) {
    try { await api(`actividades/${id}/tarifa`, { method: "PATCH", body: { tarifa: v === "" ? null : Number(v) } }); aviso("Tarifa guardada"); setVersion((x) => x + 1); }
    catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); }
  }

  const liqs = useMemo(() => datos?.filas ?? [], [datos]);
  const cfg = datos?.config;
  // Con forma de pago por asignación, basta con que alguien se pague por ejecutado
  const destajo = cfg?.modalidad_pago === "destajo" || liqs.some((f) => f.modalidad !== "jornal");
  const visibles = useMemo(() => liqs.filter((l) => !buscar || l.nombre.toLowerCase().includes(buscar.toLowerCase())), [liqs, buscar]);
  const bajoMinimo = liqs.filter((l) => l.ajuste_minimo > 0);
  const deducciones = liqs.reduce((s, l) => s + l.salud + l.pension, 0);
  const suma = (k: "ajuste_minimo") => liqs.reduce((s, l) => s + l[k], 0);
  const costos = [...(datos?.costos ?? [])].sort((a, b) => a.margen / (a.ingreso || 1) - b.margen / (b.ingreso || 1));
  const totIng = costos.reduce((s, c) => s + c.ingreso, 0);
  const totCosto = costos.reduce((s, c) => s + c.costo, 0);
  const nombreObra = (id: string) => obras.find((o) => o.id === id)?.nombre ?? "";

  const exportar = () => descargarCSV(`prenomina-${desde}_${hasta}.csv`, [
    ["Trabajador", "Cédula", "Cargo", "Modalidad", "Días trabajados", "Domingos/festivos", "Jornal o promedio diario", "Básico", "Descansos remunerados", "Ajuste al mínimo", "Devengado", "Auxilio de transporte", "Salud 4%", "Pensión 4%", "Neto a pagar"],
    ...liqs.map((x) => [x.nombre, x.cedula, x.cargo, destajo ? "Destajo" : "Jornal", x.dias.dias_asistidos, x.dias_descanso, Math.round(destajo ? x.promedio_diario : x.jornal), Math.round(x.basico), Math.round(x.descansos), Math.round(x.ajuste_minimo), Math.round(x.devengado), Math.round(x.auxilio), Math.round(x.salud), Math.round(x.pension), Math.round(x.neto)]),
  ]);

  return (
    <>
      <Titulo sub="Prenómina calculada con la asistencia y lo que cada persona hizo en la bitácora"
        acciones={<Boton variante="secundario" icono={<Download className="size-4" aria-hidden />} onClick={exportar} disabled={!liqs.length}>Exportar prenómina</Boton>}>Pagos al personal</Titulo>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Campo etiqueta="Mes"><Input type="month" value={mes} max={h.slice(0, 7)} onChange={(e) => e.target.value && setMes(e.target.value)} /></Campo>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-semibold text-texto">Periodo</span>
          <Segmentado etiqueta="Periodo de pago" valor={per} onChange={setPer} opciones={[{ valor: "q1", texto: "1–15" }, { valor: "q2", texto: `16–${finMes}` }, { valor: "mes", texto: "Mes completo" }]} />
        </div>
        <SelectorObra obras={obras} valor={obraId} onChange={setObraId} todas />
      </div>

      {error && <div className="mt-3"><Aviso tono="error">{error}</Aviso></div>}
      {!datos && !error && <div className="mt-4 space-y-3"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Esqueleto key={i} className="h-28" />)}</div><Esqueleto className="h-64" /></div>}

      {datos && cfg && (
        <>
          <details className="group mt-3 rounded-lg bg-marca-50 px-3 text-sm text-tinta">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold">
              <Info className="size-4 shrink-0 text-marca-texto" aria-hidden />
              <span className="flex-1">{destajo ? "Pago a destajo" : "Pago por jornal"} · ¿cómo se calcula?</span>
              <ChevronRight className="size-4 shrink-0 text-suave transition-transform group-open:rotate-90" aria-hidden />
            </summary>
            <p className="pb-3 pl-6">
              {destajo
                ? "Lo que ejecutó cada persona (medido por el residente al cierre del día) × tarifa por unidad; si no se midió, se reparte la cantidad de la cuadrilla en partes iguales. Domingos y festivos se pagan con el promedio diario devengado (art. 176 CST) y se garantiza el salario mínimo."
                : `(Días trabajados + domingos y festivos reconocidos) × jornal. Regla del domingo: ${cfg.regla_dominical === "legal" ? "legal (art. 173 CST)" : "más de 5 días"}.`}{" "}
              {puede && <Link href="/ajustes" className="whitespace-nowrap font-semibold text-marca-texto underline">Cambiar reglas en Ajustes</Link>}
            </p>
          </details>
          {destajo && datos.sin_tarifa > 0 && <div className="mt-3"><Aviso tono="alerta">Hay {datos.sin_tarifa} registro(s) de avance en actividades sin tarifa: no suman al pago. {obraId ? "Defínalas en la vista «Costo por actividad»." : "Elija una obra y defina sus tarifas en la vista «Costo por actividad»."}</Aviso></div>}

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador etiqueta="Total devengado" valor={fmtCOP(liqs.reduce((s, l) => s + l.devengado, 0))} detalle={`${liqs.length} personas · ${periodoTxt}`} icono={<Banknote className="size-5" aria-hidden />} />
            <Indicador etiqueta="Auxilio de transporte" valor={fmtCOP(datos.totales.auxilio)} detalle={`${fmtCOP(cfg.aux_transporte)}/mes, proporcional a los días`} icono={<Wallet className="size-5" aria-hidden />} />
            <Indicador etiqueta="Neto a pagar" valor={fmtCOP(datos.totales.neto)} detalle={`Descuentos salud y pensión: ${fmtCOP(deducciones)}`} tono="acento" icono={<Banknote className="size-5" aria-hidden />} />
            <Indicador etiqueta={destajo ? "Bajo el mínimo" : "Jornal base"} icono={<Scale className="size-5" aria-hidden />}
              valor={destajo ? bajoMinimo.length : fmtCOP(cfg.jornal_base)}
              detalle={destajo ? `Ajuste para completar el mínimo: ${fmtCOP(suma("ajuste_minimo"))}` : `SMMLV: ${fmtCOP(cfg.smmlv)}`}
              tono={destajo && bajoMinimo.length ? "alerta" : undefined} />
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <Segmentado etiqueta="Vista" valor={vista}
              onChange={(v) => { setVista(v); if (v === "actividades" && !obraId && obras[0]) setObraId(obras[0].id); }}
              opciones={[{ valor: "personas", texto: "Pago por trabajador" }, { valor: "actividades", texto: "Costo por actividad" }]} />
            {vista === "personas" && <Buscador className="w-full sm:w-64" etiqueta="Buscar trabajador" valor={buscar} onChange={setBuscar} />}
          </div>

          {vista === "personas" ? (
            <Tarjeta className="animar-fundido mt-4" titulo={`Liquidación ${periodoTxt}`} sub="Toque una persona para ver día a día qué hizo y cuánto se le paga">
              {liqs.length === 0 ? (
                <Vacio icono={<Banknote className="size-6" aria-hidden />} titulo="No hay asistencia en este periodo" texto="La prenómina se calcula con la asistencia que registra el SST." />
              ) : (
                <div className="-mx-4 overflow-x-auto sm:mx-0">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-suave">
                        <th scope="col" className="min-w-44 px-4 py-2 font-semibold sm:px-2">Trabajador</th>
                        <th scope="col" className="px-2 py-2 text-right font-semibold">Días</th>
                        <th scope="col" className="px-2 py-2 text-right font-semibold">Dom./fest.</th>
                        <th scope="col" className="px-2 py-2 text-right font-semibold">{destajo ? "Destajo" : "Jornales"}</th>
                        <th scope="col" className="px-2 py-2 text-right font-semibold">Descansos</th>
                        {destajo && <th scope="col" className="px-2 py-2 text-right font-semibold">Ajuste mínimo</th>}
                        <th scope="col" className="px-2 py-2 text-right font-semibold">Auxilio</th>
                        <th scope="col" className="px-2 py-2 text-right font-semibold">Descuentos</th>
                        <th scope="col" className="px-2 py-2 text-right font-semibold">Neto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borde">
                      {visibles.map((l) => {
                        const abierta = abierto === l.trabajador_id;
                        const diasConActividad = new Set(l.detalle.map((d) => d.fecha)).size;
                        return (
                          <Fragment key={l.trabajador_id}>
                            <tr className="hover:bg-marca-50/60">
                              <td className="px-4 py-2.5 sm:px-2">
                                <button type="button" className="-ml-1 flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-left font-semibold text-tinta hover:text-marca-texto" aria-expanded={abierta} onClick={() => setAbierto(abierta ? null : l.trabajador_id)}>
                                  <ChevronRight className={cx("size-4 shrink-0 text-suave transition-transform duration-150", abierta && "rotate-90")} aria-hidden />
                                  {l.nombre}
                                </button>
                                <span className="block pl-6 text-xs text-suave">
                                  {l.modalidad === "jornal" ? `Por jornal · ${fmtCOP(l.basico_jornal && l.dias_jornal ? l.basico_jornal / l.dias_jornal : l.jornal)}/día`
                                    : l.modalidad === "mixta" ? `Mixto · ${l.dias_jornal} días por jornal y ${l.dias_destajo} por ejecutado`
                                    : `Por ejecutado · promedio ${fmtCOP(l.promedio_diario)}/día`}
                                  {l.ajuste_minimo > 0 && <span className="font-semibold text-alerta"> · bajo el mínimo</span>}
                                </span>
                              </td>
                              <td className="num px-2 text-right">{l.dias.dias_asistidos}</td>
                              <td className="num px-2 text-right">{l.dias_descanso}</td>
                              <td className="num px-2 text-right">{fmtCOP(l.basico)}</td>
                              <td className="num px-2 text-right">{fmtCOP(l.descansos)}</td>
                              {destajo && <td className={cx("num px-2 text-right", l.ajuste_minimo > 0 && "font-semibold text-alerta")}>{l.ajuste_minimo ? fmtCOP(l.ajuste_minimo) : "—"}</td>}
                              <td className="num px-2 text-right">{fmtCOP(l.auxilio)}</td>
                              <td className="num px-2 text-right text-error">−{fmtCOP(l.salud + l.pension)}</td>
                              <td className="num px-2 text-right text-base font-extrabold text-tinta">{fmtCOP(l.neto)}</td>
                            </tr>
                            {abierta && (
                              <tr>
                                <td colSpan={destajo ? 9 : 8} className="bg-fondo px-4 py-3 sm:px-2">
                                  <div className="animar-entrada grid gap-4 lg:grid-cols-[2fr_1fr]">
                                    <div>
                                      <p className="mb-2 text-sm font-bold text-tinta">Lo que hizo día a día (bitácora)</p>
                                      {l.detalle.length === 0 ? (
                                        <p className="text-sm text-suave">No aparece asignado a actividades en la bitácora de este periodo.</p>
                                      ) : (
                                        <div className="overflow-x-auto rounded-lg border border-borde bg-white">
                                          <table className="w-full text-sm">
                                            <thead>
                                              <tr className="text-left text-xs uppercase tracking-wide text-suave">
                                                <th scope="col" className="px-3 py-2 font-semibold">Fecha</th>
                                                <th scope="col" className="px-3 py-2 font-semibold">Actividad</th>
                                                <th scope="col" className="px-3 py-2 text-right font-semibold">Su parte</th>
                                                {destajo && <th scope="col" className="px-3 py-2 text-right font-semibold">Valor</th>}
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-borde">
                                              {l.detalle.map((d, i) => (
                                                <tr key={i}>
                                                  <td className="whitespace-nowrap px-3 py-1.5">{fechaCorta(d.fecha).slice(0, 6)}</td>
                                                  <td className="px-3 py-1.5">
                                                    {nombreAct(d)}
                                                    <span className="block text-xs text-suave">{nombreObra(d.obra_id)} · cuadrilla de {d.integrantes} · total {fmtNum(d.cantidad_total)} {d.um} · {d.medido ? "medido por el residente" : "repartido en partes iguales"}</span>
                                                  </td>
                                                  <td className="num whitespace-nowrap px-3 py-1.5 text-right">{fmtNum(d.parte)} {d.um}</td>
                                                  {destajo && <td className="num whitespace-nowrap px-3 py-1.5 text-right">{!d.pagado ? <Chip tono="neutro">Pago por jornal</Chip> : d.tarifa ? fmtCOP(d.valor) : <Chip tono="alerta">Sin tarifa</Chip>}</td>}
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                      {l.dias.dias_asistidos > diasConActividad && (
                                        <p className="mt-2 text-xs text-alerta">Asistió {l.dias.dias_asistidos} días pero solo aparece en actividades {diasConActividad}. {destajo ? "A destajo, los días sin actividad no generan pago (lo cubre la garantía del mínimo)." : "Por jornal se paga igual."}</p>
                                      )}
                                    </div>
                                    <dl className="space-y-1.5 rounded-lg border border-borde bg-white p-3 text-sm">
                                      {([
                                        ...(l.modalidad === "mixta"
                                          ? [[`Jornales (${l.dias_jornal} días)`, l.basico_jornal] as [string, number],
                                             [`Ejecutado (${l.dias_destajo} días)`, l.basico - l.basico_jornal] as [string, number]]
                                          : [[`${l.modalidad === "destajo" ? "Ejecutado" : "Jornales"} (${l.dias.dias_asistidos} días)`, l.basico] as [string, number]]),
                                        [`Domingos y festivos (${l.dias_descanso})`, l.descansos],
                                        ...(l.ajuste_minimo ? [["Ajuste al salario mínimo", l.ajuste_minimo] as [string, number]] : []),
                                        ["Devengado", l.devengado],
                                        ["Auxilio de transporte", l.auxilio],
                                        ["Salud (4 %)", -l.salud],
                                        ["Pensión (4 %)", -l.pension],
                                      ] as [string, number][]).map(([k, v]) => (
                                        <div key={k} className={cx("flex justify-between gap-2", k === "Devengado" && "border-t border-borde pt-1.5 font-semibold")}>
                                          <dt className="text-suave">{k}</dt>
                                          <dd className={cx("num", v < 0 && "text-error")}>{fmtCOP(v)}</dd>
                                        </div>
                                      ))}
                                      <div className="flex justify-between gap-2 border-t border-borde pt-1.5 text-base font-extrabold text-tinta"><dt>Neto a pagar</dt><dd className="num">{fmtCOP(l.neto)}</dd></div>
                                      {(l.dias.semanas?.length ?? 0) > 0 && <p className="pt-1 text-xs text-suave">Domingos: {l.dias.semanas!.map((s) => `${fechaCorta(s.domingo).slice(0, 6)} ${s.reconocido ? "reconocido" : "no reconocido"}`).join(" · ")}</p>}
                                    </dl>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-3 text-xs text-suave">Prenómina de referencia: no incluye horas extra, recargos por trabajo en domingo, prestaciones sociales ni aportes del empleador. Valide con su contador o software de nómina.</p>
            </Tarjeta>
          ) : !obraId ? (
            <div className="mt-4"><Vacio icono={<Wallet className="size-6" aria-hidden />} titulo="Elija una obra" texto="El costo por actividad se calcula obra por obra." /></div>
          ) : (
            <>
              <Tarjeta className="animar-fundido mt-4" titulo={`Costo real de mano de obra · ${nombreObra(obraId)}`} sub={`${periodoTxt} · lo que paga el contrato vs. lo que cuesta pagarle al personal que hizo cada actividad`}>
                <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Indicador etiqueta="Ingreso (obra ejecutada)" valor={fmtMillones(totIng)} />
                  <Indicador etiqueta="Costo mano de obra" valor={fmtMillones(totCosto)} detalle={cfg.factor_prestacional !== 1 ? `Incluye factor ${fmtNum(cfg.factor_prestacional)}` : "Sin prestaciones"} />
                  <Indicador etiqueta="Margen" valor={fmtMillones(totIng - totCosto)} tono={totIng - totCosto < 0 ? "error" : "ok"} detalle={totIng ? fmtPct((totIng - totCosto) / totIng, 1) : undefined} />
                  <Indicador etiqueta="Factor prestacional" valor={fmtNum(cfg.factor_prestacional)} detalle={<>1 = solo lo pagado; ~1,5 incluye prestaciones. {puede && <Link href="/ajustes" className="font-semibold text-marca-texto underline">Cambiar</Link>}</>} />
                </div>
                {costos.length === 0 ? (
                  <Vacio icono={<Wallet className="size-6" aria-hidden />} titulo="Sin avance registrado en este periodo" texto="Cuando el residente registre avance en la bitácora, aquí aparece el costo por actividad." />
                ) : (
                  <div className="-mx-4 overflow-x-auto sm:mx-0">
                    <table className="w-full min-w-[860px] text-sm">
                      <thead>
                        <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-suave">
                          <th scope="col" className="px-4 py-2 font-semibold sm:px-2">Actividad</th>
                          <th scope="col" className="px-2 py-2 text-right font-semibold">Ejecutado</th>
                          <th scope="col" className="px-2 py-2 text-right font-semibold">Días-persona</th>
                          <th scope="col" className="px-2 py-2 text-right font-semibold">Precio contrato</th>
                          <th scope="col" className="px-2 py-2 text-right font-semibold">{destajo ? "Tarifa destajo" : "Costo por unidad"}</th>
                          <th scope="col" className="px-2 py-2 text-right font-semibold">Ingreso</th>
                          <th scope="col" className="px-2 py-2 text-right font-semibold">Costo</th>
                          <th scope="col" className="px-2 py-2 text-right font-semibold">Margen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-borde">
                        {costos.map((c) => {
                          const pct = c.ingreso ? c.margen / c.ingreso : 0;
                          return (
                            <tr key={c.actividad_id} className="hover:bg-marca-50/60">
                              <td className="px-4 py-2 font-semibold sm:px-2">{nombreAct(c)}</td>
                              <td className="num px-2 text-right">{fmtNum(c.cantidad)} {c.um}</td>
                              <td className="num px-2 text-right">{c.dias_persona}</td>
                              <td className="num px-2 text-right text-suave">{fmtCOP(c.valor_unitario)}</td>
                              <td className={cx("num px-2 text-right", !destajo && c.costo_unitario > c.valor_unitario && "font-semibold text-error")}>
                                {destajo ? (c.tarifa ? fmtCOP(c.tarifa) : <Chip tono="alerta">Sin tarifa</Chip>) : fmtCOP(c.costo_unitario)}
                              </td>
                              <td className="num px-2 text-right">{fmtCOP(c.ingreso)}</td>
                              <td className="num px-2 text-right">{fmtCOP(c.costo)}</td>
                              <td className={cx("num px-2 text-right font-semibold", pct < 0 ? "text-error" : pct < 0.1 ? "text-alerta" : "text-ok")}>
                                {fmtPct(pct)}<span className="block text-xs font-normal text-suave">{fmtCOP(c.margen)}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="mt-3 text-xs text-suave">
                  Ordenado de menor a mayor margen: arriba están las actividades donde se gana menos o se pierde ({nombreMes(m)} {anio}). {destajo ? "Costo = cantidad × tarifa de destajo." : "Costo = jornal de cada persona por los días que trabajó en la actividad."} Domingos, festivos, auxilio y prestaciones se reflejan con el factor prestacional.
                </p>
              </Tarjeta>

              {destajo && tarifas.length > 0 && (
                <Tarjeta className="mt-5" titulo="Tarifas de destajo por actividad" sub="Lo que se paga a la cuadrilla por unidad, en las unidades de la empresa. Se guarda al salir del campo.">
                  {tarifas.some((t) => t.se_paga && !t.tarifa) && (
                    <p className="mb-3 flex items-start gap-2 rounded-lg bg-alerta-50 px-3 py-2 text-sm text-alerta"><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> Las actividades sin tarifa no suman al pago a destajo.</p>
                  )}
                  <div className="-mx-4 overflow-x-auto sm:mx-0">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-suave">
                          <th scope="col" className="px-4 py-2 font-semibold sm:px-2">Actividad</th>
                          <th scope="col" className="px-2 py-2 font-semibold">Unidad</th>
                          <th scope="col" className="px-2 py-2 font-semibold">Equivale a</th>
                          <th scope="col" className="px-2 py-2 text-right font-semibold">Valor contrato</th>
                          <th scope="col" className="px-2 py-2 text-right font-semibold">Tarifa destajo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-borde">
                        {tarifas.map((t) => (
                          <tr key={t.id} className={t.padre_id ? "bg-fondo/60" : undefined}>
                            <td className={`py-2 font-semibold ${t.padre_id ? "pl-6 pr-2" : "px-4 sm:px-2"}`}>{nombreAct(t)}
                              {!t.se_paga && <span className="block text-xs font-normal text-suave">Se paga en sus subítems</span>}
                              {t.padre_id && !t.aporta_avance && <span className="block text-xs font-normal text-suave">Solo costo</span>}
                            </td>
                            <td className="px-2 py-2 text-suave">{t.um}</td>
                            <td className="num px-2 py-2 text-suave">{t.padre_id && t.aporta_avance ? `${fmtNum(t.equivale)} ${t.um_item}` : "—"}</td>
                            <td className="num px-2 py-2 text-right text-suave">{fmtCOP(t.valor_unitario)}</td>
                            <td className="px-2 py-2 text-right">
                              {!t.se_paga ? <span className="text-suave">—</span> : puede ? (
                                <Input key={`${t.id}-${t.tarifa}`} aria-label={`Tarifa de destajo de ${t.nombre}`} type="number" inputMode="decimal" min={0} defaultValue={t.tarifa ?? ""} className="num ml-auto min-h-11 w-32 py-1 text-right text-sm pointer-fine:min-h-9"
                                  onBlur={(e) => { if (e.target.value !== String(t.tarifa ?? "")) void fijar(t.id, e.target.value); }} />
                              ) : <span className="num">{t.tarifa ? fmtCOP(t.tarifa) : "—"}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Tarjeta>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
