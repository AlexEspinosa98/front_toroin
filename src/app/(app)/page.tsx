"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BadgeCheck, Building2, ChevronRight, CircleCheck, HardHat, Lock, UserCog } from "lucide-react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { fecha, fechaCorta, fmtMillones, fmtPct, limiteTexto } from "@/lib/format";
import type { Alerta, ResumenObraT } from "@/lib/types";
import { ANIMAR, COLOR_GRAFICA, cx, Esqueleto, InsigniaEstado, Segmentado, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { PanelAsistencia } from "@/components/PanelAsistencia";
import { Leyenda, MarcoGrafica, TooltipGrafica } from "@/components/graficas";
import { BarraAvance, ChipSemaforo, FilaAlerta, Indicador } from "@/components/comunes";

type Lic = { uso: Record<string, number>; limites: Record<string, number | null>; fin: string | null; plan: string | null; modulos: { clave: string; nombre: string; activo: boolean }[] };
type FilaObra = { obra: { id: string; nombre: string; ciudad: string }; resumen: ResumenObraT; contrato: { numero: string; contratante: string; fecha_fin: string } | null };

const CONTADORES = [
  { k: "obras", t: "Obras", m: "obras", icono: <Building2 className="size-5" aria-hidden /> },
  { k: "trabajadores", t: "Trabajadores", m: "personal", icono: <HardHat className="size-5" aria-hidden /> },
  { k: "usuarios", t: "Usuarios", m: "usuarios", icono: <UserCog className="size-5" aria-hidden /> },
];

export default function Inicio() {
  const { me } = useSession();
  const empresa = me.ambito === "empresa";
  const verContratos = empresa && me.modulos.includes("contrato");
  const [lic, setLic] = useState<Lic | null>(null);
  const [al, setAl] = useState<Alerta[]>([]);
  const [obras, setObras] = useState<FilaObra[] | null>(null);
  const [vista, setVista] = useState<"lista" | "grafica">("lista");
  const [sev, setSev] = useState<string | null>(null);
  const router = useRouter();
  useEffect(() => { if (empresa) api<Lic>("empresa/licencia").then(setLic).catch(() => {}); }, [empresa]);
  useEffect(() => { if (empresa) api<{ alertas: Alerta[] }>("alertas").then((r) => setAl(r.alertas)).catch(() => {}); }, [empresa]);
  useEffect(() => { if (verContratos) api<FilaObra[]>("contratos").then(setObras).catch(() => setObras([])); }, [verContratos]);
  if (!empresa) return null;

  const contadores = CONTADORES.filter((c) => me.modulos.includes(c.m));
  const conContrato = (obras ?? []).filter((o) => o.contrato);
  const barras = conContrato.map((o) => ({ id: o.obra.id, nombre: o.obra.nombre, fisico: Math.round(o.resumen.avance_fisico * 100), esperado: Math.round(o.resumen.avance_tiempo * 100) }));
  const alVistas = sev ? al.filter((a) => a.severidad === sev) : al;
  const nSev = (k: string) => al.filter((a) => a.severidad === k).length;
  const hoy = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <Titulo sub={<>Hola, {me.nombre} · <span className="first-letter:uppercase">{hoy}</span></>}>{me.empresa?.nombre_app || me.empresa?.nombre}</Titulo>

      {contadores.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {contadores.map((c) => {
            const tope = lic?.limites[`max_${c.k}`];
            const uso = lic?.uso[c.k] ?? 0;
            const lleno = tope != null && tope > 0 && uso / tope >= 0.9;
            return (
              <Indicador key={c.k} etiqueta={c.t} icono={c.icono} valor={lic ? uso : "…"} tono={lleno ? "alerta" : undefined}
                detalle={lic && (tope == null ? "Sin límite en su plan" : (
                  <span className="block space-y-1.5">
                    <BarraAvance valor={uso / (tope || 1)} etiqueta={`Uso de ${c.t.toLowerCase()}`} tono={lleno ? "alerta" : "marca"} />
                    <span className="block">de {limiteTexto(tope)} permitidos</span>
                  </span>
                ))} />
            );
          })}
          {me.licencia && (
            <Indicador etiqueta="Licencia" icono={<BadgeCheck className="size-5" aria-hidden />}
              valor={<InsigniaEstado estado={me.licencia.estado} />}
              detalle={lic ? `Plan ${lic.plan ?? "—"} · ${lic.fin ? `hasta ${fecha(lic.fin)}` : "sin vencimiento"}` : undefined} />
          )}
        </div>
      )}

      {me.modulos.includes("asistencia") && <div className="mt-5"><PanelAsistencia /></div>}

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        {verContratos && (
          <Tarjeta titulo="Estado de las obras" sub="Barra: avance físico. Marca oscura: avance esperado según el tiempo transcurrido."
            className="xl:col-span-2" acciones={
              <div className="flex items-center gap-2">
                {barras.length > 0 && <Segmentado etiqueta="Vista" valor={vista} onChange={setVista} opciones={[{ valor: "lista", texto: "Lista" }, { valor: "grafica", texto: "Gráfica" }]} />}
                <Link href="/contrato" className="inline-flex min-h-11 items-center whitespace-nowrap px-1 text-sm font-semibold text-marca-texto hover:underline">Ver todas</Link>
              </div>}>
            {vista === "grafica" && barras.length > 0 ? (
              <div className="animar-fundido">
                <MarcoGrafica alto={Math.max(200, barras.length * 64)} etiqueta={`Avance físico frente a esperado: ${barras.map((b) => `${b.nombre} ${b.fisico} % de ${b.esperado} %`).join("; ")}`}>
                  <ResponsiveContainer>
                    <BarChart data={barras} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }} barGap={3} barCategoryGap={14}>
                      <CartesianGrid horizontal={false} stroke={COLOR_GRAFICA.rejilla} />
                      <XAxis type="number" domain={[0, 100]} unit=" %" tick={{ fill: COLOR_GRAFICA.eje, fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="nombre" width={150} tick={{ fill: COLOR_GRAFICA.eje, fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: "var(--marca-50)" }} content={<TooltipGrafica formato={(v) => `${v} %`} />} />
                      <Bar dataKey="fisico" name="Avance físico" fill={COLOR_GRAFICA.uno} radius={[0, 5, 5, 0]} isAnimationActive={ANIMAR} className="cursor-pointer" onClick={(_: unknown, i: number) => barras[i] && router.push(`/obras/${barras[i].id}`)} />
                      <Bar dataKey="esperado" name="Esperado por tiempo" fill={COLOR_GRAFICA.dos} radius={[0, 5, 5, 0]} isAnimationActive={ANIMAR} className="cursor-pointer" onClick={(_: unknown, i: number) => barras[i] && router.push(`/obras/${barras[i].id}`)} />
                    </BarChart>
                  </ResponsiveContainer>
                </MarcoGrafica>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-suave">
                  <span className="flex items-center gap-2"><span aria-hidden className="size-2.5 rounded-sm" style={{ background: COLOR_GRAFICA.uno }} />Avance físico</span>
                  <span className="flex items-center gap-2"><span aria-hidden className="size-2.5 rounded-sm" style={{ background: COLOR_GRAFICA.dos }} />Esperado por tiempo</span>
                  <span className="ml-auto text-xs">Toque una barra para abrir la obra</span>
                </div>
              </div>
            ) : !obras ? <div className="space-y-3"><Esqueleto className="h-16" /><Esqueleto className="h-16" /></div>
              : obras.length === 0 ? <Vacio icono={<Building2 className="size-6" aria-hidden />} titulo="Aún no hay obras" texto="Cree la primera obra para ver aquí su avance." />
              : (
                <ul className="divide-y divide-borde">
                  {obras.map(({ obra, resumen: r, contrato: c }) => (
                    <li key={obra.id}>
                      <Link href={`/obras/${obra.id}`} className="group -mx-2 flex items-center gap-4 rounded-lg px-2 py-3 transition-colors hover:bg-marca-50">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2"><span className="font-bold text-tinta">{obra.nombre}</span><ChipSemaforo s={r.semaforo} /></div>
                          <p className="text-sm text-suave">{c ? `Contrato ${c.numero || "—"} · ${c.contratante || "—"} · fin ${fechaCorta(c.fecha_fin)}` : "Sin contrato cargado"}</p>
                          {c && (
                            <div className="mt-2 flex items-center gap-3">
                              <BarraAvance valor={r.avance_fisico} meta={r.avance_tiempo} etiqueta={`Avance físico de ${obra.nombre}`} tono={r.semaforo === "atrasada" ? "error" : r.semaforo === "atencion" ? "alerta" : "ok"} />
                              <span className="num w-28 shrink-0 text-right text-sm font-semibold">{fmtPct(r.avance_fisico)} <span className="font-normal text-suave">/ {fmtPct(r.avance_tiempo)}</span></span>
                            </div>
                          )}
                          {c && <p className="mt-1 text-xs text-suave">{fmtMillones(r.valor_ejecutado)} de {fmtMillones(r.valor_contrato)} ejecutados</p>}
                        </div>
                        <ChevronRight className="size-5 shrink-0 text-suave transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
          </Tarjeta>
        )}

        <Tarjeta titulo="Requiere su atención" className={verContratos ? "order-first xl:order-none" : "xl:col-span-3"}
          acciones={al.length > 0 ? <Link className="inline-flex min-h-11 items-center whitespace-nowrap text-sm font-semibold text-marca-texto hover:underline" href="/alertas">Ver todas</Link> : undefined}>
          {al.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-suave"><CircleCheck className="size-4 text-ok" aria-hidden /> Todo en orden: no hay alertas pendientes.</p>
          ) : (
            <>
              <Leyenda className="mb-2" activo={sev} onActivar={setSev} items={[
                { clave: "alta", texto: "Urgentes", color: "var(--error)", valor: nSev("alta") },
                { clave: "media", texto: "Atención", color: "var(--alerta)", valor: nSev("media") },
                { clave: "baja", texto: "Info", color: "#8b93a7", valor: nSev("baja") },
              ].filter((x) => x.valor > 0)} />
              {alVistas.length === 0 ? <p className="py-3 text-sm text-suave">Ninguna alerta de este tipo.</p>
                : <ul className={cx("space-y-0.5")}>{alVistas.slice(0, 5).map((a, i) => <li key={`${a.titulo}-${i}`}><FilaAlerta a={a} compacta /></li>)}</ul>}
            </>
          )}
        </Tarjeta>
      </div>

      <Tarjeta titulo="Módulos de su licencia" sub={lic ? `Plan ${lic.plan ?? "—"} · vigencia hasta ${lic.fin ? fecha(lic.fin) : "sin vencimiento"}` : undefined} className="mt-5"
        acciones={<Link className="inline-flex min-h-11 items-center whitespace-nowrap text-sm font-semibold text-marca-texto hover:underline" href="/licencia">Ver detalle</Link>}>
        {!lic ? <Esqueleto className="h-20" /> : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {lic.modulos.map((m) => (
              <div key={m.clave} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium ${m.activo ? "border-ok/30 bg-ok-50 text-ok" : "border-borde bg-fondo text-suave"}`}>
                {m.activo ? <CircleCheck className="size-4 shrink-0" aria-hidden /> : <Lock className="size-4 shrink-0" aria-hidden />}
                <span className="min-w-0 flex-1 truncate">{m.nombre}</span>
                {!m.activo && <span className="shrink-0 text-xs">No incluido</span>}
              </div>
            ))}
          </div>
        )}
      </Tarjeta>
    </>
  );
}
