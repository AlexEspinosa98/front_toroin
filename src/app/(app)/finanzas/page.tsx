"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Info, Plus, Receipt, Trash2, TrendingUp, Wallet } from "lucide-react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { fechaCorta, fmtCOP, fmtMillones, fmtPct } from "@/lib/format";
import { hoy, nombreMes } from "@/lib/fechas";
import { useObras } from "@/lib/obras";
import { ANIMAR, Aviso, Boton, BotonIcono, Campo, COLOR_GRAFICA, cx, Esqueleto, Input, Modal, Segmentado, Select, Tarjeta, Titulo, Vacio, enfocarPrimerError, useAviso, useConfirmar } from "@/components/ui";
import { Indicador, SelectorObra } from "@/components/comunes";

type Res = { ingresos_proyectados: number; facturado: number; por_facturar: number; gastos: number; gasto_proyectado: number; utilidad_actual: number; utilidad_proyectada: number; margen_proyectado: number; rete_garantia_retenida: number; obra_ejecutada: number; avance_fisico: number; metodo: string };
type Rubro = { id: string; nombre: string; padre_id: string; padre: string };
type Periodo = { desde: string | null; hasta: string | null; facturado: number; gastos: number; neto: number; n_facturas: number; n_gastos: number };
type Fin = { obra: { id: string; nombre: string }; tiene_contrato: boolean; resumen: Res; periodo: Periodo | null; rubros: Rubro[];
  facturas: { id: string; numero: string; fecha: string; concepto: string; valor: number; actividad_id: string }[];
  gastos: { id: string; fecha: string; categoria: string; descripcion: string; valor: number; actividad_id: string }[];
  meses: { mes: string; facturado: number; gastos: number }[]; categorias: string[] };
type FilaRubro = { actividad_id: string; item: string; nombre: string; ubicacion: string; um: string; cantidad: number; ejecutado: number;
  contratado: number; valor_ejecutado: number; mano_obra: number; gastos: number; facturado: number; costo: number; margen: number; subitems: number };
type Tipo = "factura" | "gasto";

const nuevoForm = (cat = "Otros") => ({ fecha: hoy(), valor: "", texto: "", numero: "", categoria: cat, actividad_id: "" });
/** Acepta «1.250.000» o «1250000,50» */
const aNumero = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));

export default function Finanzas() {
  const { me } = useSession();
  const aviso = useAviso();
  const confirmar = useConfirmar();
  const { obras, cargando, obraId, setObraId, error: errObras } = useObras();
  const [res, setRes] = useState<{ obraId: string; d: Fin } | null>(null);
  const [error, setError] = useState("");
  const [ing, setIng] = useState("");
  const [vista, setVista] = useState<Tipo>("gasto");
  const [nuevo, setNuevo] = useState<Tipo>();
  const [form, setForm] = useState(nuevoForm());
  const [intento, setIntento] = useState(false);
  const [rubros, setRubros] = useState<{ obraId: string; filas: FilaRubro[]; sin: { gastos: number; facturado: number } } | null>(null);
  // Corte de facturación: recorta los movimientos a un rango; el resumen de la obra sigue siendo el acumulado
  const [corte, setCorte] = useState<{ desde: string; hasta: string } | null>(null);
  const query = corte ? `?desde=${corte.desde}&hasta=${corte.hasta}` : "";
  const puede = !me.solo_lectura && me.licencia?.escritura && ["admin", "gerencia", "super_admin"].includes(me.rol);

  useEffect(() => {
    if (!obraId) return;
    let vivo = true;
    api<Fin>(`obras/${obraId}/finanzas${query}`).then((r) => { if (vivo) { setRes({ obraId, d: r }); setIng(r.resumen.ingresos_proyectados ? String(Math.round(r.resumen.ingresos_proyectados)) : ""); setError(""); } }).catch((e) => vivo && setError(e.message));
    return () => { vivo = false; };
  }, [obraId, query]);
  const d = res?.obraId === obraId ? res.d : null;

  const enviar = useCallback(async (ruta: string, body: unknown, method = "POST", ok = "Guardado") => {
    try { await api(ruta, { method, body }); const r = await api<Fin>(`obras/${obraId}/finanzas${query}`); setRes({ obraId, d: r }); setIng(r.resumen.ingresos_proyectados ? String(Math.round(r.resumen.ingresos_proyectados)) : ""); aviso(ok); return true; }
    catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); return false; }
  }, [obraId, aviso, query]);

  const serie = useMemo(() => (d?.meses ?? []).map((m) => ({ mes: `${nombreMes(Number(m.mes.slice(5))).slice(0, 3)} ${m.mes.slice(2, 4)}`, Facturado: Math.round(m.facturado / 1e5) / 10, Gastos: Math.round(m.gastos / 1e5) / 10 })), [d]);
  useEffect(() => {
    if (!obraId) return;
    let vivo = true;
    api<{ rubros: FilaRubro[]; sin_imputar: { gastos: number; facturado: number } }>(`obras/${obraId}/rubros`)
      .then((r) => vivo && setRubros({ obraId, filas: r.rubros, sin: r.sin_imputar })).catch(() => {});
    return () => { vivo = false; };
  }, [obraId, res]);
  const porRubro = rubros?.obraId === obraId ? rubros : null;
  const nombreRubro = (id: string) => d?.rubros.find((x) => x.id === id)?.nombre ?? "";

  const porCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of d?.gastos ?? []) m.set(g.categoria, (m.get(g.categoria) ?? 0) + g.valor);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [d]);
  const maxCat = porCat[0]?.[1] || 1;
  const totalCat = porCat.reduce((t, [, v]) => t + v, 0) || 1;

  const valor = aNumero(form.valor);
  const errValor = !(valor > 0) ? "Ingrese un valor mayor a cero" : undefined;
  const errTexto = !form.texto.trim() ? (nuevo === "factura" ? "Ingrese el concepto" : "Ingrese la descripción") : undefined;
  const abrir = (t: Tipo) => { setForm(nuevoForm(d?.categorias.includes("Otros") ? "Otros" : d?.categorias[0])); setIntento(false); setNuevo(t); };
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setIntento(true);
    if (errValor || errTexto || !nuevo) return enfocarPrimerError(document.querySelector("dialog[open]"));
    const ok = nuevo === "factura"
      ? await enviar(`obras/${obraId}/facturas`, { numero: form.numero.trim(), fecha: form.fecha, concepto: form.texto.trim(), valor, actividad_id: form.actividad_id }, "POST", "Factura registrada")
      : await enviar(`obras/${obraId}/gastos`, { fecha: form.fecha, categoria: form.categoria, descripcion: form.texto.trim(), valor, actividad_id: form.actividad_id }, "POST", "Gasto registrado");
    if (ok) setNuevo(undefined);
  }
  async function quitar(tipo: Tipo, id: string, texto: string, v: number) {
    if (!(await confirmar({ titulo: "¿Eliminar este movimiento?", texto: `${texto} · ${fmtCOP(v)}`, aceptar: "Eliminar", peligro: true }))) return;
    await enviar(`${tipo === "gasto" ? "gastos" : "facturas"}/${id}`, undefined, "DELETE", "Movimiento eliminado");
  }

  const r = d?.resumen;
  const p = d?.periodo ?? null;
  const sinMovimientos = !!d && !corte && d.facturas.length === 0 && d.gastos.length === 0;
  const movimientos = (vista === "gasto"
    ? (d?.gastos ?? []).map((g) => ({ id: g.id, fecha: g.fecha, t: g.descripcion || g.categoria, sub: g.categoria, v: g.valor, rubro: nombreRubro(g.actividad_id) }))
    : (d?.facturas ?? []).map((f) => ({ id: f.id, fecha: f.fecha, t: f.concepto || "Factura", sub: f.numero ? `Factura ${f.numero}` : "Factura", v: f.valor, rubro: nombreRubro(f.actividad_id) }))
  ).sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <>
      <Titulo sub="Ingresos proyectados, facturas causadas y gastos operacionales"
        acciones={puede && d && (
          <>
            <Boton variante="secundario" icono={<Receipt className="size-4" aria-hidden />} onClick={() => abrir("factura")}>Factura</Boton>
            <Boton icono={<Plus className="size-4" aria-hidden />} onClick={() => abrir("gasto")}>Gasto</Boton>
          </>
        )}>Control financiero</Titulo>

      {/* Un solo renglón de filtros antes de cualquier cifra: obra y periodo */}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <SelectorObra className="w-full max-w-xs" obras={obras} valor={obraId} onChange={setObraId} />
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-semibold text-texto">Periodo</span>
          <Segmentado etiqueta="Periodo" valor={corte ? "rango" : "todo"}
            onChange={(v) => setCorte(v === "todo" ? null : { desde: `${hoy().slice(0, 7)}-01`, hasta: hoy() })}
            opciones={[{ valor: "todo", texto: "Toda la obra" }, { valor: "rango", texto: "Por fechas" }]} />
        </div>
        {corte && <>
          <Campo etiqueta="Desde" className="w-40"><Input type="date" value={corte.desde} max={corte.hasta} onChange={(e) => e.target.value && setCorte({ ...corte, desde: e.target.value })} /></Campo>
          <Campo etiqueta="Hasta" className="w-40"><Input type="date" value={corte.hasta} min={corte.desde} onChange={(e) => e.target.value && setCorte({ ...corte, hasta: e.target.value })} /></Campo>
        </>}
      </div>
      {(error || errObras) && <Aviso tono="error">{error || errObras}</Aviso>}
      {!cargando && !obras.length && !errObras && <Vacio icono={<Wallet className="size-6" aria-hidden />} titulo="Primero cree una obra" texto="El control financiero se lleva obra por obra." />}
      {obraId && !d && !error && <div className="space-y-3"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Esqueleto key={i} className="h-28" />)}</div><Esqueleto className="h-64" /></div>}

      {d && r && (
        <>
          {!d.tiene_contrato && <div className="mb-4"><Aviso tono="alerta">Esta obra no tiene contrato cargado; el avance y los ingresos se toman de lo que digite abajo.</Aviso></div>}
          {/* Obra sin un solo movimiento: en vez de cuatro ceros, qué registrar y para qué sirve */}
          {sinMovimientos && <Tarjeta className="mb-5" titulo="Esta obra todavía no tiene movimientos" sub="Con dos cosas registradas, esta pantalla ya le dice si la obra va ganando o perdiendo.">
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-marca-50 text-xs font-bold text-marca-texto">1</span>
                <span><strong className="text-tinta">Registre las facturas</strong> que le pasa al cliente (actas, cortes de obra). Eso llena «Facturado» y le muestra cuánto falta por cobrar del contrato.</span></li>
              <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-marca-50 text-xs font-bold text-marca-texto">2</span>
                <span><strong className="text-tinta">Registre los gastos</strong> de la obra: material, transporte, herramienta, cortes a subcontratistas. Las compras recibidas entran solas desde Compras.</span></li>
              <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-marca-50 text-xs font-bold text-marca-texto">3</span>
                <span><strong className="text-tinta">Impute cada movimiento a un ítem</strong> del contrato cuando pueda. Es lo que llena «Costo por ítem» y le dice cuál actividad le está dando pérdida.</span></li>
            </ol>
            {puede && <div className="mt-4 flex flex-wrap gap-2">
              <Boton icono={<Receipt className="size-4" aria-hidden />} onClick={() => abrir("factura")}>Registrar la primera factura</Boton>
              <Boton variante="secundario" icono={<Plus className="size-4" aria-hidden />} onClick={() => abrir("gasto")}>Registrar un gasto</Boton>
            </div>}
          </Tarjeta>}
          {/* Las cifras grandes siguen al periodo escogido: si hay corte, mandan las del corte y el acumulado pasa al detalle */}
          {p ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Indicador etiqueta="Contrato" valor={fmtMillones(r.ingresos_proyectados)} detalle="Valor total · no depende del corte" icono={<Wallet className="size-5" aria-hidden />} />
              <Indicador etiqueta="Facturado en el corte" valor={fmtMillones(p.facturado)} detalle={`${p.n_facturas} factura(s) · ${fmtMillones(r.facturado)} en toda la obra`} icono={<Receipt className="size-5" aria-hidden />} />
              <Indicador etiqueta="Gastos en el corte" valor={fmtMillones(p.gastos)} detalle={`${p.n_gastos} movimiento(s) · ${fmtMillones(r.gastos)} en toda la obra`} tono="alerta" />
              <Indicador etiqueta="Neto del corte" valor={fmtMillones(p.neto)} detalle="Facturado − gastos de esas fechas" tono={p.neto < 0 ? "error" : "ok"} icono={<TrendingUp className="size-5" aria-hidden />} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Indicador etiqueta="Contrato" valor={fmtMillones(r.ingresos_proyectados)} detalle="Ingresos proyectados de la obra" icono={<Wallet className="size-5" aria-hidden />} />
              <Indicador etiqueta="Facturado (causado)" valor={fmtMillones(r.facturado)} detalle={r.ingresos_proyectados ? `${fmtPct(r.facturado / r.ingresos_proyectados)} del contrato · por facturar ${fmtMillones(r.por_facturar)}` : `Por facturar ${fmtMillones(r.por_facturar)}`} icono={<Receipt className="size-5" aria-hidden />} />
              <Indicador etiqueta="Gastos operacionales" valor={fmtMillones(r.gastos)} detalle={`Proyectado al cierre: ${fmtMillones(r.gasto_proyectado)}`} tono="alerta" />
              <Indicador etiqueta="Utilidad proyectada" valor={fmtMillones(r.utilidad_proyectada)} detalle={`Margen proyectado ${fmtPct(r.margen_proyectado, 1)}`} tono={r.utilidad_proyectada < 0 ? "error" : "ok"} icono={<TrendingUp className="size-5" aria-hidden />} />
            </div>
          )}
          <p className="mt-2 flex items-start gap-1.5 text-xs text-suave"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {p
            ? `Las tres cifras del corte cuentan solo lo registrado entre el ${fechaCorta(p.desde ?? "")} y el ${fechaCorta(p.hasta ?? "")}. El contrato y los ítems de abajo son de toda la obra.`
            : `${r.metodo}. Utilidad proyectada = ingresos proyectados − gasto proyectado.`}</p>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <Tarjeta titulo="Facturado vs. gastos por mes" sub="Millones de pesos · historia completa de la obra, no del corte" className="lg:col-span-2">
              {serie.length === 0 ? (
                <Vacio icono={<Receipt className="size-6" aria-hidden />} titulo="Aún no hay movimientos" texto="Registre facturas y gastos para ver la comparación mensual." />
              ) : (
                <>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={serie} margin={{ left: -12, right: 8, top: 8 }}>
                        <CartesianGrid vertical={false} stroke={COLOR_GRAFICA.rejilla} />
                        <XAxis dataKey="mes" tick={{ fontSize: 12, fill: COLOR_GRAFICA.eje }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: COLOR_GRAFICA.eje }} tickLine={false} axisLine={false} />
                        <Tooltip formatter={(v) => `$${v} M`} cursor={{ fill: "var(--marca-50)" }} />
                        <Bar isAnimationActive={ANIMAR} dataKey="Facturado" fill={COLOR_GRAFICA.uno} radius={[4, 4, 0, 0]} />
                        <Bar isAnimationActive={ANIMAR} dataKey="Gastos" fill={COLOR_GRAFICA.dos} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-2 flex gap-4 text-sm text-suave">
                    <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm" style={{ background: COLOR_GRAFICA.uno }} aria-hidden /> Facturado</span>
                    <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm" style={{ background: COLOR_GRAFICA.dos }} aria-hidden /> Gastos</span>
                  </p>
                </>
              )}
            </Tarjeta>

            <Tarjeta titulo="Cartera" sub="Lo hecho, lo cobrado y lo retenido">
              <dl className="space-y-3 text-sm">
                {[
                  ["Obra ejecutada (bitácora)", fmtCOP(r.obra_ejecutada)],
                  ["Ejecutada sin facturar", fmtCOP(r.por_facturar)],
                  ["Retención en garantía acumulada", fmtCOP(r.rete_garantia_retenida)],
                  ["Utilidad a la fecha (facturado − gastos)", fmtCOP(r.utilidad_actual)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-borde pb-2 last:border-0"><dt className="text-suave">{k}</dt><dd className="num text-right font-semibold">{v}</dd></div>
                ))}
              </dl>
            </Tarjeta>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            {/* Comparar magnitudes entre categorías: barras horizontales ordenadas, con el valor al lado */}
            <Tarjeta titulo="En qué se va la plata" sub={p ? "Gastos del corte, por categoría" : "Gastos de la obra, por categoría"} className="lg:col-span-2">
              {porCat.length === 0 ? (
                <Vacio icono={<Wallet className="size-6" aria-hidden />} titulo="Sin gastos en este periodo" texto="Al registrar gastos aparece aquí en qué se está yendo la plata." />
              ) : (
                <ul className="space-y-3">
                  {porCat.map(([c, v]) => (
                    <li key={c}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-semibold text-tinta">{c}</span>
                        <span className="num shrink-0 font-semibold">{fmtCOP(v)}<span className="ml-2 font-normal text-suave">{fmtPct(v / totalCat, 0)}</span></span>
                      </div>
                      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-marca-50">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(2, (v / maxCat) * 100)}%`, background: COLOR_GRAFICA.uno }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>

            <Tarjeta titulo="Ingresos proyectados" sub="Con qué se compara la utilidad de la obra">
              <p className="text-sm text-suave">Por defecto es el valor del contrato ({fmtCOP(r.ingresos_proyectados)}). Ajústelo solo si lo que espera facturar es otro.</p>
              {puede ? (
                <div className="mt-3 space-y-2">
                  <Campo etiqueta="Valor" ayuda={Number(ing) > 0 ? fmtCOP(Number(ing)) : "Vacío = valor total del contrato"}>
                    <Input type="number" min={0} inputMode="numeric" className="num" value={ing} onChange={(e) => setIng(e.target.value)} />
                  </Campo>
                  <Boton variante="secundario" className="w-full" onClick={() => enviar(`obras/${obraId}/ingresos`, { ingresos_proyectados: ing === "" ? null : Number(ing) }, "PUT")}>Guardar</Boton>
                </div>
              ) : <p className="num mt-3 text-2xl font-extrabold text-tinta">{fmtCOP(r.ingresos_proyectados)}</p>}
            </Tarjeta>
          </div>

          <Tarjeta className="mt-5" titulo="Movimientos"
            acciones={<Segmentado etiqueta="Tipo de movimiento" valor={vista} onChange={setVista} opciones={[{ valor: "gasto", texto: `Gastos (${d.gastos.length})` }, { valor: "factura", texto: `Facturas (${d.facturas.length})` }]} />}>
            {movimientos.length === 0 ? (
              <Vacio icono={vista === "gasto" ? <Wallet className="size-6" aria-hidden /> : <Receipt className="size-6" aria-hidden />} titulo={vista === "gasto" ? "Sin gastos registrados" : "Sin facturas registradas"}
                texto={puede ? "Use el botón de arriba para registrar el primero." : undefined}
                accion={puede ? <Boton icono={<Plus className="size-4" aria-hidden />} onClick={() => abrir(vista)}>{vista === "gasto" ? "Registrar gasto" : "Registrar factura"}</Boton> : undefined} />
            ) : (
              <ul key={vista} className="animar-fundido divide-y divide-borde">
                {movimientos.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{x.t}</p>
                      <p className="text-sm text-suave">{fechaCorta(x.fecha)} · {x.sub}{x.rubro ? ` · ${x.rubro}` : ""}</p>
                    </div>
                    <span className="num font-semibold">{fmtCOP(x.v)}</span>
                    {puede && <BotonIcono peligro etiqueta={`Eliminar ${x.t}`} onClick={() => quitar(vista, x.id, x.t, x.v)}><Trash2 className="size-4" aria-hidden /></BotonIcono>}
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>

          {!!porRubro?.filas.length && (
            <Tarjeta className="mt-5" titulo="Costo por ítem del contrato"
              sub="Lo que el cliente paga por lo ejecutado frente a lo que ha costado: mano de obra de la bitácora más los gastos y compras imputados al ítem.">
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <table className="w-full min-w-[680px] text-sm">
                  <thead><tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-suave">
                    <th scope="col" className="px-2 py-2 font-semibold">Ítem</th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">Ejecutado</th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">Mano de obra</th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">Gastos</th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">Margen</th>
                  </tr></thead>
                  <tbody className="divide-y divide-borde">
                    {[...porRubro.filas].sort((a, b) => a.margen - b.margen).map((x) => (
                      <tr key={x.actividad_id}>
                        <td className="px-2 py-2.5"><span className="font-semibold">{x.nombre}{x.ubicacion ? ` · ${x.ubicacion}` : ""}</span>
                          <span className="block text-xs text-suave">{fmtCOP(x.contratado)} contratados{x.subitems ? ` · ${x.subitems} subítem${x.subitems === 1 ? "" : "s"}` : ""}</span></td>
                        <td className="num px-2 text-right">{fmtCOP(x.valor_ejecutado)}</td>
                        <td className="num px-2 text-right text-suave">{fmtCOP(x.mano_obra)}</td>
                        <td className="num px-2 text-right text-suave">{fmtCOP(x.gastos)}</td>
                        <td className={cx("num px-2 text-right font-semibold", x.margen < 0 ? "text-error" : "text-ok")}>{fmtCOP(x.margen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(porRubro.sin.gastos > 0 || porRubro.sin.facturado > 0) && (
                <p className="mt-3 text-sm text-suave">Sin imputar a ningún ítem: {fmtCOP(porRubro.sin.gastos)} en gastos y {fmtCOP(porRubro.sin.facturado)} facturados.</p>
              )}
            </Tarjeta>
          )}
        </>
      )}

      <Modal abierto={!!nuevo} onCerrar={() => setNuevo(undefined)} sucio={!!(form.valor || form.texto || form.numero)}
        titulo={nuevo === "factura" ? "Registrar factura causada" : "Registrar gasto operacional"}
        pie={<><Boton type="button" variante="secundario" onClick={() => setNuevo(undefined)}>Cancelar</Boton><Boton type="submit" form="form-movimiento">Guardar</Boton></>}>
        <form id="form-movimiento" onSubmit={guardar} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Fecha"><Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></Campo>
            {nuevo === "factura" ? (
              <Campo etiqueta="Número de factura"><Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></Campo>
            ) : (
              <Campo etiqueta="Categoría"><Select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>{(d?.categorias ?? []).map((c) => <option key={c}>{c}</option>)}</Select></Campo>
            )}
          </div>
          <Campo etiqueta={nuevo === "factura" ? "Concepto" : "Descripción"} error={intento ? errTexto : undefined}>
            <Input data-autofocus placeholder={nuevo === "factura" ? "Corte de obra No. 3" : "Pago cuadrilla, compra de insumos…"} value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} />
          </Campo>
          <Campo etiqueta="Valor (COP)" error={intento ? errValor : undefined} ayuda={valor > 0 ? fmtCOP(valor) : undefined}>
            <Input inputMode="numeric" className="num" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
          </Campo>
          {!!d?.rubros.length && (
            <Campo etiqueta="Ítem del contrato (opcional)" ayuda="Para ver cuánto lleva costando ese rubro frente a lo que paga el cliente">
              <Select value={form.actividad_id} onChange={(e) => setForm({ ...form, actividad_id: e.target.value })}>
                <option value="">Sin imputar a un ítem</option>
                {d.rubros.map((x) => <option key={x.id} value={x.id}>{x.padre ? `   ${x.padre} › ${x.nombre}` : x.nombre}</option>)}
              </Select>
            </Campo>
          )}
        </form>
      </Modal>
    </>
  );
}
