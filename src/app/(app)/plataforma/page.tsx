"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Building, Building2, CalendarClock, ChevronRight, CircleCheck, CircleX, Clock, HardHat, Plus, TriangleAlert, Users } from "lucide-react";
import { api } from "@/lib/client";
import { ESTADO_TEXTO, fecha } from "@/lib/format";
import type { EstadoLic, ModuloCatalogo, ResumenEmpresa } from "@/lib/types";
import { ANIMAR, Aviso, Boton, COLOR_GRAFICA, cx, Esqueleto, InsigniaEstado, Segmentado, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { Indicador } from "@/components/comunes";
import { COLOR_ESTADO, Leyenda, MarcoGrafica, TooltipGrafica } from "@/components/graficas";

type D = { empresas: number; por_estado: Record<string, number>; usuarios: number; obras: number; trabajadores: number };

const COLOR_LIC: Record<EstadoLic, string> = {
  activa: COLOR_ESTADO.ok, prueba: COLOR_ESTADO.info, por_vencer: COLOR_ESTADO.alerta, gracia: "#e09a2b",
  vencida: COLOR_ESTADO.error, suspendida: "#8e1d1d", cancelada: COLOR_ESTADO.neutro, sin_licencia: "#c3c8d4",
};
type Ventana = "30" | "60" | "90";

export default function Panel() {
  const router = useRouter();
  const [d, setD] = useState<D | null>(null);
  const [emp, setEmp] = useState<ResumenEmpresa[]>([]);
  const [cat, setCat] = useState<ModuloCatalogo[]>([]);
  const [error, setError] = useState("");
  const [estadoSel, setEstadoSel] = useState<string | null>(null);
  const [ventana, setVentana] = useState<Ventana>("30");

  useEffect(() => {
    api<D>("platform/dashboard").then(setD).catch((e) => setError(e.message));
    api<ResumenEmpresa[]>("platform/empresas").then(setEmp).catch(() => {});
    api<ModuloCatalogo[]>("platform/catalogo").then(setCat).catch(() => {});
  }, []);

  const torta = useMemo(() => (Object.keys(ESTADO_TEXTO) as EstadoLic[]).map((k) => ({ clave: k, nombre: ESTADO_TEXTO[k], valor: d?.por_estado[k] ?? 0, color: COLOR_LIC[k] })).filter((x) => x.valor > 0), [d]);
  const adopcion = useMemo(() => cat.filter((m) => !m.nucleo).map((m) => ({ clave: m.clave, nombre: m.nombre, empresas: emp.filter((e) => e.modulos.includes(m.clave)).length }))
    .sort((a, b) => b.empresas - a.empresas), [cat, emp]);
  const vencen = useMemo(() => emp.filter((e) => e.dias_restantes != null && e.dias_restantes <= Number(ventana) && e.licencia_estado !== "suspendida" && e.licencia_estado !== "cancelada")
    .sort((a, b) => (a.dias_restantes ?? 0) - (b.dias_restantes ?? 0)), [emp, ventana]);

  const nueva = <Link href="/plataforma/empresas/nueva"><Boton icono={<Plus className="size-4" aria-hidden />}>Nueva empresa</Boton></Link>;
  if (error) return <><Titulo>Panel</Titulo><Aviso tono="error">{error}</Aviso></>;
  if (!d) return (
    <>
      <Titulo sub="Resumen de todas las empresas de la plataforma" acciones={nueva}>Panel</Titulo>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Esqueleto key={i} className="h-28" />)}</div>
      <div className="mt-5 grid gap-5 lg:grid-cols-5"><Esqueleto className="h-80 lg:col-span-2" /><Esqueleto className="h-80 lg:col-span-3" /></div>
    </>
  );

  const vencidas = (d.por_estado.vencida ?? 0) + (d.por_estado.gracia ?? 0);
  const suspendidas = d.por_estado.suspendida ?? 0;
  const ic = (I: typeof Building) => <I className="size-5" aria-hidden />;
  const total = torta.reduce((s, x) => s + x.valor, 0) || 1;
  const sel = torta.find((x) => x.clave === estadoSel);

  return (
    <>
      <Titulo sub="Resumen de todas las empresas de la plataforma" acciones={nueva}>Panel</Titulo>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador etiqueta="Empresas" valor={d.empresas} icono={ic(Building)} href="/plataforma/empresas" />
        <Indicador etiqueta="Activas" valor={(d.por_estado.activa ?? 0) + (d.por_estado.por_vencer ?? 0)} icono={ic(CircleCheck)} tono="ok" href="/plataforma/empresas?estado=activa" />
        <Indicador etiqueta="En prueba" valor={d.por_estado.prueba ?? 0} icono={ic(Clock)} href="/plataforma/empresas?estado=prueba" />
        <Indicador etiqueta="Vencidas / en gracia" valor={vencidas} icono={ic(TriangleAlert)} tono={vencidas ? "alerta" : undefined} href="/plataforma/empresas?estado=gracia" />
        <Indicador etiqueta="Suspendidas" valor={suspendidas} icono={ic(CircleX)} tono={suspendidas ? "error" : undefined} href="/plataforma/empresas?estado=suspendida" />
        <Indicador etiqueta="Usuarios" valor={d.usuarios.toLocaleString("es-CO")} icono={ic(Users)} />
        <Indicador etiqueta="Obras" valor={d.obras.toLocaleString("es-CO")} icono={ic(Building2)} />
        <Indicador etiqueta="Trabajadores" valor={d.trabajadores.toLocaleString("es-CO")} icono={ic(HardHat)} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        {/* Torta: estado de las licencias (interactiva) */}
        <Tarjeta className="lg:col-span-2" titulo="Estado de las licencias" sub="Toque un estado para resaltarlo y ver sus empresas">
          {torta.length === 0 ? <Vacio titulo="Sin empresas todavía" /> : (
            <>
              <div className="relative">
                <MarcoGrafica alto={220} etiqueta={`Empresas por estado de licencia: ${torta.map((t) => `${t.nombre} ${t.valor}`).join(", ")}`}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={torta} dataKey="valor" nameKey="nombre" innerRadius="64%" outerRadius="92%" paddingAngle={2} stroke="#fff" strokeWidth={2} isAnimationActive={ANIMAR}
                        onClick={(_: unknown, i: number) => { const k = torta[i]?.clave; if (k) setEstadoSel(estadoSel === k ? null : k); }} className="cursor-pointer outline-none">
                        {torta.map((t) => <Cell key={t.clave} fill={t.color} opacity={estadoSel && estadoSel !== t.clave ? 0.28 : 1} />)}
                      </Pie>
                      <Tooltip content={<TooltipGrafica formato={(v) => `${v} ${v === 1 ? "empresa" : "empresas"}`} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </MarcoGrafica>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center" aria-hidden>
                  <div>
                    <p className="num text-3xl font-extrabold text-tinta">{sel ? sel.valor : d.empresas}</p>
                    <p className="text-xs font-medium text-suave">{sel ? `${sel.nombre} · ${Math.round((sel.valor / total) * 100)} %` : "empresas"}</p>
                  </div>
                </div>
              </div>
              <Leyenda className="mt-3 justify-center" activo={estadoSel} onActivar={setEstadoSel} items={torta.map((t) => ({ clave: t.clave, texto: t.nombre, color: t.color, valor: t.valor }))} />
              {sel && (
                <Link href={`/plataforma/empresas?estado=${sel.clave}`} className="animar-entrada mt-3 flex min-h-11 items-center justify-center gap-1 rounded-lg bg-marca-50 text-sm font-semibold text-marca-texto hover:bg-marca-100">
                  Ver {sel.valor === 1 ? "la empresa" : `las ${sel.valor} empresas`} «{sel.nombre}» <ChevronRight className="size-4" aria-hidden />
                </Link>
              )}
            </>
          )}
        </Tarjeta>

        {/* Barras: adopción de módulos */}
        <Tarjeta className="lg:col-span-3" titulo="Adopción de módulos" sub="Cuántas empresas tienen activo cada módulo. Toque una barra para ver cuáles.">
          {adopcion.length === 0 ? <Esqueleto className="h-64" /> : (
            <MarcoGrafica alto={Math.max(220, adopcion.length * 34)} etiqueta={`Adopción de módulos: ${adopcion.map((a) => `${a.nombre} ${a.empresas}`).join(", ")}`}>
              <ResponsiveContainer>
                <BarChart data={adopcion} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }} barCategoryGap={7}>
                  <CartesianGrid horizontal={false} stroke={COLOR_GRAFICA.rejilla} />
                  <XAxis type="number" allowDecimals={false} domain={[0, Math.max(1, emp.length)]} tick={{ fill: COLOR_GRAFICA.eje, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="nombre" width={140} tick={{ fill: COLOR_GRAFICA.eje, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "var(--marca-50)" }} content={<TooltipGrafica formato={(v) => `${v} de ${emp.length}`} />} />
                  <Bar dataKey="empresas" name="Empresas" fill={COLOR_GRAFICA.uno} radius={[0, 6, 6, 0]} isAnimationActive={ANIMAR} className="cursor-pointer"
                    onClick={(_: unknown, i: number) => { const k = adopcion[i]?.clave; if (k) router.push(`/plataforma/empresas?modulo=${k}`); }} />
                </BarChart>
              </ResponsiveContainer>
            </MarcoGrafica>
          )}
        </Tarjeta>
      </div>

      {/* Vencimientos con ventana seleccionable */}
      <Tarjeta className="mt-5" titulo="Próximos vencimientos" sub="Licencias que vencen dentro de la ventana elegida, de la más urgente a la menos"
        acciones={<Segmentado etiqueta="Ventana de días" valor={ventana} onChange={setVentana} opciones={[{ valor: "30", texto: "30 días" }, { valor: "60", texto: "60 días" }, { valor: "90", texto: "90 días" }]} />}>
        {vencen.length === 0 ? (
          <Vacio icono={<CalendarClock className="size-6" aria-hidden />} titulo="Nada vence en esta ventana" texto="Pruebe con una ventana más amplia." />
        ) : (
          <ul className="divide-y divide-borde">
            {vencen.map((e) => {
              const dr = e.dias_restantes ?? 0;
              const tono = dr < 0 ? "error" : dr <= 15 ? "alerta" : "ok";
              const pct = dr < 0 ? 100 : Math.max(4, 100 - (dr / Number(ventana)) * 100);
              return (
                <li key={e.id}>
                  <Link href={`/plataforma/empresas/${e.id}`} className="group -mx-2 grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 rounded-lg px-2 py-3 transition-colors hover:bg-marca-50 sm:grid-cols-[minmax(0,16rem)_1fr_auto]">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-tinta">{e.nombre}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-suave"><InsigniaEstado estado={e.licencia_estado} /> {e.plan ?? "Sin plan"}</span>
                    </span>
                    <span className="order-last col-span-2 sm:order-none sm:col-span-1" aria-hidden>
                      <span className="block h-2 overflow-hidden rounded-full bg-fondo">
                        <span className={cx("block h-full rounded-full", tono === "error" ? "bg-error" : tono === "alerta" ? "bg-alerta" : "bg-ok")} style={{ width: `${pct}%` }} />
                      </span>
                    </span>
                    <span className="flex items-center gap-2 text-right">
                      <span>
                        <span className={cx("num block text-sm font-bold", tono === "error" ? "text-error" : tono === "alerta" ? "text-alerta" : "text-tinta")}>{dr < 0 ? `Venció hace ${-dr} d` : dr === 0 ? "Vence hoy" : `${dr} días`}</span>
                        <span className="block text-xs text-suave">{e.fin ? fecha(e.fin) : "—"}</span>
                      </span>
                      <ChevronRight className="size-4 text-suave transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Tarjeta>
    </>
  );
}
