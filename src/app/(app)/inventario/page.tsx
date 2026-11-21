"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { fechaCorta, fmtCOP, fmtNum } from "@/lib/format";
import { hoy } from "@/lib/fechas";
import { Aviso, Boton, Campo, Input, Insignia, Modal, Select, Tabla, Tarjeta, Titulo, Vacio, useAviso } from "@/components/ui";

type Obra = { id: string; nombre: string };
type Mat = { id: string; nombre: string; unidad: string; categoria: string; stock_minimo: number; activo: boolean; stock: number; por_obra: { obra_id: string; stock: number }[]; costo_promedio: number; valor: number; bajo_minimo: boolean; obras_bajo_minimo: string[] };
type Mov = { id: string; material_id: string; obra_id: string; fecha: string; tipo: string; cantidad: number; costo_unitario: number; actividad_id: string; referencia: string; detalle: string; registrado_por: string };
type Consumo = { actividad: string; material: string; unidad: string; cantidad: number; valor: number };
type Act = { id: string; nombre: string; ubicacion: string };
type Kardex = { material: Mat; saldo: number; movimientos: (Mov & { saldo: number })[] };
const TIPO_TONO = { entrada: "verde", salida: "rojo", ajuste: "ambar", traslado: "azul" } as const;

export default function Inventario() {
  const { me } = useSession();
  const aviso = useAviso();
  const [obras, setObras] = useState<Obra[]>([]);
  const [obraId, setObraId] = useState("");
  const [vista, setVista] = useState<"materiales" | "movimientos" | "consumos">("materiales");
  const [mats, setMats] = useState<Mat[]>([]);
  const [movs, setMovs] = useState<Mov[]>([]);
  const [cons, setCons] = useState<Consumo[]>([]);
  const [acts, setActs] = useState<Act[]>([]);
  const [error, setError] = useState("");
  const [fm, setFm] = useState<{ id?: string; nombre: string; unidad: string; categoria: string; stock_minimo: string; activo: boolean } | null>(null);
  const [mv, setMv] = useState<{ material: Mat; tipo: "entrada" | "salida" | "ajuste"; obra_id: string; fecha: string; cantidad: string; costo_unitario: string; actividad_id: string; referencia: string; detalle: string } | null>(null);
  const [tr, setTr] = useState<{ material: Mat; origen: string; destino: string; fecha: string; cantidad: string; detalle: string } | null>(null);
  const [kx, setKx] = useState<Kardex | null>(null);
  const puede = !me.solo_lectura && me.licencia?.escritura;

  const q = obraId ? `?obra_id=${obraId}` : "";
  const cargar = useCallback(() => {
    api<Mat[]>(`inventario/materiales${q}`).then(setMats).catch((e) => setError(e.message));
    api<Mov[]>(`inventario/movimientos${q}`).then(setMovs).catch(() => {});
    if (obraId) api<Consumo[]>(`inventario/consumos?obra_id=${obraId}`).then(setCons).catch(() => setCons([]));
  }, [q, obraId]);
  useEffect(() => { api<Obra[]>("obras").then(setObras).catch((e) => setError(e.message)); }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const o = mv?.obra_id; if (!o) return;
    api<{ actividades: Act[] }>(`obras/${o}/contrato`).then((r) => setActs(r.actividades)).catch(() => setActs([]));
  }, [mv?.obra_id]);

  const nombreMat = (id: string) => mats.find((m) => m.id === id)?.nombre ?? "—";
  const nombreObra = (id: string) => obras.find((o) => o.id === id)?.nombre ?? "—";
  const bajos = mats.filter((m) => m.activo && m.bajo_minimo).length;

  async function guardarMat() {
    if (!fm) return;
    try {
      const body = { nombre: fm.nombre, unidad: fm.unidad, categoria: fm.categoria, stock_minimo: Number(fm.stock_minimo) || 0, activo: fm.activo };
      await api(fm.id ? `inventario/materiales/${fm.id}` : "inventario/materiales", { method: fm.id ? "PATCH" : "POST", body });
      setFm(null); aviso("Material guardado"); cargar();
    } catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); }
  }
  async function guardarMov() {
    if (!mv) return;
    try {
      await api("inventario/movimientos", { method: "POST", body: { material_id: mv.material.id, obra_id: mv.obra_id, fecha: mv.fecha, tipo: mv.tipo, cantidad: Number(mv.cantidad), costo_unitario: Number(mv.costo_unitario) || 0, actividad_id: mv.tipo === "salida" ? mv.actividad_id : "", referencia: mv.referencia, detalle: mv.detalle } });
      setMv(null); aviso("Movimiento registrado"); cargar();
    } catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); }
  }
  async function guardarTr() {
    if (!tr) return;
    try {
      await api("inventario/traslados", { method: "POST", body: { material_id: tr.material.id, obra_origen_id: tr.origen, obra_destino_id: tr.destino, fecha: tr.fecha, cantidad: Number(tr.cantidad), detalle: tr.detalle } });
      setTr(null); aviso("Traslado registrado"); cargar();
    } catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); }
  }
  const nuevoMov = (m: Mat, tipo: "entrada" | "salida" | "ajuste") => setMv({ material: m, tipo, obra_id: obraId || obras[0]?.id || "", fecha: hoy(), cantidad: "", costo_unitario: "", actividad_id: "", referencia: "", detalle: "" });

  return (
    <>
      <Titulo sub="Materiales por obra, kardex, traslados y consumo por actividad" acciones={puede && <Boton onClick={() => setFm({ nombre: "", unidad: "UND", categoria: "", stock_minimo: "0", activo: true })}>Nuevo material</Boton>}>Inventario y bodega</Titulo>
      <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
        <Campo etiqueta="Bodega (obra)"><Select value={obraId} onChange={(e) => setObraId(e.target.value)}><option value="">Todas las obras</option>{obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Select></Campo>
      </div>
      {error && <div className="mt-3"><Aviso tono="error">{error}</Aviso></div>}
      {bajos > 0 && <div className="mt-3"><Aviso tono="alerta">{bajos} material(es) en o por debajo del stock mínimo.</Aviso></div>}
      <div className="mt-4 flex flex-wrap gap-2">
        {(["materiales", "movimientos", "consumos"] as const).map((v) => <Boton key={v} variante={vista === v ? "primario" : "secundario"} onClick={() => setVista(v)}>{v === "materiales" ? "Materiales" : v === "movimientos" ? "Movimientos" : "Consumo por actividad"}</Boton>)}
      </div>

      {vista === "materiales" && (
        <div className="mt-4">{!mats.length ? <Vacio>Aún no hay materiales. Cree el primero con «Nuevo material».</Vacio> : (
          <Tarjeta><Tabla cabeceras={["Material", "Stock", "Mínimo", "Costo prom.", "Valor", ""]}>
            {mats.map((m) => (
              <tr key={m.id} className={m.activo ? "" : "opacity-50"}>
                <td className="px-3 py-2"><div className="font-medium">{m.nombre}</div><div className="text-xs text-slate-500">{m.categoria || "Sin categoría"}{!m.activo && " · desactivado"}</div></td>
                <td className="px-3 py-2">{fmtNum(m.stock)} {m.unidad} {m.bajo_minimo && <Insignia tono="rojo">Bajo mínimo</Insignia>}</td>
                <td className="px-3 py-2">{m.stock_minimo ? fmtNum(m.stock_minimo) : "—"}</td><td className="px-3 py-2">{m.costo_promedio ? fmtCOP(m.costo_promedio) : "—"}</td><td className="px-3 py-2">{fmtCOP(m.valor)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {puede && m.activo && <><Boton variante="secundario" className="!min-h-9" onClick={() => nuevoMov(m, "entrada")}>Entrada</Boton> <Boton variante="secundario" className="!min-h-9" onClick={() => nuevoMov(m, "salida")}>Salida</Boton> </>}
                  {puede && m.activo && obras.length > 1 && <Boton variante="fantasma" className="!min-h-9" onClick={() => setTr({ material: m, origen: obraId || obras[0].id, destino: obras.find((o) => o.id !== (obraId || obras[0].id))?.id ?? "", fecha: hoy(), cantidad: "", detalle: "" })}>Trasladar</Boton>}
                  {puede && m.activo && <Boton variante="fantasma" className="!min-h-9" onClick={() => nuevoMov(m, "ajuste")}>Ajustar</Boton>}
                  <Boton variante="fantasma" className="!min-h-9" onClick={async () => { const o = obraId || m.por_obra[0]?.obra_id; if (!o) { aviso("Aún no tiene movimientos", "error"); return; } setKx(await api<Kardex>(`inventario/kardex?material_id=${m.id}&obra_id=${o}`)); }}>Kardex</Boton>
                  {puede && <Boton variante="fantasma" className="!min-h-9" onClick={() => setFm({ id: m.id, nombre: m.nombre, unidad: m.unidad, categoria: m.categoria, stock_minimo: String(m.stock_minimo), activo: m.activo })}>Editar</Boton>}
                </td>
              </tr>
            ))}
          </Tabla></Tarjeta>
        )}</div>
      )}

      {vista === "movimientos" && (
        <div className="mt-4">{!movs.length ? <Vacio>Sin movimientos.</Vacio> : (
          <Tarjeta><Tabla cabeceras={["Fecha", "Material", "Obra", "Tipo", "Cantidad", "Detalle"]}>
            {movs.map((x) => (
              <tr key={x.id}><td className="px-3 py-2">{fechaCorta(x.fecha)}</td><td className="px-3 py-2">{nombreMat(x.material_id)}</td><td className="px-3 py-2">{nombreObra(x.obra_id)}</td>
                <td className="px-3 py-2"><Insignia tono={TIPO_TONO[x.tipo as keyof typeof TIPO_TONO] ?? "gris"}>{x.tipo}</Insignia></td>
                <td className={`px-3 py-2 ${x.cantidad < 0 ? "text-red-700" : "text-emerald-700"}`}>{x.cantidad > 0 ? "+" : ""}{fmtNum(x.cantidad)}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{[x.referencia, x.detalle, x.registrado_por].filter(Boolean).join(" · ")}</td></tr>
            ))}
          </Tabla></Tarjeta>
        )}</div>
      )}

      {vista === "consumos" && (
        <div className="mt-4">{!obraId ? <Vacio>Elija una obra para ver el consumo por actividad.</Vacio> : !cons.length ? <Vacio>No hay salidas ligadas a actividades en esta obra.</Vacio> : (
          <Tarjeta><Tabla cabeceras={["Actividad", "Material", "Cantidad", "Valor"]}>
            {cons.map((c, i) => <tr key={i}><td className="px-3 py-2">{c.actividad}</td><td className="px-3 py-2">{c.material}</td><td className="px-3 py-2">{fmtNum(c.cantidad)} {c.unidad}</td><td className="px-3 py-2">{fmtCOP(c.valor)}</td></tr>)}
          </Tabla></Tarjeta>
        )}</div>
      )}

      <Modal abierto={!!fm} titulo={fm?.id ? "Editar material" : "Nuevo material"} onCerrar={() => setFm(null)}>
        {fm && <div className="grid gap-3">
          <Campo etiqueta="Nombre"><Input value={fm.nombre} onChange={(e) => setFm({ ...fm, nombre: e.target.value })} /></Campo>
          <div className="grid grid-cols-2 gap-3"><Campo etiqueta="Unidad"><Input value={fm.unidad} maxLength={12} onChange={(e) => setFm({ ...fm, unidad: e.target.value })} /></Campo>
            <Campo etiqueta="Stock mínimo"><Input type="number" min={0} value={fm.stock_minimo} onChange={(e) => setFm({ ...fm, stock_minimo: e.target.value })} /></Campo></div>
          <Campo etiqueta="Categoría"><Input value={fm.categoria} onChange={(e) => setFm({ ...fm, categoria: e.target.value })} /></Campo>
          {fm.id && <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="size-5" checked={fm.activo} onChange={(e) => setFm({ ...fm, activo: e.target.checked })} />Activo</label>}
          <Boton onClick={guardarMat} disabled={!fm.nombre.trim()}>Guardar</Boton>
        </div>}
      </Modal>
      <Modal abierto={!!mv} titulo={mv ? `${mv.tipo === "entrada" ? "Entrada" : mv.tipo === "salida" ? "Salida" : "Ajuste"} · ${mv.material.nombre}` : ""} onCerrar={() => setMv(null)}>
        {mv && <div className="grid gap-3">
          <Campo etiqueta="Obra (bodega)"><Select value={mv.obra_id} onChange={(e) => setMv({ ...mv, obra_id: e.target.value })}>{obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Select></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Fecha"><Input type="date" max={hoy()} value={mv.fecha} onChange={(e) => setMv({ ...mv, fecha: e.target.value })} /></Campo>
            <Campo etiqueta={`Cantidad (${mv.material.unidad})`} ayuda={mv.tipo === "ajuste" ? "Positivo suma, negativo resta" : undefined}><Input type="number" step="any" value={mv.cantidad} onChange={(e) => setMv({ ...mv, cantidad: e.target.value })} /></Campo>
          </div>
          {mv.tipo === "entrada" && <Campo etiqueta="Costo unitario (COP)"><Input type="number" min={0} value={mv.costo_unitario} onChange={(e) => setMv({ ...mv, costo_unitario: e.target.value })} /></Campo>}
          {mv.tipo === "salida" && <Campo etiqueta="Actividad que lo consume" ayuda="Opcional; alimenta el consumo por actividad"><Select value={mv.actividad_id} onChange={(e) => setMv({ ...mv, actividad_id: e.target.value })}><option value="">Sin actividad</option>{acts.map((a) => <option key={a.id} value={a.id}>{a.nombre}{a.ubicacion ? ` · ${a.ubicacion}` : ""}</option>)}</Select></Campo>}
          <Campo etiqueta="Referencia / detalle"><Input value={mv.detalle} onChange={(e) => setMv({ ...mv, detalle: e.target.value })} /></Campo>
          <Boton onClick={guardarMov} disabled={!Number(mv.cantidad)}>Registrar</Boton>
        </div>}
      </Modal>
      <Modal abierto={!!tr} titulo={tr ? `Trasladar · ${tr.material.nombre}` : ""} onCerrar={() => setTr(null)}>
        {tr && <div className="grid gap-3">
          <Campo etiqueta="Desde"><Select value={tr.origen} onChange={(e) => setTr({ ...tr, origen: e.target.value })}>{obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Select></Campo>
          <Campo etiqueta="Hacia"><Select value={tr.destino} onChange={(e) => setTr({ ...tr, destino: e.target.value })}>{obras.filter((o) => o.id !== tr.origen).map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Select></Campo>
          <div className="grid grid-cols-2 gap-3"><Campo etiqueta="Fecha"><Input type="date" max={hoy()} value={tr.fecha} onChange={(e) => setTr({ ...tr, fecha: e.target.value })} /></Campo>
            <Campo etiqueta={`Cantidad (${tr.material.unidad})`}><Input type="number" min={0} step="any" value={tr.cantidad} onChange={(e) => setTr({ ...tr, cantidad: e.target.value })} /></Campo></div>
          <Boton onClick={guardarTr} disabled={!Number(tr.cantidad) || !tr.destino}>Trasladar</Boton>
        </div>}
      </Modal>
      <Modal abierto={!!kx} titulo={kx ? `Kardex · ${kx.material.nombre}` : ""} onCerrar={() => setKx(null)}>
        {kx && <div className="space-y-2"><p className="text-sm">Saldo actual: <strong>{fmtNum(kx.saldo)} {kx.material.unidad}</strong></p>
          <Tabla cabeceras={["Fecha", "Tipo", "Cantidad", "Saldo"]}>{kx.movimientos.map((x) => <tr key={x.id}><td className="px-3 py-2">{fechaCorta(x.fecha)}</td><td className="px-3 py-2">{x.tipo}</td><td className="px-3 py-2">{x.cantidad > 0 ? "+" : ""}{fmtNum(x.cantidad)}</td><td className="px-3 py-2">{fmtNum(x.saldo)}</td></tr>)}</Tabla></div>}
      </Modal>
    </>
  );
}
