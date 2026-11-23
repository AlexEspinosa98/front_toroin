"use client";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeftRight, ArrowUpFromLine, ArrowDownToLine, BookOpen, Boxes, Package, PackagePlus, Pencil, SlidersHorizontal, TriangleAlert, Wallet } from "lucide-react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { useObras } from "@/lib/obras";
import { fechaCorta, fmtCOP, fmtMillones, fmtNum } from "@/lib/format";
import { hoy } from "@/lib/fechas";
import { Aviso, Boton, BotonIcono, Campo, Chip, Esqueleto, Input, Modal, Segmentado, Select, Tabla, Titulo, Vacio, enfocarPrimerError, useAviso, type Tono } from "@/components/ui";
import { Indicador, SelectorObra } from "@/components/comunes";

type Mat = { id: string; nombre: string; unidad: string; categoria: string; stock_minimo: number; activo: boolean; stock: number; por_obra: { obra_id: string; stock: number }[]; costo_promedio: number; valor: number; bajo_minimo: boolean; obras_bajo_minimo: string[] };
type Mov = { id: string; material_id: string; obra_id: string; fecha: string; tipo: string; cantidad: number; costo_unitario: number; actividad_id: string; referencia: string; detalle: string; registrado_por: string };
type Consumo = { actividad: string; material: string; unidad: string; cantidad: number; valor: number };
type Act = { id: string; nombre: string; ubicacion: string };
type Kardex = { material: Mat; saldo: number; movimientos: (Mov & { saldo: number })[] };
type Vista = "materiales" | "movimientos" | "consumos";
type FormMat = { id?: string; nombre: string; unidad: string; categoria: string; stock_minimo: string; activo: boolean };
type FormMov = { material: Mat; tipo: "entrada" | "salida" | "ajuste"; obra_id: string; fecha: string; cantidad: string; costo_unitario: string; actividad_id: string; referencia: string; detalle: string };
type FormTr = { material: Mat; origen: string; destino: string; fecha: string; cantidad: string; detalle: string };
const TIPO_TONO: Record<string, Tono> = { entrada: "ok", salida: "error", ajuste: "alerta", traslado: "info" };

export default function Inventario() {
  const { me } = useSession();
  const aviso = useAviso();
  const { obras, cargando, obraId, setObraId, error: errObras } = useObras({ todas: true });
  const [vista, setVista] = useState<Vista>("materiales");
  const [mats, setMats] = useState<Mat[] | null>(null);
  const [movs, setMovs] = useState<Mov[]>([]);
  const [cons, setCons] = useState<Consumo[]>([]);
  const [acts, setActs] = useState<Act[]>([]);
  const [error, setError] = useState("");
  const [fm, setFm] = useState<FormMat | null>(null);
  const [mv, setMv] = useState<FormMov | null>(null);
  const [tr, setTr] = useState<FormTr | null>(null);
  const [kx, setKx] = useState<Kardex | null>(null);
  const [intento, setIntento] = useState(false);
  const puede = !me.solo_lectura && me.licencia?.escritura;

  const q = obraId ? `?obra_id=${obraId}` : "";
  const cargar = useCallback(() => {
    api<Mat[]>(`inventario/materiales${q}`).then((m) => { setMats(m); setError(""); }).catch((e) => setError(e.message));
    api<Mov[]>(`inventario/movimientos${q}`).then(setMovs).catch(() => {});
    if (obraId) api<Consumo[]>(`inventario/consumos?obra_id=${obraId}`).then(setCons).catch(() => setCons([]));
  }, [q, obraId]);
  useEffect(() => { cargar(); }, [cargar]);
  const obraMov = mv?.obra_id;
  useEffect(() => {
    if (!obraMov) return;
    let vivo = true;
    api<{ actividades: Act[] }>(`obras/${obraMov}/contrato`).then((r) => vivo && setActs(r.actividades)).catch(() => vivo && setActs([]));
    return () => { vivo = false; };
  }, [obraMov]);

  const lista = mats ?? [];
  const nombreMat = (id: string) => lista.find((m) => m.id === id)?.nombre ?? "—";
  const nombreObra = (id: string) => obras.find((o) => o.id === id)?.nombre ?? "—";
  const activos = lista.filter((m) => m.activo);
  const bajos = activos.filter((m) => m.bajo_minimo).length;
  const valorTotal = activos.reduce((s, m) => s + m.valor, 0);

  const nuevoMat = () => { setIntento(false); setFm({ nombre: "", unidad: "UND", categoria: "", stock_minimo: "0", activo: true }); };
  const nuevoMov = (m: Mat, tipo: FormMov["tipo"]) => { setIntento(false); setMv({ material: m, tipo, obra_id: obraId || obras[0]?.id || "", fecha: hoy(), cantidad: "", costo_unitario: "", actividad_id: "", referencia: "", detalle: "" }); };
  const nuevoTr = (m: Mat) => { setIntento(false); const o = obraId || obras[0]?.id || ""; setTr({ material: m, origen: o, destino: obras.find((x) => x.id !== o)?.id ?? "", fecha: hoy(), cantidad: "", detalle: "" }); };
  async function verKardex(m: Mat) {
    const o = obraId || m.por_obra[0]?.obra_id;
    if (!o) return aviso("Este material aún no tiene movimientos", "error");
    try { setKx(await api<Kardex>(`inventario/kardex?material_id=${m.id}&obra_id=${o}`)); } catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); }
  }

  const errNombre = fm && !fm.nombre.trim() ? "Escriba el nombre" : undefined;
  const errCant = mv && !Number(mv.cantidad) ? "Digite una cantidad" : mv && mv.tipo !== "ajuste" && Number(mv.cantidad) < 0 ? "Debe ser mayor que cero" : undefined;
  const errTr = tr && (!(Number(tr.cantidad) > 0) ? "Digite una cantidad" : !tr.destino ? "Elija la obra destino" : undefined);

  async function guardarMat(e: React.FormEvent) {
    e.preventDefault();
    if (!fm) return;
    setIntento(true);
    if (errNombre) return enfocarPrimerError(document.querySelector("dialog[open]"));
    try {
      const body = { nombre: fm.nombre.trim(), unidad: fm.unidad, categoria: fm.categoria, stock_minimo: Number(fm.stock_minimo) || 0, activo: fm.activo };
      await api(fm.id ? `inventario/materiales/${fm.id}` : "inventario/materiales", { method: fm.id ? "PATCH" : "POST", body });
      setFm(null); aviso("Material guardado"); cargar();
    } catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); }
  }
  async function guardarMov(e: React.FormEvent) {
    e.preventDefault();
    if (!mv) return;
    setIntento(true);
    if (errCant) return enfocarPrimerError(document.querySelector("dialog[open]"));
    try {
      await api("inventario/movimientos", { method: "POST", body: { material_id: mv.material.id, obra_id: mv.obra_id, fecha: mv.fecha, tipo: mv.tipo, cantidad: Number(mv.cantidad), costo_unitario: Number(mv.costo_unitario) || 0, actividad_id: mv.tipo === "salida" ? mv.actividad_id : "", referencia: mv.referencia, detalle: mv.detalle } });
      setMv(null); aviso("Movimiento registrado"); cargar();
    } catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); }
  }
  async function guardarTr(e: React.FormEvent) {
    e.preventDefault();
    if (!tr) return;
    setIntento(true);
    if (errTr) return enfocarPrimerError(document.querySelector("dialog[open]"));
    try {
      await api("inventario/traslados", { method: "POST", body: { material_id: tr.material.id, obra_origen_id: tr.origen, obra_destino_id: tr.destino, fecha: tr.fecha, cantidad: Number(tr.cantidad), detalle: tr.detalle } });
      setTr(null); aviso("Traslado registrado"); cargar();
    } catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); }
  }

  const tituloMov = mv ? `${mv.tipo === "entrada" ? "Entrada" : mv.tipo === "salida" ? "Salida" : "Ajuste"} · ${mv.material.nombre}` : "";

  return (
    <>
      <Titulo sub="Materiales por obra, kardex, traslados y consumo por actividad"
        acciones={puede && <Boton icono={<PackagePlus className="size-4" aria-hidden />} onClick={nuevoMat}>Nuevo material</Boton>}>Inventario y bodega</Titulo>

      <SelectorObra className="mb-5 max-w-sm" obras={obras} valor={obraId} onChange={setObraId} todas />
      {(error || errObras) && <Aviso tono="error">{error || errObras}</Aviso>}
      {mats === null && !error && !cargando && <div className="space-y-3"><div className="grid grid-cols-3 gap-3">{[0, 1, 2].map((i) => <Esqueleto key={i} className="h-28" />)}</div><Esqueleto className="h-64" /></div>}

      {mats !== null && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Indicador etiqueta="Materiales activos" valor={activos.length} icono={<Boxes className="size-5" aria-hidden />} />
            <Indicador etiqueta="Valor en bodega" valor={fmtMillones(valorTotal)} detalle="A costo promedio" icono={<Wallet className="size-5" aria-hidden />} />
            <Indicador etiqueta="Bajo el mínimo" valor={bajos} tono={bajos ? "alerta" : "ok"} detalle={bajos ? "Conviene reponer" : "Todo en orden"} icono={<TriangleAlert className="size-5" aria-hidden />} />
          </div>

          <div className="mb-4 mt-5">
            <Segmentado<Vista> etiqueta="Vista del inventario" valor={vista} onChange={setVista}
              opciones={[{ valor: "materiales", texto: "Materiales" }, { valor: "movimientos", texto: "Movimientos" }, { valor: "consumos", texto: "Consumo por actividad" }]} />
          </div>

          {vista === "materiales" && (!lista.length ? (
            <Vacio icono={<Package className="size-6" aria-hidden />} titulo="Aún no hay materiales" texto="Cree los materiales de su bodega para controlar entradas, salidas y costos."
              accion={puede ? <Boton icono={<PackagePlus className="size-4" aria-hidden />} onClick={nuevoMat}>Nuevo material</Boton> : undefined} />
          ) : (
            <Tabla cabeceras={["Material", "Stock", "Mínimo", "Costo prom.", "Valor", ""]}>
              {lista.map((m) => (
                <tr key={m.id} className={m.activo ? "" : "opacity-50"}>
                  <td className="px-3 py-2.5"><div className="font-semibold">{m.nombre}</div><div className="text-xs text-suave">{m.categoria || "Sin categoría"}{!m.activo && " · desactivado"}</div></td>
                  <td className="num px-3 py-2.5"><span className="font-semibold">{fmtNum(m.stock)}</span> <span className="text-suave">{m.unidad}</span> {m.bajo_minimo && <Chip tono="error">Bajo mínimo</Chip>}</td>
                  <td className="num px-3 py-2.5">{m.stock_minimo ? fmtNum(m.stock_minimo) : "—"}</td>
                  <td className="num px-3 py-2.5">{m.costo_promedio ? fmtCOP(m.costo_promedio) : "—"}</td>
                  <td className="num px-3 py-2.5">{fmtCOP(m.valor)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    {puede && m.activo && <Boton variante="secundario" tam="sm" icono={<ArrowDownToLine className="size-4" aria-hidden />} onClick={() => nuevoMov(m, "entrada")}>Entrada</Boton>}{" "}
                    {puede && m.activo && <Boton variante="secundario" tam="sm" icono={<ArrowUpFromLine className="size-4" aria-hidden />} onClick={() => nuevoMov(m, "salida")}>Salida</Boton>}
                    {puede && m.activo && obras.length > 1 && <BotonIcono etiqueta={`Trasladar ${m.nombre}`} onClick={() => nuevoTr(m)}><ArrowLeftRight className="size-4" aria-hidden /></BotonIcono>}
                    {puede && m.activo && <BotonIcono etiqueta={`Ajustar ${m.nombre}`} onClick={() => nuevoMov(m, "ajuste")}><SlidersHorizontal className="size-4" aria-hidden /></BotonIcono>}
                    <BotonIcono etiqueta={`Kardex de ${m.nombre}`} onClick={() => verKardex(m)}><BookOpen className="size-4" aria-hidden /></BotonIcono>
                    {puede && <BotonIcono etiqueta={`Editar ${m.nombre}`} onClick={() => { setIntento(false); setFm({ id: m.id, nombre: m.nombre, unidad: m.unidad, categoria: m.categoria, stock_minimo: String(m.stock_minimo), activo: m.activo }); }}><Pencil className="size-4" aria-hidden /></BotonIcono>}
                  </td>
                </tr>
              ))}
            </Tabla>
          ))}

          {vista === "movimientos" && (!movs.length ? (
            <Vacio icono={<ArrowLeftRight className="size-6" aria-hidden />} titulo="Sin movimientos" texto="Las entradas, salidas y traslados aparecerán aquí." />
          ) : (
            <Tabla cabeceras={["Fecha", "Material", "Obra", "Tipo", "Cantidad", "Detalle"]}>
              {movs.map((x) => (
                <tr key={x.id}>
                  <td className="px-3 py-2.5">{fechaCorta(x.fecha)}</td><td className="px-3 py-2.5 font-semibold">{nombreMat(x.material_id)}</td><td className="px-3 py-2.5">{nombreObra(x.obra_id)}</td>
                  <td className="px-3 py-2.5"><Chip tono={TIPO_TONO[x.tipo] ?? "neutro"}>{x.tipo}</Chip></td>
                  <td className={`num px-3 py-2.5 font-semibold ${x.cantidad < 0 ? "text-error" : "text-ok"}`}>{x.cantidad > 0 ? "+" : ""}{fmtNum(x.cantidad)}</td>
                  <td className="px-3 py-2.5 text-xs text-suave">{[x.referencia, x.detalle, x.registrado_por].filter(Boolean).join(" · ")}</td>
                </tr>
              ))}
            </Tabla>
          ))}

          {vista === "consumos" && (!obraId ? (
            <Vacio icono={<Package className="size-6" aria-hidden />} titulo="Elija una obra" texto="El consumo por actividad se calcula obra por obra." />
          ) : !cons.length ? (
            <Vacio icono={<Package className="size-6" aria-hidden />} titulo="Sin consumos ligados a actividades" texto="Al registrar una salida, elija la actividad que consume el material." />
          ) : (
            <Tabla cabeceras={["Actividad", "Material", "Cantidad", "Valor"]}>
              {cons.map((c, i) => <tr key={i}><td className="px-3 py-2.5 font-semibold">{c.actividad}</td><td className="px-3 py-2.5">{c.material}</td><td className="num px-3 py-2.5">{fmtNum(c.cantidad)} {c.unidad}</td><td className="num px-3 py-2.5">{fmtCOP(c.valor)}</td></tr>)}
            </Tabla>
          ))}
        </>
      )}

      <Modal abierto={!!fm} onCerrar={() => setFm(null)} sucio={!!fm?.nombre} titulo={fm?.id ? "Editar material" : "Nuevo material"}
        pie={<><Boton type="button" variante="secundario" onClick={() => setFm(null)}>Cancelar</Boton><Boton type="submit" form="form-material">Guardar</Boton></>}>
        {fm && (
          <form id="form-material" onSubmit={guardarMat} className="space-y-4" noValidate>
            <Campo etiqueta="Nombre" error={intento ? errNombre : undefined}><Input data-autofocus value={fm.nombre} onChange={(e) => setFm({ ...fm, nombre: e.target.value })} /></Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Unidad"><Input value={fm.unidad} maxLength={12} onChange={(e) => setFm({ ...fm, unidad: e.target.value })} /></Campo>
              <Campo etiqueta="Stock mínimo"><Input type="number" min={0} inputMode="decimal" className="num" value={fm.stock_minimo} onChange={(e) => setFm({ ...fm, stock_minimo: e.target.value })} /></Campo>
            </div>
            <Campo etiqueta="Categoría"><Input value={fm.categoria} onChange={(e) => setFm({ ...fm, categoria: e.target.value })} /></Campo>
            {fm.id && <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" className="size-5" checked={fm.activo} onChange={(e) => setFm({ ...fm, activo: e.target.checked })} />Material activo</label>}
          </form>
        )}
      </Modal>

      <Modal abierto={!!mv} onCerrar={() => setMv(null)} sucio={!!mv?.cantidad} titulo={tituloMov}
        pie={<><Boton type="button" variante="secundario" onClick={() => setMv(null)}>Cancelar</Boton><Boton type="submit" form="form-movimiento-inv">Registrar</Boton></>}>
        {mv && (
          <form id="form-movimiento-inv" onSubmit={guardarMov} className="space-y-4" noValidate>
            <Campo etiqueta="Obra (bodega)"><Select value={mv.obra_id} onChange={(e) => setMv({ ...mv, obra_id: e.target.value })}>{obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Select></Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Fecha"><Input type="date" max={hoy()} value={mv.fecha} onChange={(e) => setMv({ ...mv, fecha: e.target.value })} /></Campo>
              <Campo etiqueta={`Cantidad (${mv.material.unidad})`} error={intento ? errCant : undefined} ayuda={mv.tipo === "ajuste" ? "Positivo suma, negativo resta" : undefined}>
                <Input data-autofocus type="number" step="any" inputMode="decimal" className="num" value={mv.cantidad} onChange={(e) => setMv({ ...mv, cantidad: e.target.value })} />
              </Campo>
            </div>
            {mv.tipo === "entrada" && <Campo etiqueta="Costo unitario (COP)" ayuda={Number(mv.costo_unitario) > 0 ? fmtCOP(Number(mv.costo_unitario)) : undefined}><Input type="number" min={0} inputMode="numeric" className="num" value={mv.costo_unitario} onChange={(e) => setMv({ ...mv, costo_unitario: e.target.value })} /></Campo>}
            {mv.tipo === "salida" && (
              <Campo etiqueta="Actividad que lo consume" ayuda="Opcional; alimenta el consumo por actividad">
                <Select value={mv.actividad_id} onChange={(e) => setMv({ ...mv, actividad_id: e.target.value })}><option value="">Sin actividad</option>{acts.map((a) => <option key={a.id} value={a.id}>{a.nombre}{a.ubicacion ? ` · ${a.ubicacion}` : ""}</option>)}</Select>
              </Campo>
            )}
            <Campo etiqueta="Referencia / detalle"><Input value={mv.detalle} onChange={(e) => setMv({ ...mv, detalle: e.target.value })} /></Campo>
          </form>
        )}
      </Modal>

      <Modal abierto={!!tr} onCerrar={() => setTr(null)} sucio={!!tr?.cantidad} titulo={tr ? `Trasladar · ${tr.material.nombre}` : ""}
        pie={<><Boton type="button" variante="secundario" onClick={() => setTr(null)}>Cancelar</Boton><Boton type="submit" form="form-traslado">Trasladar</Boton></>}>
        {tr && (
          <form id="form-traslado" onSubmit={guardarTr} className="space-y-4" noValidate>
            <Campo etiqueta="Desde"><Select value={tr.origen} onChange={(e) => setTr({ ...tr, origen: e.target.value, destino: tr.destino === e.target.value ? "" : tr.destino })}>{obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Select></Campo>
            <Campo etiqueta="Hacia" error={intento && !tr.destino ? "Elija la obra destino" : undefined}><Select value={tr.destino} onChange={(e) => setTr({ ...tr, destino: e.target.value })}><option value="">Seleccione…</option>{obras.filter((o) => o.id !== tr.origen).map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Select></Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Fecha"><Input type="date" max={hoy()} value={tr.fecha} onChange={(e) => setTr({ ...tr, fecha: e.target.value })} /></Campo>
              <Campo etiqueta={`Cantidad (${tr.material.unidad})`} error={intento && !(Number(tr.cantidad) > 0) ? "Digite una cantidad" : undefined}><Input data-autofocus type="number" min={0} step="any" inputMode="decimal" className="num" value={tr.cantidad} onChange={(e) => setTr({ ...tr, cantidad: e.target.value })} /></Campo>
            </div>
          </form>
        )}
      </Modal>

      <Modal abierto={!!kx} onCerrar={() => setKx(null)} titulo={kx ? `Kardex · ${kx.material.nombre}` : ""}>
        {kx && (
          <div className="space-y-3">
            <p className="text-sm text-suave">Saldo actual: <strong className="num text-tinta">{fmtNum(kx.saldo)} {kx.material.unidad}</strong></p>
            <Tabla cabeceras={["Fecha", "Tipo", "Cantidad", "Saldo"]}>
              {kx.movimientos.map((x) => (
                <tr key={x.id}>
                  <td className="px-3 py-2.5">{fechaCorta(x.fecha)}</td>
                  <td className="px-3 py-2.5"><Chip tono={TIPO_TONO[x.tipo] ?? "neutro"}>{x.tipo}</Chip></td>
                  <td className={`num px-3 py-2.5 font-semibold ${x.cantidad < 0 ? "text-error" : "text-ok"}`}>{x.cantidad > 0 ? "+" : ""}{fmtNum(x.cantidad)}</td>
                  <td className="num px-3 py-2.5">{fmtNum(x.saldo)}</td>
                </tr>
              ))}
            </Tabla>
          </div>
        )}
      </Modal>
    </>
  );
}
