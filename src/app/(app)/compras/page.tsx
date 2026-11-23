"use client";
import { useCallback, useEffect, useState } from "react";
import { Ban, Check, ClipboardList, FileText, PackageCheck, Pencil, Plus, Printer, Send, ShoppingCart, Trash2, Truck, TriangleAlert, Users, Wallet, X } from "lucide-react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { useObras } from "@/lib/obras";
import { fechaCorta, fmtCOP, fmtNum } from "@/lib/format";
import { hoy } from "@/lib/fechas";
import { Aviso, Boton, BotonIcono, Campo, Chip, Esqueleto, Input, Modal, Segmentado, Select, Tabla, Tarjeta, Titulo, Vacio, enfocarPrimerError, useAviso, useConfirmar, type Tono } from "@/components/ui";
import { Indicador } from "@/components/comunes";

type Mat = { id: string; nombre: string; unidad: string; activo: boolean };
type Prov = { id: string; nombre: string; nit: string; contacto: string; telefono: string; correo: string; direccion: string; activo: boolean };
type ItemReq = { material_id: string; descripcion: string; unidad: string; cantidad: number };
type Req = { id: string; etiqueta: string; obra: string; obra_id: string; fecha: string; solicitante: string; estado: string; items: ItemReq[]; observaciones: string };
type ItemOC = ItemReq & { precio_unitario: number; recibido: number };
type OC = { id: string; etiqueta: string; obra: string; obra_id: string; proveedor: string; proveedor_id: string; proveedor_nit: string; requisicion_id: string; fecha: string; fecha_entrega: string | null; estado: string; items: ItemOC[]; iva_pct: number;
  condiciones: string; observaciones: string; subtotal: number; iva: number; total: number; pendiente: number; vencida: boolean };
type Resumen = { requisiciones_pendientes: number; requisiciones_por_ordenar: number; ordenes_abiertas: number; por_recibir: number; ordenes_vencidas: number };
type Vista = "requisiciones" | "ordenes" | "proveedores";
type LineaReq = { material_id: string; descripcion: string; unidad: string; cantidad: string };
type LineaOC = LineaReq & { precio: string };
type FormReq = { obra_id: string; observaciones: string; items: LineaReq[] };
type FormOC = { obra_id: string; proveedor_id: string; fecha: string; fecha_entrega: string; iva_pct: string; condiciones: string; items: LineaOC[] };
type FormProv = Omit<Prov, "id"> & { id?: string };
const TONO: Record<string, Tono> = { Solicitada: "alerta", Aprobada: "info", Rechazada: "error", Ordenada: "ok", Borrador: "neutro", Emitida: "info", Parcial: "alerta", Recibida: "ok", Cancelada: "error" };
const lineaReq = (): LineaReq => ({ material_id: "", descripcion: "", unidad: "UND", cantidad: "" });
const lineaOC = (): LineaOC => ({ ...lineaReq(), precio: "" });
const lineaValida = (i: LineaReq) => Number(i.cantidad) > 0 && (!!i.material_id || !!i.descripcion.trim());

export default function Compras() {
  const { me } = useSession();
  const aviso = useAviso();
  const confirmar = useConfirmar();
  const { obras } = useObras({ todas: true });
  const [vista, setVista] = useState<Vista>("requisiciones");
  const [mats, setMats] = useState<Mat[]>([]);
  const [provs, setProvs] = useState<Prov[]>([]);
  const [reqs, setReqs] = useState<Req[] | null>(null);
  const [ocs, setOcs] = useState<OC[]>([]);
  const [res, setRes] = useState<Resumen | null>(null);
  const [error, setError] = useState("");
  const [nr, setNr] = useState<FormReq | null>(null);
  const [aOrden, setAOrden] = useState<{ req: Req; proveedor_id: string } | null>(null);
  const [fp, setFp] = useState<FormProv | null>(null);
  const [oc, setOc] = useState<OC | null>(null);
  const [precios, setPrecios] = useState<string[]>([]);
  const [rec, setRec] = useState<{ fecha: string; cant: string[] } | null>(null);
  const [no, setNo] = useState<FormOC | null>(null);
  const [intento, setIntento] = useState(false);
  const puede = !me.solo_lectura && me.licencia?.escritura;

  const cargar = useCallback(() => {
    api<Req[]>("compras/requisiciones").then((r) => { setReqs(r); setError(""); }).catch((e) => setError(e.message));
    api<OC[]>("compras/ordenes").then(setOcs).catch(() => {});
    api<Prov[]>("compras/proveedores").then(setProvs).catch(() => {});
    api<Resumen>("compras/resumen").then(setRes).catch(() => {});
  }, []);
  useEffect(() => {
    cargar();
    api<Mat[]>("inventario/materiales").then((m) => setMats(m.filter((x) => x.activo))).catch(() => {});
  }, [cargar]);

  const run = async (f: () => Promise<unknown>, ok: string) => { try { await f(); aviso(ok); cargar(); return true; } catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); return false; } };
  const abrirOC = (o: OC) => { setOc(o); setPrecios(o.items.map((i) => String(i.precio_unitario))); setRec(null); };
  async function refrescarOC(id: string) { const o = await api<OC>(`compras/ordenes/${id}`); abrirOC(o); cargar(); }
  const itemReq = (i: LineaReq) => ({ material_id: i.material_id, descripcion: i.descripcion, unidad: i.unidad, cantidad: Number(i.cantidad) });
  const provsActivos = provs.filter((p) => p.activo);

  const abrirNr = () => { setIntento(false); setNr({ obra_id: obras[0]?.id ?? "", observaciones: "", items: [lineaReq()] }); };
  const abrirNo = () => { setIntento(false); setNo({ obra_id: obras[0]?.id ?? "", proveedor_id: provsActivos[0]?.id ?? "", fecha: hoy(), fecha_entrega: "", iva_pct: "19", condiciones: "", items: [lineaOC()] }); };
  const abrirFp = (p?: Prov) => { setIntento(false); setFp(p ?? { nombre: "", nit: "", contacto: "", telefono: "", correo: "", direccion: "", activo: true }); };

  async function enviarReq(e: React.FormEvent) {
    e.preventDefault();
    if (!nr) return;
    setIntento(true);
    if (!nr.obra_id || nr.items.some((i) => !lineaValida(i))) return enfocarPrimerError(document.querySelector("dialog[open]"));
    if (await run(() => api("compras/requisiciones", { method: "POST", body: { obra_id: nr.obra_id, observaciones: nr.observaciones, items: nr.items.map(itemReq) } }), "Requisición enviada")) setNr(null);
  }
  async function crearOC(e: React.FormEvent) {
    e.preventDefault();
    if (!no) return;
    setIntento(true);
    if (!no.obra_id || !no.proveedor_id || no.items.some((i) => !lineaValida(i))) return enfocarPrimerError(document.querySelector("dialog[open]"));
    if (await run(() => api("compras/ordenes", { method: "POST", body: { obra_id: no.obra_id, proveedor_id: no.proveedor_id, fecha: no.fecha, fecha_entrega: no.fecha_entrega || null, iva_pct: Number(no.iva_pct) || 0, condiciones: no.condiciones,
      items: no.items.map((i) => ({ ...itemReq(i), precio_unitario: Number(i.precio) || 0 })) } }), "Orden creada")) setNo(null);
  }
  async function guardarProv(e: React.FormEvent) {
    e.preventDefault();
    if (!fp) return;
    setIntento(true);
    if (!fp.nombre.trim()) return enfocarPrimerError(document.querySelector("dialog[open]"));
    const { id, ...body } = fp;
    if (await run(() => api(id ? `compras/proveedores/${id}` : "compras/proveedores", { method: id ? "PATCH" : "POST", body }), "Proveedor guardado")) setFp(null);
  }
  async function aOrdenCrear(e: React.FormEvent) {
    e.preventDefault();
    if (!aOrden?.proveedor_id) return;
    try { const o = await api<OC>(`compras/requisiciones/${aOrden.req.id}/orden?proveedor_id=${aOrden.proveedor_id}`, { method: "POST" }); setAOrden(null); cargar(); setVista("ordenes"); abrirOC(o); aviso("Orden creada en borrador"); }
    catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); }
  }
  async function cancelarOC(o: OC) {
    if (!(await confirmar({ titulo: "¿Cancelar la orden?", texto: `${o.etiqueta} · ${o.proveedor}`, aceptar: "Cancelar orden", peligro: true }))) return;
    if (await run(() => api(`compras/ordenes/${o.id}`, { method: "PATCH", body: { estado: "Cancelada" } }), "Orden cancelada")) await refrescarOC(o.id);
  }

  /** Líneas de ítems compartidas por requisición y orden */
  const renderLinea = <T extends LineaReq>(it: T, i: number, items: T[], onItems: (x: T[]) => void, conPrecio?: boolean) => {
    const cambia = (c: Partial<LineaOC>) => onItems(items.map((x, k) => (k === i ? { ...x, ...c } : x)));
    const sinCant = intento && !(Number(it.cantidad) > 0);
    const sinDesc = intento && !it.material_id && !it.descripcion.trim();
    return (
      <div key={i} className={`grid gap-2 rounded-xl border border-borde bg-tarjeta p-3 ${conPrecio ? "sm:grid-cols-[1fr_5.5rem_7.5rem_auto]" : "sm:grid-cols-[1fr_6rem_auto]"}`}>
        <div className="grid gap-2">
          <Select aria-label="Material" value={it.material_id} onChange={(e) => { const m = mats.find((x) => x.id === e.target.value); cambia({ material_id: e.target.value, unidad: m?.unidad ?? it.unidad }); }}>
            <option value="">Otro (escribir descripción)</option>{mats.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </Select>
          {!it.material_id && <Input aria-label="Descripción" aria-invalid={sinDesc} placeholder="Descripción" value={it.descripcion} onChange={(e) => cambia({ descripcion: e.target.value })} />}
          {sinDesc && <p className="text-sm text-error">Elija un material o escriba la descripción</p>}
        </div>
        <Input aria-label="Cantidad" aria-invalid={sinCant} type="number" min={0} step="any" inputMode="decimal" className="num" placeholder="Cant." value={it.cantidad} onChange={(e) => cambia({ cantidad: e.target.value })} />
        {conPrecio && <Input aria-label="Precio unitario" type="number" min={0} inputMode="numeric" className="num" placeholder="Precio" value={(it as unknown as LineaOC).precio} onChange={(e) => cambia({ precio: e.target.value })} />}
        <BotonIcono peligro etiqueta="Quitar ítem" disabled={items.length === 1} onClick={() => onItems(items.filter((_, k) => k !== i))}><Trash2 className="size-4" aria-hidden /></BotonIcono>
      </div>
    );
  }

  const botonNuevo = puede && (
    vista === "requisiciones" ? <Boton icono={<Plus className="size-4" aria-hidden />} onClick={abrirNr} disabled={!obras.length}>Nueva requisición</Boton>
    : vista === "ordenes" ? <Boton icono={<Plus className="size-4" aria-hidden />} onClick={abrirNo} disabled={!obras.length || !provsActivos.length}>Nueva orden</Boton>
    : <Boton icono={<Plus className="size-4" aria-hidden />} onClick={() => abrirFp()}>Nuevo proveedor</Boton>
  );

  return (
    <>
      <Titulo sub="Requisiciones de obra, órdenes de compra y recepción de mercancía" acciones={botonNuevo}>Compras y proveedores</Titulo>
      {error && <Aviso tono="error">{error}</Aviso>}
      {!res && !error && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Esqueleto key={i} className="h-28" />)}</div>}
      {res && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador etiqueta="Requisiciones por resolver" valor={res.requisiciones_pendientes} tono={res.requisiciones_pendientes ? "alerta" : "ok"} detalle={res.requisiciones_por_ordenar ? `${res.requisiciones_por_ordenar} aprobadas sin orden` : undefined} icono={<ClipboardList className="size-5" aria-hidden />} />
          <Indicador etiqueta="Órdenes abiertas" valor={res.ordenes_abiertas} icono={<ShoppingCart className="size-5" aria-hidden />} />
          <Indicador etiqueta="Por recibir" valor={fmtCOP(res.por_recibir)} icono={<Wallet className="size-5" aria-hidden />} />
          <Indicador etiqueta="Entregas vencidas" valor={res.ordenes_vencidas} tono={res.ordenes_vencidas ? "error" : "ok"} icono={<TriangleAlert className="size-5" aria-hidden />} />
        </div>
      )}
      <div className="mb-4 mt-5">
        <Segmentado<Vista> etiqueta="Vista de compras" valor={vista} onChange={setVista}
          opciones={[{ valor: "requisiciones", texto: "Requisiciones" }, { valor: "ordenes", texto: "Órdenes de compra" }, { valor: "proveedores", texto: "Proveedores" }]} />
      </div>

      {vista === "requisiciones" && (reqs === null ? <Esqueleto className="h-40" /> : !reqs.length ? (
        <Vacio icono={<ClipboardList className="size-6" aria-hidden />} titulo="No hay requisiciones" texto="El residente pide aquí lo que la obra necesita; luego se aprueba y se convierte en orden de compra."
          accion={puede && obras.length ? <Boton icono={<Plus className="size-4" aria-hidden />} onClick={abrirNr}>Nueva requisición</Boton> : undefined} />
      ) : (
        <div className="grid gap-3">{reqs.map((r) => (
          <Tarjeta key={r.id}>
            <div className="flex flex-wrap items-center gap-2"><strong>{r.etiqueta}</strong><Chip tono={TONO[r.estado] ?? "neutro"}>{r.estado}</Chip><span className="text-sm text-suave">{r.obra} · {fechaCorta(r.fecha)} · {r.solicitante}</span></div>
            <ul className="mt-2 space-y-0.5 text-sm">{r.items.map((i, k) => <li key={k}><span className="num font-semibold">{fmtNum(i.cantidad)} {i.unidad}</span> · {i.descripcion}</li>)}</ul>
            {r.observaciones && <p className="mt-1 text-sm text-suave">{r.observaciones}</p>}
            {puede && (r.estado === "Solicitada" || r.estado === "Aprobada") && (
              <div className="mt-3 flex flex-wrap gap-2">
                {r.estado === "Solicitada" && (
                  <>
                    <Boton variante="secundario" tam="sm" icono={<Check className="size-4" aria-hidden />} onClick={() => run(() => api(`compras/requisiciones/${r.id}`, { method: "PATCH", body: { estado: "Aprobada" } }), "Requisición aprobada")}>Aprobar</Boton>
                    <Boton variante="fantasma" tam="sm" icono={<X className="size-4" aria-hidden />} onClick={() => run(() => api(`compras/requisiciones/${r.id}`, { method: "PATCH", body: { estado: "Rechazada" } }), "Requisición rechazada")}>Rechazar</Boton>
                  </>
                )}
                {r.estado === "Aprobada" && <Boton tam="sm" icono={<FileText className="size-4" aria-hidden />} onClick={() => setAOrden({ req: r, proveedor_id: provsActivos[0]?.id ?? "" })}>Generar orden de compra</Boton>}
              </div>
            )}
          </Tarjeta>
        ))}</div>
      ))}

      {vista === "ordenes" && (!ocs.length ? (
        <Vacio icono={<ShoppingCart className="size-6" aria-hidden />} titulo="No hay órdenes de compra" texto="Apruebe una requisición para generar la orden, o cree una directamente."
          accion={puede && obras.length && provsActivos.length ? <Boton icono={<Plus className="size-4" aria-hidden />} onClick={abrirNo}>Nueva orden</Boton> : undefined} />
      ) : (
        <Tabla cabeceras={["Orden", "Proveedor", "Obra", "Entrega", "Total", "Estado"]}>
          {ocs.map((o) => (
            <tr key={o.id} className="cursor-pointer" onClick={() => abrirOC(o)}>
              <td className="px-3 py-2.5 font-semibold">
                <button type="button" className="text-left font-semibold underline-offset-2 hover:underline" onClick={(e) => { e.stopPropagation(); abrirOC(o); }}>{o.etiqueta}</button>
                <div className="text-xs font-normal text-suave">{fechaCorta(o.fecha)}</div>
              </td>
              <td className="px-3 py-2.5">{o.proveedor}</td><td className="px-3 py-2.5">{o.obra}</td>
              <td className="px-3 py-2.5">{o.fecha_entrega ? fechaCorta(o.fecha_entrega) : "—"} {o.vencida && <Chip tono="error">Vencida</Chip>}</td>
              <td className="num px-3 py-2.5 font-semibold">{fmtCOP(o.total)}</td>
              <td className="px-3 py-2.5"><Chip tono={TONO[o.estado] ?? "neutro"}>{o.estado}</Chip></td>
            </tr>
          ))}
        </Tabla>
      ))}

      {vista === "proveedores" && (!provs.length ? (
        <Vacio icono={<Users className="size-6" aria-hidden />} titulo="No hay proveedores registrados" texto="Registre a quién le compra para poder emitir órdenes."
          accion={puede ? <Boton icono={<Plus className="size-4" aria-hidden />} onClick={() => abrirFp()}>Nuevo proveedor</Boton> : undefined} />
      ) : (
        <Tabla cabeceras={["Proveedor", "NIT", "Contacto", "Teléfono", ""]}>
          {provs.map((p) => (
            <tr key={p.id} className={p.activo ? "" : "opacity-50"}>
              <td className="px-3 py-2.5 font-semibold">{p.nombre}{!p.activo && <span className="ml-2 text-xs font-normal text-suave">inactivo</span>}</td>
              <td className="num px-3 py-2.5">{p.nit || "—"}</td><td className="px-3 py-2.5">{p.contacto || p.correo || "—"}</td><td className="num px-3 py-2.5">{p.telefono || "—"}</td>
              <td className="px-3 py-2.5 text-right">{puede && <BotonIcono etiqueta={`Editar ${p.nombre}`} onClick={() => abrirFp(p)}><Pencil className="size-4" aria-hidden /></BotonIcono>}</td>
            </tr>
          ))}
        </Tabla>
      ))}

      {/* Nueva requisición */}
      <Modal abierto={!!nr} onCerrar={() => setNr(null)} sucio={!!nr?.items.some((i) => i.cantidad || i.descripcion)} titulo="Nueva requisición"
        pie={<><Boton type="button" variante="secundario" onClick={() => setNr(null)}>Cancelar</Boton><Boton type="submit" form="form-req">Enviar requisición</Boton></>}>
        {nr && (
          <form id="form-req" onSubmit={enviarReq} className="space-y-3" noValidate>
            <Campo etiqueta="Obra"><Select value={nr.obra_id} onChange={(e) => setNr({ ...nr, obra_id: e.target.value })}>{obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Select></Campo>
            {nr.items.map((it, i) => renderLinea(it, i, nr.items, (items) => setNr({ ...nr, items })))}
            <Boton type="button" variante="secundario" icono={<Plus className="size-4" aria-hidden />} onClick={() => setNr({ ...nr, items: [...nr.items, lineaReq()] })}>Agregar ítem</Boton>
            <Campo etiqueta="Observaciones"><Input value={nr.observaciones} onChange={(e) => setNr({ ...nr, observaciones: e.target.value })} /></Campo>
          </form>
        )}
      </Modal>

      {/* Requisición → orden */}
      <Modal abierto={!!aOrden} onCerrar={() => setAOrden(null)} titulo={aOrden ? `Orden desde ${aOrden.req.etiqueta}` : ""}
        pie={<><Boton type="button" variante="secundario" onClick={() => setAOrden(null)}>Cancelar</Boton><Boton type="submit" form="form-a-orden" disabled={!aOrden?.proveedor_id}>Crear orden</Boton></>}>
        {aOrden && (
          <form id="form-a-orden" onSubmit={aOrdenCrear} className="space-y-3">
            <Campo etiqueta="Proveedor" ayuda="Se crea en borrador; ahí pone los precios y la emite.">
              <Select value={aOrden.proveedor_id} onChange={(e) => setAOrden({ ...aOrden, proveedor_id: e.target.value })}>{provsActivos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</Select>
            </Campo>
            {!provsActivos.length && <Aviso tono="alerta">Primero registre un proveedor en la pestaña Proveedores.</Aviso>}
          </form>
        )}
      </Modal>

      {/* Proveedor */}
      <Modal abierto={!!fp} onCerrar={() => setFp(null)} sucio={!!fp?.nombre} titulo={fp?.id ? "Editar proveedor" : "Nuevo proveedor"}
        pie={<><Boton type="button" variante="secundario" onClick={() => setFp(null)}>Cancelar</Boton><Boton type="submit" form="form-prov">Guardar</Boton></>}>
        {fp && (
          <form id="form-prov" onSubmit={guardarProv} className="space-y-4" noValidate>
            <Campo etiqueta="Nombre" error={intento && !fp.nombre.trim() ? "Escriba el nombre" : undefined}><Input data-autofocus value={fp.nombre} onChange={(e) => setFp({ ...fp, nombre: e.target.value })} /></Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="NIT"><Input value={fp.nit} onChange={(e) => setFp({ ...fp, nit: e.target.value })} /></Campo>
              <Campo etiqueta="Teléfono"><Input type="tel" inputMode="tel" value={fp.telefono} onChange={(e) => setFp({ ...fp, telefono: e.target.value })} /></Campo>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Contacto"><Input value={fp.contacto} onChange={(e) => setFp({ ...fp, contacto: e.target.value })} /></Campo>
              <Campo etiqueta="Correo"><Input type="email" value={fp.correo} onChange={(e) => setFp({ ...fp, correo: e.target.value })} /></Campo>
            </div>
            <Campo etiqueta="Dirección"><Input value={fp.direccion} onChange={(e) => setFp({ ...fp, direccion: e.target.value })} /></Campo>
            {fp.id && <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" className="size-5" checked={fp.activo} onChange={(e) => setFp({ ...fp, activo: e.target.checked })} />Proveedor activo</label>}
          </form>
        )}
      </Modal>

      {/* Nueva orden manual */}
      <Modal abierto={!!no} onCerrar={() => setNo(null)} sucio={!!no?.items.some((i) => i.cantidad || i.descripcion)} titulo="Nueva orden de compra"
        pie={<><Boton type="button" variante="secundario" onClick={() => setNo(null)}>Cancelar</Boton><Boton type="submit" form="form-oc">Crear orden</Boton></>}>
        {no && (
          <form id="form-oc" onSubmit={crearOC} className="space-y-3" noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Obra"><Select value={no.obra_id} onChange={(e) => setNo({ ...no, obra_id: e.target.value })}>{obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Select></Campo>
              <Campo etiqueta="Proveedor"><Select value={no.proveedor_id} onChange={(e) => setNo({ ...no, proveedor_id: e.target.value })}>{provsActivos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</Select></Campo>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Campo etiqueta="Fecha"><Input type="date" value={no.fecha} onChange={(e) => setNo({ ...no, fecha: e.target.value })} /></Campo>
              <Campo etiqueta="Entrega"><Input type="date" min={no.fecha} value={no.fecha_entrega} onChange={(e) => setNo({ ...no, fecha_entrega: e.target.value })} /></Campo>
              <Campo etiqueta="IVA %"><Input type="number" min={0} inputMode="decimal" className="num" value={no.iva_pct} onChange={(e) => setNo({ ...no, iva_pct: e.target.value })} /></Campo>
            </div>
            {no.items.map((it, i) => renderLinea(it, i, no.items, (items) => setNo({ ...no, items }), true))}
            <Boton type="button" variante="secundario" icono={<Plus className="size-4" aria-hidden />} onClick={() => setNo({ ...no, items: [...no.items, lineaOC()] })}>Agregar ítem</Boton>
            <Campo etiqueta="Condiciones de pago / entrega"><Input value={no.condiciones} onChange={(e) => setNo({ ...no, condiciones: e.target.value })} /></Campo>
          </form>
        )}
      </Modal>

      {/* Detalle de la orden */}
      <Modal abierto={!!oc} onCerrar={() => { setOc(null); setRec(null); }} titulo={oc ? `${oc.etiqueta} · ${oc.proveedor}` : ""}>
        {oc && (
          <div className="space-y-3" id="orden-imprimible">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Chip tono={TONO[oc.estado] ?? "neutro"}>{oc.estado}</Chip><span className="font-semibold">{oc.obra}</span>
              <span className="text-suave">{fechaCorta(oc.fecha)}{oc.fecha_entrega ? ` · entrega ${fechaCorta(oc.fecha_entrega)}` : ""}</span>
              {oc.vencida && <Chip tono="error" icono={<Truck className="size-3.5" aria-hidden />}>Entrega vencida</Chip>}
            </div>
            <Tabla cabeceras={["Ítem", "Cant.", "Precio", rec ? "Recibir ahora" : "Recibido"]}>
              {oc.items.map((i, k) => (
                <tr key={k}>
                  <td className="px-3 py-2.5">{i.descripcion}</td>
                  <td className="num px-3 py-2.5">{fmtNum(i.cantidad)} {i.unidad}</td>
                  <td className="num px-3 py-2.5">{oc.estado === "Borrador" && puede ? <Input aria-label={`Precio de ${i.descripcion}`} type="number" min={0} inputMode="numeric" className="num !min-h-9 w-28" value={precios[k] ?? ""} onChange={(e) => setPrecios(precios.map((p, j) => (j === k ? e.target.value : p)))} /> : fmtCOP(i.precio_unitario)}</td>
                  <td className="num px-3 py-2.5">{rec ? <Input aria-label={`Cantidad recibida de ${i.descripcion}`} type="number" min={0} max={i.cantidad - i.recibido} step="any" inputMode="decimal" className="num !min-h-9 w-28" placeholder={`máx ${fmtNum(i.cantidad - i.recibido)}`} value={rec.cant[k] ?? ""} onChange={(e) => setRec({ ...rec, cant: rec.cant.map((c, j) => (j === k ? e.target.value : c)) })} /> : fmtNum(i.recibido)}</td>
                </tr>
              ))}
            </Tabla>
            <dl className="ml-auto max-w-xs space-y-1 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-suave">Subtotal</dt><dd className="num">{fmtCOP(oc.subtotal)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-suave">IVA {oc.iva_pct}%</dt><dd className="num">{fmtCOP(oc.iva)}</dd></div>
              <div className="flex justify-between gap-4 border-t border-borde pt-1"><dt className="font-semibold">Total</dt><dd className="num font-extrabold">{fmtCOP(oc.total)}</dd></div>
            </dl>
            {oc.condiciones && <p className="text-sm text-suave">Condiciones: {oc.condiciones}</p>}
            {rec && <Campo etiqueta="Fecha de recepción"><Input type="date" max={hoy()} value={rec.fecha} onChange={(e) => setRec({ ...rec, fecha: e.target.value })} /></Campo>}
            <div className="no-imprimir flex flex-wrap justify-end gap-2 pt-1">
              {puede && oc.estado === "Borrador" && <Boton variante="secundario" onClick={async () => {
                if (await run(() => api(`compras/ordenes/${oc.id}`, { method: "PUT", body: { obra_id: oc.obra_id, proveedor_id: oc.proveedor_id, requisicion_id: oc.requisicion_id, fecha: oc.fecha, fecha_entrega: oc.fecha_entrega, iva_pct: oc.iva_pct, condiciones: oc.condiciones, observaciones: oc.observaciones,
                  items: oc.items.map((i, k) => ({ material_id: i.material_id, descripcion: i.descripcion, unidad: i.unidad, cantidad: i.cantidad, precio_unitario: Number(precios[k]) || 0 })) } }), "Precios guardados")) await refrescarOC(oc.id); }}>Guardar precios</Boton>}
              {puede && oc.estado === "Borrador" && <Boton icono={<Send className="size-4" aria-hidden />} onClick={async () => { if (await run(() => api(`compras/ordenes/${oc.id}`, { method: "PATCH", body: { estado: "Emitida" } }), "Orden emitida")) await refrescarOC(oc.id); }}>Emitir orden</Boton>}
              {puede && ["Emitida", "Parcial"].includes(oc.estado) && !rec && <Boton icono={<PackageCheck className="size-4" aria-hidden />} onClick={() => setRec({ fecha: hoy(), cant: oc.items.map(() => "") })}>Recibir mercancía</Boton>}
              {rec && <Boton icono={<PackageCheck className="size-4" aria-hidden />} disabled={!rec.cant.some((c) => Number(c) > 0)} onClick={async () => {
                if (await run(() => api(`compras/ordenes/${oc.id}/recibir`, { method: "POST", body: { fecha: rec.fecha, items: rec.cant.map((c, k) => ({ indice: k, cantidad: Number(c) })).filter((x) => x.cantidad > 0) } }), "Recepción registrada: entró al inventario y a los gastos de la obra")) await refrescarOC(oc.id); }}>Confirmar recepción</Boton>}
              {puede && ["Borrador", "Emitida"].includes(oc.estado) && <Boton variante="peligro" icono={<Ban className="size-4" aria-hidden />} onClick={() => cancelarOC(oc)}>Cancelar orden</Boton>}
              <Boton variante="secundario" icono={<Printer className="size-4" aria-hidden />} onClick={() => window.print()}>Imprimir</Boton>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
