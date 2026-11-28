"use client";
import Link from "next/link";
import { Fragment, use, useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowLeft, Clock, FilePlus2, FileText, FileUp, ImageIcon, Layers, TrendingUp, Users, Wallet } from "lucide-react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { fechaCorta, fmtCOP, fmtMillones, fmtNum, fmtPct } from "@/lib/format";
import { diasEntre, hoy, rango, sumarDias } from "@/lib/fechas";
import type { DatosObra, RegistroT } from "@/lib/types";
import { ANIMAR, Aviso, Boton, COLOR_GRAFICA, Chip, Esqueleto, Segmentado, Tarjeta, Titulo } from "@/components/ui";
import { BarraAvance, ChipSemaforo, Indicador, Miniatura, SinContrato, nombreActividad } from "@/components/comunes";
import { Subitems } from "@/components/Subitems";
import { soloItems, subitemsDe, valorUnitario } from "@/lib/actividades";

export default function ObraTablero({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me, tieneModulo } = useSession();
  const [d, setD] = useState<DatosObra | null>(null);
  const [regs, setRegs] = useState<RegistroT[]>([]);
  const [presentes, setPresentes] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [orden, setOrden] = useState<"contrato" | "avance">("contrato");
  const [verSub, setVerSub] = useState<string | null>(null);
  const h = hoy();

  const cargar = useCallback(() => { api<DatosObra>(`obras/${id}/contrato`).then(setD).catch((e) => setError(e.message)); }, [id]);
  useEffect(() => {
    cargar();
    if (tieneModulo("bitacora")) api<RegistroT[]>(`bitacora?obra_id=${id}`).then(setRegs).catch(() => {});
    api<Record<string, number>>(`obras/${id}/presentes?desde=${sumarDias(h, -20)}&hasta=${h}`).then(setPresentes).catch(() => {});
  }, [id, h, tieneModulo, cargar]);

  const c = d?.contrato;
  const datos = useMemo(() => {
    if (!d || !c) return null;
    const vu = new Map(d.actividades.map((a) => [a.id, valorUnitario(a, d.actividades)]));
    const total = d.resumen.valor_contrato || 1;
    const plazo = Math.max(1, diasEntre(c.fecha_inicio, c.fecha_fin));
    const fin = h < c.fecha_fin ? h : c.fecha_fin;
    const porFecha = new Map<string, number>();
    for (const r of regs) porFecha.set(r.fecha, (porFecha.get(r.fecha) ?? 0) + r.cantidad * (vu.get(r.actividad_id) ?? 0));
    let acum = 0;
    const curva: { fecha: string; Ejecutado: number | null; Esperado: number }[] = [];
    for (const f of rango(c.fecha_inicio, c.fecha_fin)) {
      if (f <= fin) acum += porFecha.get(f) ?? 0;
      if (diasEntre(c.fecha_inicio, f) % 7 === 0 || f === c.fecha_fin || f === fin)
        curva.push({ fecha: fechaCorta(f).slice(0, 6), Ejecutado: f <= fin ? +((acum / total) * 100).toFixed(1) : null, Esperado: +((diasEntre(c.fecha_inicio, f) / plazo) * 100).toFixed(1) });
    }
    const motivos = [...new Set(regs.map((r) => r.motivo_atraso).filter(Boolean))] as string[];
    const atrasos = motivos.map((m) => { const rs = regs.filter((r) => r.motivo_atraso === m); return { motivo: m, Horas: rs.reduce((s, r) => s + r.horas_atraso, 0), HH: rs.reduce((s, r) => s + r.horas_atraso * r.personas, 0) }; })
      .filter((x) => x.Horas > 0).sort((a, b) => b.Horas - a.Horas);
    const asis = rango(sumarDias(h, -20), h).map((f) => ({ fecha: fechaCorta(f).slice(0, 6), Presentes: presentes[f] ?? 0 })).filter((x) => x.Presentes > 0);
    const fotos = regs.flatMap((r) => r.fotos).slice(0, 8);
    return { curva, atrasos, asis, fotos, horas: atrasos.reduce((s, x) => s + x.Horas, 0), hh: atrasos.reduce((s, x) => s + x.HH, 0), ultimos: regs.slice(0, 6) };
  }, [d, c, regs, presentes, h]);

  if (error) return <Aviso tono="error">{error}</Aviso>;
  if (!d) return <div aria-busy="true" aria-label="Cargando" className="space-y-4"><Esqueleto className="h-8 w-64" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Esqueleto key={i} className="h-28" />)}</div><Esqueleto className="h-72" /></div>;
  const puedeContrato = !me.solo_lectura && me.licencia?.escritura && ["admin", "gerencia", "super_admin"].includes(me.rol) && tieneModulo("contrato");
  const volver = <Link href="/contrato" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-marca-texto hover:underline"><ArrowLeft className="size-4" aria-hidden /> Contratos</Link>;
  if (!c || !datos) return <>{volver}<Titulo sub={d.obra.ciudad}>{d.obra.nombre}</Titulo>{puedeContrato ? <SinContrato obraId={id} /> : <Aviso>Esta obra aún no tiene contrato cargado.</Aviso>}</>;

  const ro = d.resumen;
  const items = soloItems(d.actividades);
  const acts = items.map((a) => ({ a, pct: Math.min(1, a.ejecutado / a.cantidad) }));
  if (orden === "avance") acts.sort((x, y) => x.pct - y.pct);
  const nombreAct = (aid: string) => { const a = d.actividades.find((x) => x.id === aid); return a ? nombreActividad(a) : "—"; };

  return (
    <>
      {volver}
      <Titulo sub={<span className="flex flex-wrap items-center gap-2">Contrato {c.numero} · {c.contratante} · {fechaCorta(c.fecha_inicio)} – {fechaCorta(c.fecha_fin)} <ChipSemaforo s={ro.semaforo} /></span>}
        acciones={<>{tieneModulo("finanzas") && <Link href="/finanzas"><Boton variante="secundario" icono={<Wallet className="size-4" aria-hidden />}>Finanzas</Boton></Link>}{tieneModulo("contrato") && <Link href={`/obras/${id}/otrosies`}><Boton variante="secundario" icono={<FilePlus2 className="size-4" aria-hidden />}>Otrosíes</Boton></Link>}{puedeContrato && <Link href={`/obras/${id}/contrato`}><Boton variante="secundario" icono={<FileUp className="size-4" aria-hidden />}>Contrato</Boton></Link>}</>}>{d.obra.nombre}</Titulo>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador etiqueta="Avance físico" valor={fmtPct(ro.avance_fisico, 1)} detalle={`Esperado: ${fmtPct(ro.avance_tiempo, 1)}`} tono={ro.semaforo === "atrasada" ? "error" : ro.semaforo === "atencion" ? "alerta" : "ok"} icono={<TrendingUp className="size-5" aria-hidden />} />
        <Indicador etiqueta="Obra ejecutada" valor={fmtMillones(ro.valor_ejecutado)} detalle={`de ${fmtMillones(ro.valor_contrato)}`} icono={<FileText className="size-5" aria-hidden />} />
        <Indicador etiqueta="Días restantes" valor={Math.max(0, ro.dias_restantes)} detalle={ro.dias_restantes < 0 ? `Plazo vencido hace ${-ro.dias_restantes} días` : `Termina ${fechaCorta(c.fecha_fin)}`} tono={ro.dias_restantes < 15 ? "alerta" : undefined} icono={<Clock className="size-5" aria-hidden />} />
        <Indicador etiqueta="Horas de atraso" valor={fmtNum(datos.horas, 0)} detalle={`${fmtNum(datos.hh, 0)} horas-hombre perdidas`} tono="alerta" icono={<Users className="size-5" aria-hidden />} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Tarjeta titulo="Avance acumulado" sub="% del valor del contrato: ejecutado vs. esperado (lineal)">
          <div className="h-64"><ResponsiveContainer width="100%" height="100%">
            <AreaChart data={datos.curva} margin={{ left: -16, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} stroke={COLOR_GRAFICA.rejilla} />
              <XAxis dataKey="fecha" tick={{ fontSize: 12, fill: COLOR_GRAFICA.eje }} tickLine={false} axisLine={false} /><YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 12, fill: COLOR_GRAFICA.eje }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v) => `${v} %`} />
              <Area isAnimationActive={ANIMAR} type="monotone" dataKey="Ejecutado" stroke={COLOR_GRAFICA.uno} strokeWidth={2.5} fill={COLOR_GRAFICA.uno} fillOpacity={0.12} connectNulls={false} />
              <Line isAnimationActive={ANIMAR} type="linear" dataKey="Esperado" stroke={COLOR_GRAFICA.eje} strokeDasharray="6 4" dot={false} strokeWidth={1.5} />
            </AreaChart></ResponsiveContainer></div>
          <p className="mt-2 flex gap-4 text-sm text-suave"><span className="flex items-center gap-1.5"><span className="h-1 w-5 rounded" style={{ background: COLOR_GRAFICA.uno }} aria-hidden /> Ejecutado</span><span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-suave" aria-hidden /> Esperado</span></p>
        </Tarjeta>
        <Tarjeta titulo="Causas de atraso" sub="Horas de atraso reportadas por el residente, de mayor a menor">
          {datos.atrasos.length === 0 ? <p className="text-sm text-suave">Sin atrasos reportados.</p> : (
            <div className="h-64"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos.atrasos} layout="vertical" margin={{ left: 8, right: 40 }}>
                <XAxis type="number" hide /><YAxis type="category" dataKey="motivo" width={92} tick={{ fontSize: 13, fill: "var(--texto)" }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [`${v} h`, "Horas de atraso"]} cursor={{ fill: "var(--marca-50)" }} />
                <Bar isAnimationActive={ANIMAR} dataKey="Horas" fill={COLOR_GRAFICA.uno} radius={[0, 4, 4, 0]} barSize={22}><LabelList dataKey="Horas" position="right" formatter={(v) => `${v} h`} style={{ fontSize: 12, fill: "var(--texto)", fontWeight: 600 }} /></Bar>
              </BarChart></ResponsiveContainer></div>)}
        </Tarjeta>
      </div>

      <Tarjeta className="mt-5" titulo="Avance por actividad" sub={`${items.length} ítems del contrato${d.actividades.length > items.length ? ` · ${d.actividades.length - items.length} subítems` : ""}`}
        acciones={<Segmentado etiqueta="Ordenar actividades" valor={orden} onChange={setOrden} opciones={[{ valor: "contrato", texto: "Contrato" }, { valor: "avance", texto: "Menor avance" }]} />}>
        <div className="-mx-4 overflow-x-auto sm:mx-0"><table className="w-full min-w-[640px] text-sm">
          <thead><tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-suave"><th className="px-2 py-2 font-semibold">Actividad</th><th className="px-2 py-2 text-right font-semibold">Ejecutado</th><th className="px-2 py-2 text-right font-semibold">Contratado</th><th className="w-48 px-2 py-2 font-semibold">Avance</th><th className="px-2 py-2 text-right font-semibold">Valor ejecutado</th></tr></thead>
          <tbody className="divide-y divide-borde">{acts.map(({ a, pct }) => (
            <Fragment key={a.id}>
              <tr>
                <td className="px-2 py-2.5">
                  <span className="font-semibold">{nombreActividad(a)}</span>
                  <span className="block text-xs text-suave">Ítem {a.item || "—"} · {a.capitulo.toLowerCase()}{a.otrosi && <span className="ml-1.5 font-semibold text-marca-texto">· {a.otrosi}</span>}</span>
                  <button type="button" onClick={() => setVerSub(a.id)} className="mt-1 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-marca-texto hover:underline">
                    <Layers className="size-3.5" aria-hidden /> {a.subitems ? `${a.subitems} subítem${a.subitems === 1 ? "" : "s"}` : tieneModulo("finanzas") ? "Subítems y costos" : "Dividir en subítems"}
                  </button>
                </td>
                <td className="num px-2 text-right">{fmtNum(a.ejecutado)} {a.um}</td><td className="num px-2 text-right text-suave">{fmtNum(a.cantidad)} {a.um}</td>
                <td className="px-2"><div className="flex items-center gap-2"><BarraAvance valor={pct} etiqueta={`Avance ${a.nombre}`} /><span className="num w-12 shrink-0 whitespace-nowrap text-right font-semibold">{fmtPct(pct)}</span></div></td>
                <td className="num px-2 text-right">{fmtCOP(Math.min(a.ejecutado, a.cantidad) * a.valor_unitario)}</td>
              </tr>
              {subitemsDe(d.actividades, a.id).map((s) => (
                <tr key={s.id} className="bg-fondo/60">
                  <td className="py-2 pl-6 pr-2">
                    <span className="text-sm">{s.nombre}</span>
                    {!s.aporta_avance ? <Chip tono="neutro">Solo costo</Chip> : <span className="block text-xs text-suave">1 {s.um} = {fmtNum(s.cantidad ? s.equivale / s.cantidad : 0)} {a.um}</span>}
                  </td>
                  <td className="num px-2 text-right">{fmtNum(s.ejecutado)} {s.um}</td>
                  <td className="num px-2 text-right text-suave">{fmtNum(s.cantidad)} {s.um}</td>
                  <td className="px-2"><div className="flex items-center gap-2"><BarraAvance valor={Math.min(1, s.cantidad ? s.ejecutado / s.cantidad : 0)} etiqueta={`Avance ${s.nombre}`} /><span className="num w-12 shrink-0 whitespace-nowrap text-right font-semibold">{fmtPct(s.cantidad ? s.ejecutado / s.cantidad : 0)}</span></div></td>
                  <td className="num px-2 text-right text-suave">{s.aporta_avance ? `${fmtNum(s.aporte ?? 0)} ${a.um}` : "—"}</td>
                </tr>
              ))}
            </Fragment>))}</tbody></table></div>
      </Tarjeta>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Tarjeta titulo="Asistencia diaria" sub="Personas presentes, últimas 3 semanas">
          {datos.asis.length === 0 ? <p className="text-sm text-suave">Aún no hay asistencia registrada.</p> : (
            <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={datos.asis} margin={{ left: -20, right: 8, top: 16 }}>
              <CartesianGrid vertical={false} stroke={COLOR_GRAFICA.rejilla} /><XAxis dataKey="fecha" tick={{ fontSize: 11, fill: COLOR_GRAFICA.eje }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 12, fill: COLOR_GRAFICA.eje }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "var(--marca-50)" }} /><Bar isAnimationActive={ANIMAR} dataKey="Presentes" fill={COLOR_GRAFICA.dos} radius={[4, 4, 0, 0]}><LabelList dataKey="Presentes" position="top" style={{ fontSize: 11, fill: "var(--texto)" }} /></Bar></BarChart></ResponsiveContainer></div>)}
        </Tarjeta>
        <Tarjeta titulo="Últimos registros de bitácora" acciones={tieneModulo("bitacora") && <Link href="/bitacora" className="inline-flex min-h-11 items-center whitespace-nowrap text-sm font-semibold text-marca-texto hover:underline">Ir a bitácora</Link>}>
          {datos.ultimos.length === 0 ? <p className="text-sm text-suave">Sin registros.</p> : <ul className="divide-y divide-borde">{datos.ultimos.map((r) => (
            <li key={r.id} className="py-2.5 text-sm"><div className="flex justify-between gap-2"><span className="font-semibold">{nombreAct(r.actividad_id)}</span><span className="shrink-0 text-suave">{fechaCorta(r.fecha)}</span></div>
              <p className="text-suave">{fmtNum(r.cantidad)} {d.actividades.find((a) => a.id === r.actividad_id)?.um} · {r.personas} personas{r.horas_atraso > 0 && ` · ${r.horas_atraso} h de atraso (${r.motivo_atraso})`}</p></li>))}</ul>}
        </Tarjeta>
      </div>
      {datos.fotos.length > 0 && <Tarjeta className="mt-5" titulo="Fotos recientes" sub="Con marca de agua de obra, fecha y hora"><div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-8">{datos.fotos.map((f) => <Miniatura key={f} id={f} />)}</div></Tarjeta>}
      {datos.fotos.length === 0 && <p className="mt-5 flex items-center gap-2 text-sm text-suave"><ImageIcon className="size-4" aria-hidden /> Las fotos que suba el residente en la bitácora aparecerán aquí.</p>}

      <Subitems obraId={id} actividadId={verSub} puedeEditar={!!puedeContrato} verCostos={tieneModulo("finanzas")} onCerrar={() => setVerSub(null)} onGuardado={cargar} />
    </>
  );
}
