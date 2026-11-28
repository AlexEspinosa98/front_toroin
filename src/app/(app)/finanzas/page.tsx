"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarRange, Info, Plus, Receipt, Trash2, TrendingUp, Wallet } from "lucide-react";
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
    api<Fin>(`obras/${obraId}/finanzas${query}`).then((r) => { if (vivo) { setRes({ obraId, d: r }); setIng(String(r.resumen.ingresos_proyectados || "")); setError(""); } }).catch((e) => vivo && setError(e.message));
    return () => { vivo = false; };
  }, [obraId, query]);
  const d = res?.obraId === obraId ? res.d : null;

  const enviar = useCallback(async (ruta: string, body: unknown, method = "POST", ok = "Guardado") => {
    try { await api(ruta, { method, body }); const r = await api<Fin>(`obras/${obraId}/finanzas${query}`); setRes({ obraId, d: r }); setIng(String(r.resumen.ingresos_proyectados || "")); aviso(ok); return true; }
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

      <div className="mb-5 grid max-w-3xl gap-3 sm:grid-cols-[1fr_auto]">
        <SelectorObra className="max-w-sm" obras={obras} valor={obraId} onChange={setObraId} />
        <div className="flex items-end">
          <Boton variante="secundario" icono={<CalendarRange className="size-4" aria-hidden />}
            onClick={() => setCorte(corte ? null : { desde: `${hoy().slice(0, 7)}-01`, hasta: hoy() })}>
            {corte ? "Ver todo" : "Corte por fechas"}
          </Boton>
        </div>
      </div>
      {corte && <div className="mb-5 grid max-w-xl gap-3 sm:grid-cols-2">
        <Campo etiqueta="Desde"><Input type="date" value={corte.desde} max={corte.hasta} onChange={(e) => e.target.value && setCorte({ ...corte, desde: e.target.value })} /></Campo>
        <Campo etiqueta="Hasta"><Input type="date" value={corte.hasta} min={corte.desde} onChange={(e) => e.target.value && setCorte({ ...corte, hasta: e.target.value })} /></Campo>
      </div>}
      {d?.periodo && <div className="mb-5"><Tarjeta titulo={`Corte ${fechaCorta(d.periodo.desde ?? "")} – ${fechaCorta(d.periodo.hasta ?? "")}`} sub="Solo lo que se movió en esas fechas. Los indicadores de abajo siguen siendo el acumulado de la obra.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Indicador etiqueta="Facturado en el corte" valor={fmtCOP(d.periodo.facturado)} detalle={`${d.periodo.n_facturas} factura(s)`} icono={<Receipt className="size-5" aria-hidden />} />
          <Indicador etiqueta="Gastos en el corte" valor={fmtCOP(d.periodo.gastos)} detalle={`${d.periodo.n_gastos} movimiento(s)`} icono={<Wallet className="size-5" aria-hidden />} />
          <Indicador etiqueta="Neto del corte" valor={fmtCOP(d.periodo.neto)} tono={d.periodo.neto >= 0 ? "ok" : "error"} />
        </div>
      </Tarjeta></div>}
      {(error || errObras) && <Aviso tono="error">{error || errObras}</Aviso>}
      {!cargando && !obras.length && !errObras && <Vacio icono={<Wallet className="size-6" aria-hidden />} titulo="Primero cree una obra" texto="El control financiero se lleva obra por obra." />}
      {obraId && !d && !error && <div className="space-y-3"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Esqueleto key={i} className="h-28" />)}</div><Esqueleto className="h-64" /></div>}

      {d && r && (
        <>
          {!d.tiene_contrato && <div className="mb-4"><Aviso tono="alerta">Esta obra no tiene contrato cargado; el avance y los ingresos se toman de lo que digite abajo.</Aviso></div>}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador etiqueta="Ingresos proyectados" valor={fmtMillones(r.ingresos_proyectados)} detalle="Valor total del contrato" icono={<Wallet className="size-5" aria-hidden />} />
            <Indicador etiqueta="Facturado (causado)" valor={fmtMillones(r.facturado)} detalle={r.ingresos_proyectados ? `${fmtPct(r.facturado / r.ingresos_proyectados)} del contrato · por facturar ${fmtMillones(r.por_facturar)}` : `Por facturar ${fmtMillones(r.por_facturar)}`} icono={<Receipt className="size-5" aria-hidden />} />
            <Indicador etiqueta="Gastos operacionales" valor={fmtMillones(r.gastos)} detalle={`Proyectado al cierre: ${fmtMillones(r.gasto_proyectado)}`} tono="alerta" />
            <Indicador etiqueta="Utilidad proyectada" valor={fmtMillones(r.utilidad_proyectada)} detalle={`Margen proyectado ${fmtPct(r.margen_proyectado, 1)}`} tono={r.utilidad_proyectada < 0 ? "error" : "ok"} icono={<TrendingUp className="size-5" aria-hidden />} />
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-suave"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {r.metodo}. Utilidad proyectada = ingresos proyectados − gasto proyectado.</p>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <Tarjeta titulo="Facturado vs. gastos por mes" sub="Millones de pesos" className="lg:col-span-2">
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

            <Tarjeta titulo="Flujo y cartera">
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
              {puede && (
                <div className="mt-4 space-y-2">
                  <Campo etiqueta="Ingresos proyectados" ayuda={Number(ing) > 0 ? `${fmtCOP(Number(ing))}. Por defecto, el valor del contrato; ajústelo si hay otrosí.` : "Vacío = valor total del contrato"}>
                    <Input type="number" min={0} inputMode="numeric" className="num" value={ing} onChange={(e) => setIng(e.target.value)} />
                  </Campo>
                  <Boton variante="secundario" className="w-full" onClick={() => enviar(`obras/${obraId}/ingresos`, { ingresos_proyectados: ing === "" ? null : Number(ing) }, "PUT")}>Guardar ingresos proyectados</Boton>
                </div>
              )}
              {porCat.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  <p className="text-sm font-bold text-tinta">Gastos por categoría</p>
                  {porCat.map(([c, v]) => <div key={c} className="flex justify-between text-sm"><span className="text-suave">{c}</span><span className="num font-semibold">{fmtMillones(v)}</span></div>)}
                </div>
              )}
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
