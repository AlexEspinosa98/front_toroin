"use client";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronRight, Download, Sun, UserCheck, Users } from "lucide-react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { descargarCSV, quincenas } from "@/lib/csv";
import { fechaCorta } from "@/lib/format";
import { hoy, nombreMes } from "@/lib/fechas";
import { useObras } from "@/lib/obras";
import { Aviso, Boton, Buscador, Campo, Chip, cx, Esqueleto, Input, Segmentado, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { Indicador, SelectorObra } from "@/components/comunes";

type Sem = { domingo: string; laborables: number; asistidos: number; justificados: number; faltas: string[]; festivos: { fecha: string; nombre: string }[]; reconocido: boolean; razon: string };
type Fila = { trabajador_id: string; nombre: string; cedula: string; cargo: string; dias_asistidos: number; domingos: number; festivos: number; ausencias_justificadas: number; ausencias_injustificadas: number; total: number; semanas: Sem[] };
type Resp = { config: { regla_dominical: string; semana: string }; filas: Fila[] };
type Fest = { fecha: string; nombre: string };
type Periodo = "q1" | "q2" | "mes";

export default function ControlPersonal() {
  const { me } = useSession();
  const h = hoy();
  const { obras, obraId, setObraId } = useObras({ todas: true });
  const [mes, setMes] = useState(h.slice(0, 7));
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [res, setRes] = useState<{ clave: string; datos: Resp } | null>(null);
  const [festivos, setFestivos] = useState<Fest[]>([]);
  const [error, setError] = useState("");
  const [anio, m] = mes.split("-").map(Number);
  // El corte de la empresa rara vez es el mes calendario: por eso también se puede pedir cualquier rango.
  const [per, setPer] = useState<Periodo>("mes");
  const [rango, setRango] = useState<{ desde: string; hasta: string } | null>(null);
  const finMes = quincenas(anio, m).mes[1].slice(8);
  const [desde, hasta] = rango ? [rango.desde, rango.hasta] : quincenas(anio, m)[per];
  const clave = `${desde}|${hasta}|${obraId}`;
  const puedeAjustes = ["admin", "gerencia", "super_admin"].includes(me.rol);

  useEffect(() => {
    let vivo = true;
    api<Resp>(`control-personal?desde=${desde}&hasta=${hasta}${obraId ? `&obra_id=${obraId}` : ""}`)
      .then((r) => { if (vivo) { setRes({ clave, datos: r }); setError(""); } })
      .catch((e) => vivo && setError(e.message));
    return () => { vivo = false; };
  }, [desde, hasta, obraId, clave]);
  // Un rango libre puede cruzar el año: se piden los festivos de los años que toca
  const anios = [...new Set([desde.slice(0, 4), hasta.slice(0, 4)])].join(",");
  useEffect(() => {
    let vivo = true;
    Promise.all(anios.split(",").map((a) => api<Fest[]>(`festivos?anio=${a}`).catch(() => [] as Fest[])))
      .then((ls) => vivo && setFestivos(ls.flat()));
    return () => { vivo = false; };
  }, [anios]);
  const datos = res?.clave === clave ? res.datos : null;

  const filas = useMemo(() => datos?.filas ?? [], [datos]);
  const visibles = filas.filter((x) => !q || x.nombre.toLowerCase().includes(q.toLowerCase()));
  const sum = (k: "dias_asistidos" | "domingos" | "ausencias_injustificadas") => filas.reduce((s, x) => s + x[k], 0);
  // Los festivos y el título siguen al periodo pedido, no al mes del selector
  const festivosMes = festivos.filter((f) => f.fecha >= desde && f.fecha <= hasta);
  const legal = datos?.config.regla_dominical !== "literal";
  const titulo = rango || per !== "mes"
    ? `${fechaCorta(desde)} – ${fechaCorta(hasta)}`
    : `${nombreMes(m).charAt(0).toUpperCase()}${nombreMes(m).slice(1)} de ${anio}`;

  const exportar = () => descargarCSV(`control-personal-${desde}_${hasta}.csv`, [
    ["Trabajador", "Cédula", "Cargo", "Días asistidos", "Domingos reconocidos", "Festivos", "Ausencias justificadas", "Ausencias sin justificar", "Total días"],
    ...filas.map((x) => [x.nombre, x.cedula, x.cargo, x.dias_asistidos, x.domingos, x.festivos, x.ausencias_justificadas, x.ausencias_injustificadas, x.total]),
  ]);

  return (
    <>
      <Titulo sub={datos ? <>Regla del domingo: {legal ? "legal (semana completa, art. 173 CST)" : "más de 5 días"} · semana {datos.config.semana === "LV" ? "de lunes a viernes" : "de lunes a sábado"}. {puedeAjustes && <Link href="/ajustes" className="font-semibold text-marca-texto underline">Cambiar en Ajustes</Link>}</> : "Días de asistencia por persona en el periodo, domingos y festivos"}
        acciones={<Boton variante="secundario" icono={<Download className="size-4" aria-hidden />} onClick={exportar} disabled={!filas.length}>Exportar a Excel (CSV)</Boton>}>Control de personal</Titulo>

      <div className="flex flex-wrap items-end gap-3">
        {!rango && <Campo etiqueta="Mes" className="w-44"><Input type="month" value={mes} max={h.slice(0, 7)} onChange={(e) => e.target.value && setMes(e.target.value)} /></Campo>}
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-semibold text-texto">Periodo</span>
          <Segmentado etiqueta="Periodo" valor={rango ? "libre" : per}
            onChange={(v) => { if (v === "libre") setRango({ desde, hasta }); else { setRango(null); setPer(v as Periodo); } }}
            opciones={[{ valor: "mes", texto: "Mes completo" }, { valor: "q1", texto: "1–15" }, { valor: "q2", texto: `16–${finMes}` }, { valor: "libre", texto: "Fechas" }]} />
        </div>
        {rango && <>
          <Campo etiqueta="Desde" className="w-40"><Input type="date" value={rango.desde} max={rango.hasta} onChange={(e) => e.target.value && setRango({ ...rango, desde: e.target.value })} /></Campo>
          <Campo etiqueta="Hasta" className="w-40"><Input type="date" value={rango.hasta} min={rango.desde} max={h} onChange={(e) => e.target.value && setRango({ ...rango, hasta: e.target.value })} /></Campo>
        </>}
        <SelectorObra className="w-full max-w-xs" obras={obras} valor={obraId} onChange={setObraId} todas />
      </div>

      {error && <div className="mt-3"><Aviso tono="error">{error}</Aviso></div>}
      {!datos && !error && <div className="mt-4 space-y-3"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Esqueleto key={i} className="h-28" />)}</div><Esqueleto className="h-64" /></div>}

      {datos && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador etiqueta="Personas" valor={filas.length} icono={<Users className="size-5" aria-hidden />} />
            <Indicador etiqueta="Días asistidos" valor={sum("dias_asistidos")} icono={<UserCheck className="size-5" aria-hidden />} />
            <Indicador etiqueta="Domingos reconocidos" valor={sum("domingos")} tono="acento" icono={<Sun className="size-5" aria-hidden />} />
            <Indicador etiqueta="Festivos del periodo" valor={festivosMes.length} icono={<CalendarDays className="size-5" aria-hidden />}
              detalle={festivosMes.map((f) => `${fechaCorta(f.fecha).slice(0, 6)} ${f.nombre}`).join(" · ") || "Ninguno"} />
          </div>
          {sum("ausencias_injustificadas") > 0 && <div className="mt-3"><Aviso tono="alerta">Hay {sum("ausencias_injustificadas")} ausencia(s) sin justificar en este periodo.</Aviso></div>}

          <Tarjeta className="mt-5" titulo={titulo} sub="Toque una persona para ver el detalle semana a semana">
            <Buscador className="mb-3 max-w-md" etiqueta="Buscar trabajador" valor={q} onChange={setQ} />
            {filas.length === 0 ? (
              <Vacio icono={<CalendarDays className="size-6" aria-hidden />} titulo="No hay asistencia registrada en este periodo" texto="Los días se totalizan con la asistencia diaria que registra el SST." />
            ) : visibles.length === 0 ? (
              <Vacio titulo="Sin resultados" texto="Pruebe con otro nombre." />
            ) : (
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-suave">
                      <th scope="col" className="px-4 py-2 font-semibold sm:px-2">Trabajador</th>
                      <th scope="col" className="px-2 py-2 text-right font-semibold">Días asistidos</th>
                      <th scope="col" className="px-2 py-2 text-right font-semibold">Domingos</th>
                      <th scope="col" className="px-2 py-2 text-right font-semibold">Festivos</th>
                      <th scope="col" className="px-2 py-2 text-right font-semibold">Ausencias just.</th>
                      <th scope="col" className="px-2 py-2 text-right font-semibold">Sin justificar</th>
                      <th scope="col" className="px-2 py-2 text-right font-semibold">Total días</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borde">
                    {visibles.map((x) => {
                      const abierta = abierto === x.trabajador_id;
                      return (
                        <Fragment key={x.trabajador_id}>
                          <tr className="hover:bg-marca-50/60">
                            <td className="px-4 py-2.5 sm:px-2">
                              <button type="button" className="-ml-1 flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-left font-semibold text-tinta hover:text-marca-texto" aria-expanded={abierta} onClick={() => setAbierto(abierta ? null : x.trabajador_id)}>
                                <ChevronRight className={cx("size-4 shrink-0 text-suave transition-transform duration-150", abierta && "rotate-90")} aria-hidden />
                                {x.nombre}
                              </button>
                              <span className="block pl-6 text-xs text-suave">{x.cargo || x.cedula}</span>
                            </td>
                            <td className="num px-2 text-right">{x.dias_asistidos}</td>
                            <td className="num px-2 text-right font-semibold text-acento-texto">{x.domingos}</td>
                            <td className="num px-2 text-right">{legal ? x.festivos : "—"}</td>
                            <td className="num px-2 text-right">{x.ausencias_justificadas}</td>
                            <td className={cx("num px-2 text-right", x.ausencias_injustificadas > 0 && "font-semibold text-error")}>{x.ausencias_injustificadas}</td>
                            <td className="num px-2 text-right text-base font-extrabold text-tinta">{x.total}</td>
                          </tr>
                          {abierta && (
                            <tr>
                              <td colSpan={7} className="bg-fondo px-4 py-3 sm:px-2">
                                <ul className="animar-entrada grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                  {x.semanas.map((s) => (
                                    <li key={s.domingo} className="rounded-lg border border-borde bg-white p-3">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-semibold">Domingo {fechaCorta(s.domingo)}</span>
                                        <Chip tono={s.reconocido ? "ok" : "neutro"}>{s.reconocido ? "Reconocido" : "No reconocido"}</Chip>
                                      </div>
                                      <p className="mt-1 text-sm text-suave">{s.razon}</p>
                                      {s.festivos.length > 0 && <p className="text-xs text-acento-texto">Festivo: {s.festivos.map((f) => f.nombre).join(", ")}</p>}
                                      {s.faltas.length > 0 && <p className="text-xs text-error">Faltas: {s.faltas.map((f) => fechaCorta(f).slice(0, 6)).join(", ")}</p>}
                                    </li>
                                  ))}
                                  {x.semanas.length === 0 && <li className="text-sm text-suave">Aún no hay domingos cerrados en el mes.</li>}
                                </ul>
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
            <p className="mt-3 text-xs text-suave">Total días = días asistidos + domingos reconocidos{legal ? " + festivos remunerados" : ""}. Una persona que asiste a dos obras el mismo día cuenta un solo día.</p>
          </Tarjeta>
        </>
      )}
    </>
  );
}
