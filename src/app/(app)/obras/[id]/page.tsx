"use client";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { fechaCorta, fmtCOP, fmtMillones, fmtNum, fmtPct } from "@/lib/format";
import { diasEntre, hoy, rango, sumarDias } from "@/lib/fechas";
import type { DatosObra, RegistroT } from "@/lib/types";
import { Aviso, Boton, Tarjeta, Titulo } from "@/components/ui";
import { BarraAvance, ChipSemaforo, Indicador, Miniatura, SinContrato, nombreActividad } from "@/components/comunes";

export default function ObraTablero({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me, tieneModulo } = useSession();
  const [d, setD] = useState<DatosObra | null>(null);
  const [regs, setRegs] = useState<RegistroT[]>([]);
  const [presentes, setPresentes] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [orden, setOrden] = useState<"contrato" | "avance">("contrato");
  const h = hoy();

  useEffect(() => {
    api<DatosObra>(`obras/${id}/contrato`).then(setD).catch((e) => setError(e.message));
    if (tieneModulo("bitacora")) api<RegistroT[]>(`bitacora?obra_id=${id}`).then(setRegs).catch(() => {});
    api<Record<string, number>>(`obras/${id}/presentes?desde=${sumarDias(h, -20)}&hasta=${h}`).then(setPresentes).catch(() => {});
  }, [id, h, tieneModulo]);

  const c = d?.contrato;
  const datos = useMemo(() => {
    if (!d || !c) return null;
    const vu = new Map(d.actividades.map((a) => [a.id, a.valor_unitario]));
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
  if (!d) return <p className="text-slate-500">Cargando…</p>;
  const puedeContrato = !me.solo_lectura && me.licencia?.escritura && ["admin", "gerencia", "super_admin"].includes(me.rol) && tieneModulo("contrato");
  const volver = <Link href="/contrato" className="mb-3 inline-flex min-h-11 items-center text-sm font-semibold text-marca hover:underline">← Contratos</Link>;
  if (!c || !datos) return <>{volver}<Titulo sub={d.obra.ciudad}>{d.obra.nombre}</Titulo>{puedeContrato ? <SinContrato obraId={id} /> : <Aviso>Esta obra aún no tiene contrato cargado.</Aviso>}</>;

  const ro = d.resumen;
  const acts = [...d.actividades.map((a) => ({ a, pct: Math.min(1, a.ejecutado / a.cantidad) }))];
  if (orden === "avance") acts.sort((x, y) => x.pct - y.pct);
  const nombreAct = (aid: string) => { const a = d.actividades.find((x) => x.id === aid); return a ? nombreActividad(a) : "—"; };

  return (
    <>
      {volver}
      <Titulo sub={<span className="flex flex-wrap items-center gap-2">Contrato {c.numero} · {c.contratante} · {fechaCorta(c.fecha_inicio)} – {fechaCorta(c.fecha_fin)} <ChipSemaforo s={ro.semaforo} /></span>}
        acciones={<>{tieneModulo("finanzas") && <Link href="/finanzas"><Boton variante="secundario">Finanzas</Boton></Link>}{puedeContrato && <Link href={`/obras/${id}/contrato`}><Boton variante="secundario">Contrato</Boton></Link>}</>}>{d.obra.nombre}</Titulo>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador etiqueta="Avance físico" valor={fmtPct(ro.avance_fisico, 1)} detalle={`Esperado: ${fmtPct(ro.avance_tiempo, 1)}`} tono={ro.semaforo === "atrasada" ? "error" : ro.semaforo === "atencion" ? "alerta" : "ok"} />
        <Indicador etiqueta="Obra ejecutada" valor={fmtMillones(ro.valor_ejecutado)} detalle={`de ${fmtMillones(ro.valor_contrato)}`} />
        <Indicador etiqueta="Días restantes" valor={Math.max(0, ro.dias_restantes)} detalle={ro.dias_restantes < 0 ? `Plazo vencido hace ${-ro.dias_restantes} días` : `Termina ${fechaCorta(c.fecha_fin)}`} tono={ro.dias_restantes < 15 ? "alerta" : undefined} />
        <Indicador etiqueta="Horas de atraso" valor={fmtNum(datos.horas, 0)} detalle={`${fmtNum(datos.hh, 0)} horas-hombre perdidas`} tono="alerta" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Tarjeta titulo="Avance acumulado">
          <p className="mb-2 text-xs text-slate-500">% del valor del contrato: ejecutado vs. esperado (lineal)</p>
          <div className="h-64"><ResponsiveContainer width="100%" height="100%">
            <AreaChart data={datos.curva} margin={{ left: -16, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="fecha" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} /><YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v) => `${v} %`} />
              <Area type="monotone" dataKey="Ejecutado" stroke="var(--primario)" strokeWidth={2.5} fill="var(--primario)" fillOpacity={0.12} connectNulls={false} />
              <Line type="linear" dataKey="Esperado" stroke="#64748b" strokeDasharray="6 4" dot={false} strokeWidth={1.5} />
            </AreaChart></ResponsiveContainer></div>
        </Tarjeta>
        <Tarjeta titulo="Causas de atraso">
          {datos.atrasos.length === 0 ? <p className="text-sm text-slate-500">Sin atrasos reportados.</p> : (
            <div className="h-64"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos.atrasos} layout="vertical" margin={{ left: 8, right: 40 }}>
                <XAxis type="number" hide /><YAxis type="category" dataKey="motivo" width={92} tick={{ fontSize: 13 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [`${v} h`, "Horas de atraso"]} />
                <Bar dataKey="Horas" fill="var(--primario)" radius={[0, 4, 4, 0]} barSize={22} label={{ position: "right", fontSize: 12 }} />
              </BarChart></ResponsiveContainer></div>)}
        </Tarjeta>
      </div>

      <Tarjeta className="mt-5" titulo="Avance por actividad" acciones={<div className="flex gap-1">
        <Boton variante={orden === "contrato" ? "primario" : "secundario"} className="!min-h-9" onClick={() => setOrden("contrato")}>Contrato</Boton>
        <Boton variante={orden === "avance" ? "primario" : "secundario"} className="!min-h-9" onClick={() => setOrden("avance")}>Menor avance</Boton></div>}>
        <div className="-mx-4 overflow-x-auto sm:mx-0"><table className="w-full min-w-[640px] text-sm">
          <thead><tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-2 py-2">Actividad</th><th className="px-2 py-2 text-right">Ejecutado</th><th className="px-2 py-2 text-right">Contratado</th><th className="w-48 px-2 py-2">Avance</th><th className="px-2 py-2 text-right">Valor ejecutado</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{acts.map(({ a, pct }) => (
            <tr key={a.id}>
              <td className="px-2 py-2.5"><span className="font-semibold">{nombreActividad(a)}</span><span className="block text-xs text-slate-500">Ítem {a.item || "—"} · {a.capitulo.toLowerCase()}</span></td>
              <td className="px-2 text-right">{fmtNum(a.ejecutado)} {a.um}</td><td className="px-2 text-right text-slate-500">{fmtNum(a.cantidad)} {a.um}</td>
              <td className="px-2"><div className="flex items-center gap-2"><BarraAvance valor={pct} etiqueta={`Avance ${a.nombre}`} /><span className="w-12 shrink-0 text-right font-semibold">{fmtPct(pct)}</span></div></td>
              <td className="px-2 text-right">{fmtCOP(Math.min(a.ejecutado, a.cantidad) * a.valor_unitario)}</td></tr>))}</tbody></table></div>
      </Tarjeta>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Tarjeta titulo="Asistencia diaria">
          <p className="mb-2 text-xs text-slate-500">Personas presentes, últimas 3 semanas</p>
          {datos.asis.length === 0 ? <p className="text-sm text-slate-500">Aún no hay asistencia registrada.</p> : (
            <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={datos.asis} margin={{ left: -20, right: 8, top: 16 }}>
              <CartesianGrid vertical={false} stroke="#e2e8f0" /><XAxis dataKey="fecha" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip /><Bar dataKey="Presentes" fill="var(--secundario)" radius={[4, 4, 0, 0]} label={{ position: "top", fontSize: 11 }} /></BarChart></ResponsiveContainer></div>)}
        </Tarjeta>
        <Tarjeta titulo="Últimos registros de bitácora" acciones={tieneModulo("bitacora") && <Link href="/bitacora" className="text-sm font-semibold text-marca hover:underline">Ir a bitácora</Link>}>
          {datos.ultimos.length === 0 ? <p className="text-sm text-slate-500">Sin registros.</p> : <ul className="divide-y divide-slate-100">{datos.ultimos.map((r) => (
            <li key={r.id} className="py-2.5 text-sm"><div className="flex justify-between gap-2"><span className="font-semibold">{nombreAct(r.actividad_id)}</span><span className="shrink-0 text-slate-500">{fechaCorta(r.fecha)}</span></div>
              <p className="text-slate-500">{fmtNum(r.cantidad)} {d.actividades.find((a) => a.id === r.actividad_id)?.um} · {r.personas} personas{r.horas_atraso > 0 && ` · ${r.horas_atraso} h de atraso (${r.motivo_atraso})`}</p></li>))}</ul>}
        </Tarjeta>
      </div>
      {datos.fotos.length > 0 && <Tarjeta className="mt-5" titulo="Fotos recientes"><div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-8">{datos.fotos.map((f) => <Miniatura key={f} id={f} />)}</div></Tarjeta>}
    </>
  );
}
