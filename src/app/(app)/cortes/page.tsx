"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Banknote, CalendarRange, CircleAlert, Download, HandCoins, Lock, LockOpen, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { useObras } from "@/lib/obras";
import { fechaCorta, fmtCOP, fmtNum } from "@/lib/format";
import { fechaLarga, hoy, sumarDias } from "@/lib/fechas";
import { descargarCSV } from "@/lib/csv";
import type { CorteT, FilaCorteT, PrestamoT } from "@/lib/types";
import { Aviso, Boton, BotonIcono, Campo, Chip, Esqueleto, Input, Modal, Segmentado, Select, Tabla, Tarjeta, Titulo, Vacio, useAviso, useConfirmar } from "@/components/ui";
import { Indicador, SelectorObra } from "@/components/comunes";

type Trabajador = { id: string; nombre: string; activo?: boolean };

/** Lunes de la semana de `f`, en texto ISO. */
function lunesDe(f: string): string {
  const d = new Date(`${f}T00:00:00`);
  return sumarDias(f, -((d.getDay() + 6) % 7));
}

function Pantalla() {
  const params = useSearchParams();
  const abrirId = params.get("abrir");
  const { me, tieneModulo } = useSession();
  const aviso = useAviso();
  const confirmar = useConfirmar();
  const { obras } = useObras();
  const [vista, setVista] = useState<"cortes" | "prestamos">("cortes");
  const [lista, setLista] = useState<CorteT[] | null>(null);
  const [abierto, setAbierto] = useState<CorteT | null>(null);
  const [prestamos, setPrestamos] = useState<{ prestamos: PrestamoT[]; saldo_total: number } | null>(null);
  const [personal, setPersonal] = useState<Trabajador[]>([]);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [nuevo, setNuevo] = useState<{ desde: string; hasta: string; obra_id: string; notas: string } | null>(null);
  const [nuevoP, setNuevoP] = useState<{ trabajador_id: string; fecha: string; concepto: string; valor: number; cuota: number } | null>(null);

  const puedeEscribir = !me.solo_lectura && me.licencia?.escritura && ["admin", "gerencia", "super_admin"].includes(me.rol);

  const cargar = useCallback(() => {
    api<{ cortes: CorteT[] }>("cortes").then((r) => setLista(r.cortes)).catch((e) => setError(e.message));
    api<{ prestamos: PrestamoT[]; saldo_total: number }>("prestamos").then(setPrestamos).catch(() => {});
    api<Trabajador[]>("personal").then((p) => setPersonal(p.filter((x) => x.activo !== false))).catch(() => {});
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  // Al llegar desde la prenómina con ?abrir=<id>, se entra directo a esa planilla
  useEffect(() => {
    if (abrirId) api<CorteT>(`cortes/${abrirId}`).then(setAbierto).catch(() => {});
  }, [abrirId]);

  const abrirCorte = async (id: string) => {
    try { setAbierto(await api<CorteT>(`cortes/${id}`)); }
    catch (e) { aviso(e instanceof Error ? e.message : "No se pudo abrir el corte", "error"); }
  };

  async function crear() {
    if (!nuevo) return;
    setOcupado(true);
    try {
      const c = await api<CorteT>("cortes", { method: "POST", body: nuevo });
      setNuevo(null); setAbierto(c); cargar();
      aviso(`Corte creado: ${c.totales.personas} personas por ${fmtCOP(c.totales.neto)}`);
    } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo crear el corte", "error"); } finally { setOcupado(false); }
  }

  async function guardarFilas(filas: FilaCorteT[], recalcular = false) {
    if (!abierto) return;
    setOcupado(true);
    try {
      const c = await api<CorteT>(`cortes/${abierto.id}`, { method: "PUT", body: {
        notas: abierto.notas, recalcular,
        filas: filas.map((f) => ({ id: f.id, prestamo: f.prestamo, otras: f.otras, nota: f.nota })),
      } });
      setAbierto(c); cargar();
      aviso(recalcular ? "Corte recalculado con la asistencia de hoy." : "Descuentos guardados.");
    } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo guardar", "error"); } finally { setOcupado(false); }
  }

  async function cambiarEstado(c: CorteT, accion: "cerrar" | "reabrir") {
    const ok = await confirmar(accion === "cerrar"
      ? { titulo: "¿Cerrar el corte?", texto: `Quedan congelados ${fmtCOP(c.totales.neto)} para ${c.totales.personas} personas y se abonan los préstamos descontados. Después, cambiar la asistencia ya no mueve estas cifras.`, aceptar: "Cerrar corte" }
      : { titulo: "¿Reabrir el corte?", texto: "Se deshacen los abonos a préstamos y el corte vuelve a quedar editable.", aceptar: "Reabrir", peligro: true });
    if (!ok) return;
    setOcupado(true);
    try { setAbierto(await api<CorteT>(`cortes/${c.id}/${accion}`, { method: "POST" })); cargar(); aviso(accion === "cerrar" ? "Corte cerrado." : "Corte reabierto."); }
    catch (x) { aviso(x instanceof Error ? x.message : "No se pudo", "error"); } finally { setOcupado(false); }
  }

  async function borrar(c: CorteT) {
    if (!(await confirmar({ titulo: "¿Eliminar el corte?", texto: "Se borra la liquidación guardada de ese periodo. La asistencia no se toca.", aceptar: "Eliminar", peligro: true }))) return;
    try { await api(`cortes/${c.id}`, { method: "DELETE" }); setAbierto(null); cargar(); aviso("Corte eliminado."); }
    catch (x) { aviso(x instanceof Error ? x.message : "No se pudo eliminar", "error"); }
  }

  async function crearPrestamo() {
    if (!nuevoP) return;
    setOcupado(true);
    try { await api("prestamos", { method: "POST", body: nuevoP }); setNuevoP(null); cargar(); aviso("Préstamo registrado."); }
    catch (x) { aviso(x instanceof Error ? x.message : "No se pudo registrar", "error"); } finally { setOcupado(false); }
  }

  async function cambiarPrestamo(p: PrestamoT, cambios: Partial<PrestamoT>) {
    try { await api(`prestamos/${p.id}`, { method: "PUT", body: { concepto: p.concepto, cuota: p.cuota, activo: p.activo, notas: p.notas, ...cambios } }); cargar(); }
    catch (x) { aviso(x instanceof Error ? x.message : "No se pudo guardar", "error"); }
  }

  async function borrarPrestamo(p: PrestamoT) {
    if (!(await confirmar({ titulo: `¿Borrar el préstamo de ${p.trabajador}?`, texto: `${p.concepto || "Sin concepto"} · ${fmtCOP(p.valor)}`, aceptar: "Borrar", peligro: true }))) return;
    try { await api(`prestamos/${p.id}`, { method: "DELETE" }); cargar(); aviso("Préstamo borrado."); }
    catch (x) { aviso(x instanceof Error ? x.message : "No se pudo borrar", "error"); }
  }

  const exportar = (c: CorteT) => descargarCSV(`corte-${c.desde}_${c.hasta}.csv`, [
    ["Cédula", "Nombre", "Cargo", "Forma de pago", "Días", "Descanso", "Devengado", "Auxilio", "Salud", "Pensión", "Préstamo", "Otros descuentos", "Neto", "Nota"],
    ...(c.filas ?? []).map((f) => [f.cedula, f.nombre, f.cargo, f.modalidad, f.dias_asistidos, f.dias_descanso,
      f.devengado, f.auxilio, f.salud, f.pension, f.prestamo, f.otras, f.neto, f.nota]),
  ]);

  if (!tieneModulo("pagos")) return <Aviso tono="alerta">Su licencia o su rol no permiten ver los pagos al personal.</Aviso>;
  if (error) return <Aviso tono="error">{error}</Aviso>;
  if (!lista) return <div aria-busy="true" aria-label="Cargando" className="space-y-4"><Esqueleto className="h-8 w-64" /><Esqueleto className="h-28" /><Esqueleto className="h-64" /></div>;

  // ---------- Detalle de un corte ----------
  if (abierto) {
    const c = abierto;
    const cerrado = c.estado === "cerrado";
    const filas = c.filas ?? [];
    const setFila = (i: number, cambios: Partial<FilaCorteT>) => setAbierto({ ...c, filas: filas.map((f, k) => {
      if (k !== i) return f;
      const n = { ...f, ...cambios };
      n.neto = Math.round((n.devengado + n.auxilio - n.salud - n.pension - n.prestamo - n.otras) * 100) / 100;
      return n;
    }) });
    return (
      <>
        <button type="button" onClick={() => setAbierto(null)} className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-marca-texto hover:underline"><ArrowLeft className="size-4" aria-hidden /> Cortes de pago</button>
        <Titulo sub={<span className="flex flex-wrap items-center gap-2">{c.obra} · {fechaLarga(c.desde)} a {fechaLarga(c.hasta)} ({c.dias} días)
          <Chip tono={cerrado ? "ok" : "alerta"} icono={cerrado ? <Lock className="size-3.5" aria-hidden /> : <LockOpen className="size-3.5" aria-hidden />}>{cerrado ? "Cerrado" : "Abierto"}</Chip></span>}
          acciones={<>
            <Boton variante="secundario" icono={<Download className="size-4" aria-hidden />} onClick={() => exportar(c)} disabled={!filas.length}>Planilla CSV</Boton>
            {puedeEscribir && !cerrado && <Boton variante="secundario" icono={<RefreshCw className="size-4" aria-hidden />} cargando={ocupado} onClick={() => guardarFilas(filas, true)}>Recalcular</Boton>}
            {puedeEscribir && (cerrado
              ? <Boton variante="secundario" icono={<LockOpen className="size-4" aria-hidden />} onClick={() => cambiarEstado(c, "reabrir")}>Reabrir</Boton>
              : <Boton icono={<Lock className="size-4" aria-hidden />} cargando={ocupado} onClick={() => cambiarEstado(c, "cerrar")} disabled={!filas.length}>Cerrar corte</Boton>)}
          </>}>
          Corte {fechaCorta(c.desde)} – {fechaCorta(c.hasta)}
        </Titulo>

        {(c.avisos ?? []).map((a) => <div key={a} className="mb-3"><Aviso tono="alerta">{a}</Aviso></div>)}
        {cerrado && <div className="mb-3"><Aviso tono="ok">Congelado por {c.cerrado_por} el {fechaCorta(c.cerrado_en ?? "")}. Aunque después se corrija la asistencia, estas cifras no cambian.</Aviso></div>}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador etiqueta="Neto a pagar" valor={fmtCOP(c.totales.neto)} detalle={`${c.totales.personas} personas`} icono={<Banknote className="size-5" aria-hidden />} />
          <Indicador etiqueta="Devengado" valor={fmtCOP(c.totales.devengado)} detalle={c.totales.auxilio ? `+ ${fmtCOP(c.totales.auxilio)} de auxilio` : undefined} />
          <Indicador etiqueta="Seguridad social" valor={fmtCOP(c.totales.salud + c.totales.pension)} detalle="Salud 4 % · Pensión 4 %" />
          <Indicador etiqueta="Descuentos" valor={fmtCOP(c.totales.prestamo + c.totales.otras)} detalle={`Préstamos ${fmtCOP(c.totales.prestamo)}`} tono={c.totales.prestamo + c.totales.otras ? "alerta" : undefined} icono={<HandCoins className="size-5" aria-hidden />} />
        </div>

        <Tarjeta className="mt-5" titulo="Planilla del corte" sub={cerrado ? "Tal como se pagó." : "Ajuste los descuentos y cierre el corte cuando esté conforme."}>
          {filas.length === 0 ? <Vacio icono={<Users className="size-6" aria-hidden />} titulo="No hay nadie en este periodo" texto="No se registró asistencia en esas fechas." /> : <>
            <div className="-mx-4 overflow-x-auto sm:mx-0"><table className="w-full min-w-[900px] text-sm">
              <thead><tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-suave">
                <th scope="col" className="px-2 py-2 font-semibold">Trabajador</th><th scope="col" className="px-2 py-2 text-right font-semibold">Días</th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">Devengado</th><th scope="col" className="px-2 py-2 text-right font-semibold">Salud + pensión</th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">Préstamo</th><th scope="col" className="px-2 py-2 text-right font-semibold">Otros</th>
                <th scope="col" className="px-2 py-2 font-semibold">Nota</th><th scope="col" className="px-2 py-2 text-right font-semibold">Neto</th></tr></thead>
              <tbody className="divide-y divide-borde">{filas.map((f, i) => (
                <tr key={f.id}>
                  <td className="px-2 py-2">
                    <span className="font-semibold text-tinta">{f.nombre}</span>
                    <span className="block text-xs text-suave">{f.cedula || "sin cédula"}{f.cargo ? ` · ${f.cargo}` : ""} · {f.modalidad}</span>
                  </td>
                  <td className="num px-2 py-2 text-right">{f.dias_asistidos}{f.dias_descanso ? <span className="text-suave"> + {f.dias_descanso}</span> : null}</td>
                  <td className="num px-2 py-2 text-right">{fmtCOP(f.devengado)}{f.auxilio ? <span className="block text-xs text-suave">+ {fmtCOP(f.auxilio)}</span> : null}</td>
                  <td className="num px-2 py-2 text-right text-suave">− {fmtCOP(f.salud + f.pension)}</td>
                  <td className="px-2 py-2 text-right">{cerrado ? <span className="num">{f.prestamo ? `− ${fmtCOP(f.prestamo)}` : "—"}</span>
                    : <Input aria-label={`Préstamo descontado a ${f.nombre}`} type="number" inputMode="decimal" min={0} className="num min-h-11 w-28 py-1 text-right text-sm pointer-fine:min-h-9" value={f.prestamo || ""} onChange={(e) => setFila(i, { prestamo: Number(e.target.value) })} />}</td>
                  <td className="px-2 py-2 text-right">{cerrado ? <span className="num">{f.otras ? `− ${fmtCOP(f.otras)}` : "—"}</span>
                    : <Input aria-label={`Otros descuentos de ${f.nombre}`} type="number" inputMode="decimal" min={0} className="num min-h-11 w-28 py-1 text-right text-sm pointer-fine:min-h-9" value={f.otras || ""} onChange={(e) => setFila(i, { otras: Number(e.target.value) })} />}</td>
                  <td className="px-2 py-2">{cerrado ? <span className="text-suave">{f.nota || "—"}</span>
                    : <Input aria-label={`Nota de ${f.nombre}`} maxLength={200} className="min-h-11 w-40 py-1 text-sm pointer-fine:min-h-9" value={f.nota} onChange={(e) => setFila(i, { nota: e.target.value })} />}</td>
                  <td className="num px-2 py-2 text-right font-bold">{fmtCOP(f.neto)}</td>
                </tr>))}</tbody>
              <tfoot><tr className="border-t-2 border-borde font-bold"><td className="px-2 py-2.5">Total</td><td /><td className="num px-2 py-2.5 text-right">{fmtCOP(c.totales.devengado + c.totales.auxilio)}</td>
                <td className="num px-2 py-2.5 text-right">− {fmtCOP(c.totales.salud + c.totales.pension)}</td><td className="num px-2 py-2.5 text-right">− {fmtCOP(c.totales.prestamo)}</td>
                <td className="num px-2 py-2.5 text-right">− {fmtCOP(c.totales.otras)}</td><td /><td className="num px-2 py-2.5 text-right">{fmtCOP(c.totales.neto)}</td></tr></tfoot>
            </table></div>
            {puedeEscribir && !cerrado && <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-suave">Los préstamos se abonan al cerrar el corte, no antes.</p>
              <Boton cargando={ocupado} onClick={() => guardarFilas(filas)}>Guardar descuentos</Boton>
            </div>}
          </>}
        </Tarjeta>

        <Tarjeta className="mt-5" titulo="Cómo se calculó" sub="El sustento de cada cifra, congelado con el corte">
          <div className="space-y-4">{filas.map((f) => (
            <details key={f.id} className="rounded-xl border border-borde p-3">
              <summary className="cursor-pointer text-sm font-semibold text-tinta">{f.nombre} · {fmtCOP(f.neto)}</summary>
              <div className="mt-3 space-y-2 text-sm">
                <p className="text-suave">{f.detalle.dias_jornal} día(s) por jornal de {fmtCOP(f.detalle.jornal)}{f.detalle.dias_destajo ? ` · ${f.detalle.dias_destajo} día(s) por ejecutado` : ""}
                  {f.detalle.descansos ? ` · descansos ${fmtCOP(f.detalle.descansos)} (promedio diario ${fmtCOP(f.detalle.promedio_diario)})` : ""}
                  {f.detalle.ajuste_minimo ? ` · ajuste al mínimo ${fmtCOP(f.detalle.ajuste_minimo)}` : ""}</p>
                {f.detalle.semanas.map((s) => (
                  <p key={s.domingo} className="flex flex-wrap items-center gap-2">
                    <Chip tono={s.reconocido ? "ok" : "alerta"}>Domingo {fechaCorta(s.domingo)}</Chip>
                    <span className="text-suave">{s.razon}</span>
                  </p>))}
                {f.detalle.trabajos.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-xs">
                  <thead><tr className="text-left text-suave"><th className="py-1 font-semibold">Fecha</th><th className="py-1 font-semibold">Actividad</th><th className="py-1 text-right font-semibold">Parte</th><th className="py-1 text-right font-semibold">Tarifa</th><th className="py-1 text-right font-semibold">Valor</th></tr></thead>
                  <tbody>{f.detalle.trabajos.map((x, k) => (
                    <tr key={`${x.fecha}-${k}`} className={x.pagado ? "" : "text-suave"}>
                      <td className="py-1">{fechaCorta(x.fecha)}</td><td className="py-1">{x.actividad}{x.ubicacion ? ` · ${x.ubicacion}` : ""}</td>
                      <td className="num py-1 text-right">{fmtNum(x.parte)} {x.um}</td><td className="num py-1 text-right">{x.tarifa ? fmtCOP(x.tarifa) : "—"}</td>
                      <td className="num py-1 text-right">{x.pagado ? fmtCOP(x.valor) : "no se paga por ejecutado"}</td>
                    </tr>))}</tbody></table></div>}
              </div>
            </details>))}
          </div>
        </Tarjeta>

        {puedeEscribir && !cerrado && <div className="mt-5"><Boton variante="secundario" icono={<Trash2 className="size-4" aria-hidden />} onClick={() => borrar(c)}>Eliminar este corte</Boton></div>}
      </>
    );
  }

  // ---------- Lista ----------
  const lunes = lunesDe(hoy());
  return (
    <>
      <Titulo sub="La liquidación de un periodo, guardada tal como se pagó. Sirve de planilla y ya no cambia si después se corrige la asistencia."
        acciones={<>
          <Link href="/pagos"><Boton variante="secundario" icono={<Banknote className="size-4" aria-hidden />}>Prenómina</Boton></Link>
          {puedeEscribir && vista === "cortes" && <Boton icono={<Plus className="size-4" aria-hidden />} onClick={() => setNuevo({ desde: sumarDias(lunes, -7), hasta: sumarDias(lunes, -1), obra_id: "", notas: "" })}>Nuevo corte</Boton>}
          {puedeEscribir && vista === "prestamos" && <Boton icono={<Plus className="size-4" aria-hidden />} onClick={() => setNuevoP({ trabajador_id: personal[0]?.id ?? "", fecha: hoy(), concepto: "", valor: 0, cuota: 0 })}>Nuevo préstamo</Boton>}
        </>}>
        Cortes de pago
      </Titulo>

      <Segmentado etiqueta="Vista" valor={vista} onChange={setVista} opciones={[{ valor: "cortes", texto: "Cortes" }, { valor: "prestamos", texto: `Préstamos${prestamos?.saldo_total ? ` · ${fmtCOP(prestamos.saldo_total)}` : ""}` }]} />

      {vista === "cortes" && <Tarjeta className="mt-4" titulo="Cortes guardados" sub="Del más reciente al más antiguo">
        {lista.length === 0 ? <Vacio icono={<CalendarRange className="size-6" aria-hidden />} titulo="Todavía no hay cortes"
          texto="Un corte toma la asistencia de un periodo, la liquida y la congela. Mientras tanto, la prenómina se sigue calculando en vivo." /> : (
          <Tabla cabeceras={["Periodo", "Obra", "Personas", "Neto", "Estado", ""]}>
            {lista.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-2.5">
                  <button type="button" onClick={() => abrirCorte(c.id)} className="whitespace-nowrap font-semibold text-marca-texto hover:underline">{fechaCorta(c.desde)} – {fechaCorta(c.hasta)}</button>
                  <span className="block text-xs text-suave">{c.dias} días{c.notas ? ` · ${c.notas}` : ""}</span>
                </td>
                <td className="px-3 py-2.5">{c.obra}</td>
                <td className="num px-3 py-2.5">{c.totales.personas ?? 0}</td>
                <td className="num px-3 py-2.5 font-semibold">{fmtCOP(c.totales.neto ?? 0)}</td>
                <td className="px-3 py-2.5"><Chip tono={c.estado === "cerrado" ? "ok" : "alerta"}>{c.estado === "cerrado" ? "Cerrado" : "Abierto"}</Chip></td>
                <td className="px-3 py-2.5 text-right"><Boton variante="secundario" tam="sm" onClick={() => abrirCorte(c.id)}>Ver planilla</Boton></td>
              </tr>))}
          </Tabla>)}
      </Tarjeta>}

      {vista === "prestamos" && <Tarjeta className="mt-4" titulo="Préstamos y deudas" sub="Se descuentan solos en cada corte, hasta saldar. Desactive uno para dejar de descontarlo.">
        {!prestamos?.prestamos.length ? <Vacio icono={<HandCoins className="size-6" aria-hidden />} titulo="Nadie debe nada" texto="Registre aquí los avances y préstamos para que se descuenten en los cortes." /> : (
          <Tabla cabeceras={["Trabajador", "Concepto", "Prestado", "Cuota", "Saldo", "Activo", ""]}>
            {prestamos.prestamos.map((p) => (
              <tr key={p.id} className={p.pagado ? "text-suave" : ""}>
                <td className="px-3 py-2.5"><span className="font-semibold text-tinta">{p.trabajador}</span><span className="block text-xs text-suave">{fechaCorta(p.fecha)}</span></td>
                <td className="px-3 py-2.5">{p.concepto || "—"}{p.notas && <span className="block text-xs text-suave">{p.notas}</span>}</td>
                <td className="num px-3 py-2.5">{fmtCOP(p.valor)}</td>
                <td className="num px-3 py-2.5">{p.cuota ? fmtCOP(p.cuota) : <span className="text-suave">todo lo que alcance</span>}</td>
                <td className="num px-3 py-2.5 font-semibold">{p.pagado ? <Chip tono="ok">Pagado</Chip> : fmtCOP(p.saldo)}</td>
                <td className="px-3 py-2.5">{puedeEscribir
                  ? <Boton variante="secundario" tam="sm" onClick={() => cambiarPrestamo(p, { activo: !p.activo })}>{p.activo ? "Sí" : "No"}</Boton>
                  : (p.activo ? "Sí" : "No")}</td>
                <td className="px-3 py-2.5 text-right">{puedeEscribir && <BotonIcono peligro etiqueta={`Borrar el préstamo de ${p.trabajador}`} onClick={() => borrarPrestamo(p)}><Trash2 className="size-4" aria-hidden /></BotonIcono>}</td>
              </tr>))}
          </Tabla>)}
      </Tarjeta>}

      <Modal abierto={nuevo !== null} onCerrar={() => setNuevo(null)} titulo="Nuevo corte de pago" sucio={!!nuevo}
        pie={<><Boton variante="secundario" onClick={() => setNuevo(null)}>Cancelar</Boton><Boton onClick={crear} cargando={ocupado} disabled={!nuevo?.desde || !nuevo?.hasta}>Crear corte</Boton></>}>
        {nuevo && <div className="space-y-4">
          <p className="text-sm text-suave">Se liquida la asistencia de esas fechas y el corte queda <strong>abierto</strong>: puede revisarlo y ajustar descuentos. Nada se congela ni se abona hasta que lo cierre.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Desde"><Input data-autofocus type="date" value={nuevo.desde} onChange={(e) => setNuevo({ ...nuevo, desde: e.target.value })} /></Campo>
            <Campo etiqueta="Hasta" ayuda="Termine en domingo para que el descanso de la semana entre en este corte."><Input type="date" value={nuevo.hasta} max={hoy()} onChange={(e) => setNuevo({ ...nuevo, hasta: e.target.value })} /></Campo>
          </div>
          <SelectorObra obras={obras} valor={nuevo.obra_id} onChange={(v) => setNuevo({ ...nuevo, obra_id: v })} todas />
          <p className="-mt-2 text-sm text-suave">Déjelo en todas las obras si paga a la gente junta, sin importar dónde trabajó.</p>
          <Campo etiqueta="Nota del corte"><Input maxLength={300} value={nuevo.notas} onChange={(e) => setNuevo({ ...nuevo, notas: e.target.value })} placeholder="ej. Semana 12 · pagado en efectivo" /></Campo>
        </div>}
      </Modal>

      <Modal abierto={nuevoP !== null} onCerrar={() => setNuevoP(null)} titulo="Nuevo préstamo" sucio={!!nuevoP}
        pie={<><Boton variante="secundario" onClick={() => setNuevoP(null)}>Cancelar</Boton><Boton onClick={crearPrestamo} cargando={ocupado} disabled={!nuevoP?.trabajador_id || !(nuevoP?.valor > 0)}>Registrar</Boton></>}>
        {nuevoP && <div className="space-y-4">
          <Campo etiqueta="Trabajador">
            <Select data-autofocus value={nuevoP.trabajador_id} onChange={(e) => setNuevoP({ ...nuevoP, trabajador_id: e.target.value })}>
              {personal.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </Select>
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Fecha"><Input type="date" value={nuevoP.fecha} max={hoy()} onChange={(e) => setNuevoP({ ...nuevoP, fecha: e.target.value })} /></Campo>
            <Campo etiqueta="Valor prestado"><Input type="number" inputMode="decimal" min={0} className="num" value={nuevoP.valor || ""} onChange={(e) => setNuevoP({ ...nuevoP, valor: Number(e.target.value) })} /></Campo>
          </div>
          <Campo etiqueta="Concepto"><Input maxLength={200} value={nuevoP.concepto} onChange={(e) => setNuevoP({ ...nuevoP, concepto: e.target.value })} placeholder="ej. Avance para herramienta" /></Campo>
          <Campo etiqueta="Cuota por corte" ayuda="Déjela en cero para descontar todo lo que alcance en cada corte.">
            <Input type="number" inputMode="decimal" min={0} className="num" value={nuevoP.cuota || ""} onChange={(e) => setNuevoP({ ...nuevoP, cuota: Number(e.target.value) })} />
          </Campo>
          {nuevoP.valor > 0 && nuevoP.cuota > 0 && <p className="flex items-center gap-1.5 text-sm text-suave"><CircleAlert className="size-4 shrink-0" aria-hidden /> Se salda en {Math.ceil(nuevoP.valor / nuevoP.cuota)} cortes.</p>}
        </div>}
      </Modal>
    </>
  );
}

export default function Cortes() {
  return <Suspense><Pantalla /></Suspense>;
}
