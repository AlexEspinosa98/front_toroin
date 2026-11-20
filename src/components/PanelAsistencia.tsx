"use client";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Users } from "lucide-react";
import { api } from "@/lib/client";
import { diaSemana, hoy, rango, sumarDias } from "@/lib/fechas";
import { fechaCorta } from "@/lib/format";
import type { ObraBasica } from "@/lib/obras";
import { ANIMAR, COLOR_GRAFICA, Esqueleto, Segmentado, Select, Tarjeta, Vacio } from "./ui";
import { MarcoGrafica, TooltipGrafica } from "./graficas";

type Periodo = "7" | "14" | "30";

/** Personas presentes por día, por obra o en todas, con periodo seleccionable. */
export function PanelAsistencia() {
  const [obras, setObras] = useState<ObraBasica[] | null>(null);
  const [obraId, setObraId] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("14");
  const [datos, setDatos] = useState<{ clave: string; serie: Record<string, number> } | null>(null);
  const h = hoy();
  const desde = sumarDias(h, -(Number(periodo) - 1));
  const clave = `${obraId}|${periodo}`;

  useEffect(() => { api<ObraBasica[]>("obras").then((o) => setObras(o.filter((x) => x.estado !== "terminada"))).catch(() => setObras([])); }, []);
  useEffect(() => {
    if (!obras?.length) return;
    let vivo = true;
    const ids = obraId ? [obraId] : obras.map((o) => o.id);
    Promise.all(ids.map((id) => api<Record<string, number>>(`obras/${id}/presentes?desde=${desde}&hasta=${h}`).catch(() => ({} as Record<string, number>))))
      .then((rs) => {
        if (!vivo) return;
        const s: Record<string, number> = {};
        for (const r of rs) for (const [f, n] of Object.entries(r)) s[f] = (s[f] ?? 0) + n;
        setDatos({ clave, serie: s });
      });
    return () => { vivo = false; };
  }, [obras, obraId, desde, h, clave]);

  const serie = datos?.clave === clave ? datos.serie : null;
  const puntos = useMemo(() => rango(desde, h).map((f) => ({ f, etiqueta: fechaCorta(f).slice(0, 6), presentes: serie?.[f] ?? 0, domingo: diaSemana(f) === 0 })), [desde, h, serie]);
  const laborables = puntos.filter((p) => !p.domingo && p.presentes > 0);
  const prom = laborables.length ? Math.round(laborables.reduce((s, p) => s + p.presentes, 0) / laborables.length) : 0;
  const max = puntos.reduce((m, p) => Math.max(m, p.presentes), 0);
  const deHoy = serie?.[h];

  return (
    <Tarjeta titulo="Asistencia" sub="Personas presentes por día según el registro del SST"
      acciones={
        <div className="flex flex-wrap gap-2">
          {obras && obras.length > 1 && (
            <Select aria-label="Obra" className="!min-h-10 w-auto max-w-52 py-1.5 text-sm" value={obraId} onChange={(e) => setObraId(e.target.value)}>
              <option value="">Todas las obras</option>
              {obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </Select>
          )}
          <Segmentado etiqueta="Periodo" valor={periodo} onChange={setPeriodo} opciones={[{ valor: "7", texto: "7 d" }, { valor: "14", texto: "14 d" }, { valor: "30", texto: "30 d" }]} />
        </div>
      }>
      {obras && obras.length === 0 ? (
        <Vacio icono={<Users className="size-6" aria-hidden />} titulo="Sin obras activas" texto="Cuando registre asistencia en una obra, verá aquí la evolución." />
      ) : !serie ? <Esqueleto className="h-64" /> : (
        <>
          <dl className="mb-3 grid grid-cols-3 gap-3">
            {[{ t: "Hoy", v: deHoy == null ? "—" : deHoy, d: deHoy == null ? "sin registro" : "presentes" }, { t: "Promedio", v: prom, d: "por día laborable" }, { t: "Máximo", v: max, d: `últimos ${periodo} días` }].map((x) => (
              <div key={x.t} className="rounded-lg bg-fondo px-3 py-2">
                <dt className="text-xs font-medium text-suave">{x.t}</dt>
                <dd className="num text-xl font-extrabold text-tinta">{x.v}</dd>
                <dd className="text-xs text-suave">{x.d}</dd>
              </div>
            ))}
          </dl>
          <MarcoGrafica alto={210} etiqueta={`Presentes por día: promedio ${prom}, máximo ${max}`}>
            <ResponsiveContainer>
              <AreaChart data={puntos} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="relleno-asis" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--grafica-1)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--grafica-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={COLOR_GRAFICA.rejilla} />
                <XAxis dataKey="etiqueta" tick={{ fill: COLOR_GRAFICA.eje, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
                <YAxis allowDecimals={false} tick={{ fill: COLOR_GRAFICA.eje, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ stroke: "var(--grafica-1)", strokeDasharray: "4 4" }} content={<TooltipGrafica titulo={(_, p) => (p?.domingo ? `${p?.etiqueta} · domingo` : String(p?.etiqueta ?? ""))} formato={(v) => `${v} personas`} />} />
                <Area type="monotone" dataKey="presentes" name="Presentes" stroke="var(--grafica-1)" strokeWidth={2.5} fill="url(#relleno-asis)" isAnimationActive={ANIMAR}
                  dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} />
              </AreaChart>
            </ResponsiveContainer>
          </MarcoGrafica>
        </>
      )}
    </Tarjeta>
  );
}
