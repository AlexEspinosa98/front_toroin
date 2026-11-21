"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { fechaCorta, fmtCOP, fmtNum } from "@/lib/format";
import { hoy } from "@/lib/fechas";
import { Aviso, Boton, Campo, Input, Insignia, Modal, Select, Tabla, Tarjeta, Titulo, Vacio, useAviso } from "@/components/ui";
import { Indicador } from "@/components/comunes";

type Obra = { id: string; nombre: string };
type Mat = { id: string; nombre: string; unidad: string; activo: boolean };
type Prov = { id: string; nombre: string; nit: string; contacto: string; telefono: string; correo: string; direccion: string; activo: boolean };
type ItemReq = { material_id: string; descripcion: string; unidad: string; cantidad: number };
type Req = { id: string; etiqueta: string; obra: string; obra_id: string; fecha: string; solicitante: string; estado: string; items: ItemReq[]; observaciones: string };
type ItemOC = ItemReq & { precio_unitario: number; recibido: number };
type OC = { id: string; etiqueta: string; obra: string; obra_id: string; proveedor: string; proveedor_id: string; proveedor_nit: string; requisicion_id: string; fecha: string; fecha_entrega: string | null; estado: string; items: ItemOC[]; iva_pct: number;
  condiciones: string; observaciones: string; subtotal: number; iva: number; total: number; pendiente: number; vencida: boolean };
type Resumen = { requisiciones_pendientes: number; requisiciones_por_ordenar: number; ordenes_abiertas: number; por_recibir: number; ordenes_vencidas: number };
const TONO: Record<string, "gris" | "ambar" | "azul" | "verde" | "rojo"> = { Solicitada: "ambar", Aprobada: "azul", Rechazada: "rojo", Ordenada: "verde", Borrador: "gris", Emitida: "azul", Parcial: "ambar", Recibida: "verde", Cancelada: "rojo" };

export default function Compras() {
  const { me } = useSession();
  const aviso = useAviso();
  const [vista, setVista] = useState<"requisiciones" | "ordenes" | "proveedores">("requisiciones");
  const [obras, setObras] = useState<Obra[]>([]);
  const [mats, setMats] = useState<Mat[]>([]);
  const [provs, setProvs] = useState<Prov[]>([]);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [ocs, setOcs] = useState<OC[]>([]);
  const [res, setRes] = useState<Resumen | null>(null);
  const [error, setError] = useState("");
  const [nr, setNr] = useState<{ obra_id: string; observaciones: string; items: { material_id: string; descripcion: string; unidad: string; cantidad: string }[] } | null>(null);
  const [aOrden, setAOrden] = useState<{ req: Req; proveedor_id: string } | null>(null);
  const [fp, setFp] = useState<(Omit<Prov, "id"> & { id?: string }) | null>(null);
  const [oc, setOc] = useState<OC | null>(null);
  const [precios, setPrecios] = useState<string[]>([]);
  const [rec, setRec] = useState<{ fecha: string; cant: string[] } | null>(null);
  const [no, setNo] = useState<{ obra_id: string; proveedor_id: string; fecha: string; fecha_entrega: string; iva_pct: string; condiciones: string; items: { material_id: string; descripcion: string; unidad: string; cantidad: string; precio: string }[] } | null>(null);
  const puede = !me.solo_lectura && me.licencia?.escritura;

  const cargar = useCallback(() => {
    api<Req[]>("compras/requisiciones").then(setReqs).catch((e) => setError(e.message));
    api<OC[]>("compras/ordenes").then(setOcs).catch(() => {});
    api<Prov[]>("compras/proveedores").then(setProvs).catch(() => {});
    api<Resumen>("compras/resumen").then(setRes).catch(() => {});
  }, []);
  useEffect(() => { cargar(); api<Obra[]>("obras").then(setObras).catch(() => {}); api<Mat[]>("inventario/materiales").then((m) => setMats(m.filter((x) => x.activo))).catch(() => {}); }, [cargar]);

  const run = async (f: () => Promise<unknown>, ok: string) => { try { await f(); aviso(ok); cargar(); return true; } catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); return false; } };
  const abrirOC = (o: OC) => { setOc(o); setPrecios(o.items.map((i) => String(i.precio_unitario))); setRec(null); };
  async function refrescarOC(id: string) { const o = await api<OC>(`compras/ordenes/${id}`); abrirOC(o); cargar(); }

  const itemReq = (i: { material_id: string; descripcion: string; unidad: string; cantidad: string }) => ({ material_id: i.material_id, descripcion: i.descripcion, unidad: i.unidad, cantidad: Number(i.cantidad) });

  return (
    <>
      <Titulo sub="Requisiciones de obra, órdenes de compra y recepción de mercancía">Compras y proveedores</Titulo>
      {error && <Aviso tono="error">{error}</Aviso>}
      {res && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador etiqueta="Requisiciones por resolver" valor={res.requisiciones_pendientes} tono={res.requisiciones_pendientes ? "alerta" : "ok"} detalle={res.requisiciones_por_ordenar ? `${res.requisiciones_por_ordenar} aprobadas sin orden` : undefined} />
          <Indicador etiqueta="Órdenes abiertas" valor={res.ordenes_abiertas} />
          <Indicador etiqueta="Por recibir" valor={fmtCOP(res.por_recibir)} />
          <Indicador etiqueta="Entregas vencidas" valor={res.ordenes_vencidas} tono={res.ordenes_vencidas ? "error" : "ok"} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {(["requisiciones", "ordenes", "proveedores"] as const).map((v) => <Boton key={v} variante={vista === v ? "primario" : "secundario"} onClick={() => setVista(v)}>{v === "requisiciones" ? "Requisiciones" : v === "ordenes" ? "Órdenes de compra" : "Proveedores"}</Boton>)}
        <span className="flex-1" />
        {puede && vista === "requisiciones" && <Boton onClick={() => setNr({ obra_id: obras[0]?.id ?? "", observaciones: "", items: [{ material_id: "", descripcion: "", unidad: "UND", cantidad: "" }] })}>Nueva requisición</Boton>}
        {puede && vista === "ordenes" && <Boton onClick={() => setNo({ obra_id: obras[0]?.id ?? "", proveedor_id: provs.find((p) => p.activo)?.id ?? "", fecha: hoy(), fecha_entrega: "", iva_pct: "19", condiciones: "", items: [{ material_id: "", descripcion: "", unidad: "UND", cantidad: "", precio: "" }] })}>Nueva orden</Boton>}
        {puede && vista === "proveedores" && <Boton onClick={() => setFp({ nombre: "", nit: "", contacto: "", telefono: "", correo: "", direccion: "", activo: true })}>Nuevo proveedor</Boton>}
      </div>

      {vista === "requisiciones" && (
        <div className="mt-4">{!reqs.length ? <Vacio>No hay requisiciones.</Vacio> : (
          <div className="grid gap-3">{reqs.map((r) => (
            <Tarjeta key={r.id}>
              <div className="flex flex-wrap items-center gap-2"><strong>{r.etiqueta}</strong><Insignia tono={TONO[r.estado]}>{r.estado}</Insignia><span className="text-sm text-slate-600">{r.obra} · {fechaCorta(r.fecha)} · {r.solicitante}</span></div>
              <ul className="mt-2 text-sm">{r.items.map((i, k) => <li key={k}>• {fmtNum(i.cantidad)} {i.unidad} · {i.descripcion}</li>)}</ul>
              {r.observaciones && <p className="mt-1 text-xs text-slate-500">{r.observaciones}</p>}
              {puede && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.estado === "Solicitada" && <><Boton variante="secundario" onClick={() => run(() => api(`compras/requisiciones/${r.id}`, { method: "PATCH", body: { estado: "Aprobada" } }), "Requisición aprobada")}>Aprobar</Boton>
                    <Boton variante="fantasma" onClick={() => run(() => api(`compras/requisiciones/${r.id}`, { method: "PATCH", body: { estado: "Rechazada" } }), "Requisición rechazada")}>Rechazar</Boton></>}
                  {r.estado === "Aprobada" && <Boton onClick={() => setAOrden({ req: r, proveedor_id: provs.find((p) => p.activo)?.id ?? "" })}>Generar orden de compra</Boton>}
                </div>
              )}
            </Tarjeta>
          ))}</div>
        )}</div>
      )}

      {vista === "ordenes" && (
        <div className="mt-4">{!ocs.length ? <Vacio>No hay órdenes de compra.</Vacio> : (
          <Tarjeta><Tabla cabeceras={["Orden", "Proveedor", "Obra", "Entrega", "Total", "Estado"]}>
            {ocs.map((o) => (
              <tr key={o.id} className="cursor-pointer hover:bg-slate-50" onClick={() => abrirOC(o)}>
                <td className="px-3 py-2 font-medium">{o.etiqueta}<div className="text-xs font-normal text-slate-500">{fechaCorta(o.fecha)}</div></td><td className="px-3 py-2">{o.proveedor}</td><td className="px-3 py-2">{o.obra}</td>
                <td className="px-3 py-2">{o.fecha_entrega ? fechaCorta(o.fecha_entrega) : "—"} {o.vencida && <Insignia tono="rojo">Vencida</Insignia>}</td><td className="px-3 py-2">{fmtCOP(o.total)}</td>
                <td className="px-3 py-2"><Insignia tono={TONO[o.estado]}>{o.estado}</Insignia></td>
              </tr>
            ))}
          </Tabla></Tarjeta>
        )}</div>
      )}

      {vista === "proveedores" && (
        <div className="mt-4">{!provs.length ? <Vacio>No hay proveedores registrados.</Vacio> : (
          <Tarjeta><Tabla cabeceras={["Proveedor", "NIT", "Contacto", "Teléfono", ""]}>
            {provs.map((p) => (
              <tr key={p.id} className={p.activo ? "" : "opacity-50"}><td className="px-3 py-2 font-medium">{p.nombre}{!p.activo && <span className="ml-2 text-xs font-normal text-slate-500">inactivo</span>}</td><td className="px-3 py-2">{p.nit || "—"}</td><td className="px-3 py-2">{p.contacto || p.correo || "—"}</td><td className="px-3 py-2">{p.telefono || "—"}</td>
                <td className="px-3 py-2 text-right">{puede && <Boton variante="fantasma" className="!min-h-9" onClick={() => setFp(p)}>Editar</Boton>}</td></tr>
            ))}
          </Tabla></Tarjeta>
        )}</div>
      )}

      {/* Nueva requisición */}
      <Modal abierto={!!nr} titulo="Nueva requisición" onCerrar={() => setNr(null)}>
        {nr && <div className="grid gap-3">
          <Campo etiqueta="Obra"><Select value={nr.obra_id} onChange={(e) => setNr({ ...nr, obra_id: e.target.value })}>{obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Select></Campo>
          {nr.items.map((it, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-[1fr_6rem_auto]">
              <div className="grid gap-2">
                <Select aria-label="Material" value={it.material_id} onChange={(e) => { const m = mats.find((x) => x.id === e.target.value); setNr({ ...nr, items: nr.items.map((x, k) => (k === i ? { ...x, material_id: e.target.value, unidad: m?.unidad ?? x.unidad } : x)) }); }}><option value="">Otro (escribir descripción)</option>{mats.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</Select>
                {!it.material_id && <Input aria-label="Descripción" placeholder="Descripción" value={it.descripcion} onChange={(e) => setNr({ ...nr, items: nr.items.map((x, k) => (k === i ? { ...x, descripcion: e.target.value } : x)) })} />}
              </div>
              <Input aria-label="Cantidad" type="number" min={0} step="any" placeholder="Cant." value={it.cantidad} onChange={(e) => setNr({ ...nr, items: nr.items.map((x, k) => (k === i ? { ...x, cantidad: e.target.value } : x)) })} />
              <Boton variante="fantasma" onClick={() => setNr({ ...nr, items: nr.items.filter((_, k) => k !== i) })} disabled={nr.items.length === 1}>✕</Boton>
            </div>
          ))}
          <Boton variante="secundario" onClick={() => setNr({ ...nr, items: [...nr.items, { material_id: "", descripcion: "", unidad: "UND", cantidad: "" }] })}>+ Agregar ítem</Boton>
          <Campo etiqueta="Observaciones"><Input value={nr.observaciones} onChange={(e) => setNr({ ...nr, observaciones: e.target.value })} /></Campo>
          <Boton disabled={!nr.obra_id || nr.items.some((i) => !Number(i.cantidad) || (!i.material_id && !i.descripcion.trim()))}
            onClick={async () => { if (await run(() => api("compras/requisiciones", { method: "POST", body: { obra_id: nr.obra_id, observaciones: nr.observaciones, items: nr.items.map(itemReq) } }), "Requisición creada")) setNr(null); }}>Enviar requisición</Boton>
        </div>}
      </Modal>

      {/* Requisición → orden */}
      <Modal abierto={!!aOrden} titulo={aOrden ? `Orden desde ${aOrden.req.etiqueta}` : ""} onCerrar={() => setAOrden(null)}>
        {aOrden && <div className="grid gap-3">
          <Campo etiqueta="Proveedor"><Select value={aOrden.proveedor_id} onChange={(e) => setAOrden({ ...aOrden, proveedor_id: e.target.value })}>{provs.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</Select></Campo>
          <p className="text-xs text-slate-500">Se crea en borrador; ahí pone los precios y la emite.</p>
          <Boton disabled={!aOrden.proveedor_id} onClick={async () => { try { const o = await api<OC>(`compras/requisiciones/${aOrden.req.id}/orden?proveedor_id=${aOrden.proveedor_id}`, { method: "POST" }); setAOrden(null); cargar(); setVista("ordenes"); abrirOC(o); } catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); } }}>Crear orden</Boton>
        </div>}
      </Modal>

      {/* Proveedor */}
      <Modal abierto={!!fp} titulo={fp?.id ? "Editar proveedor" : "Nuevo proveedor"} onCerrar={() => setFp(null)}>
        {fp && <div className="grid gap-3">
          <Campo etiqueta="Nombre"><Input value={fp.nombre} onChange={(e) => setFp({ ...fp, nombre: e.target.value })} /></Campo>
          <div className="grid grid-cols-2 gap-3"><Campo etiqueta="NIT"><Input value={fp.nit} onChange={(e) => setFp({ ...fp, nit: e.target.value })} /></Campo><Campo etiqueta="Teléfono"><Input value={fp.telefono} onChange={(e) => setFp({ ...fp, telefono: e.target.value })} /></Campo></div>
          <div className="grid grid-cols-2 gap-3"><Campo etiqueta="Contacto"><Input value={fp.contacto} onChange={(e) => setFp({ ...fp, contacto: e.target.value })} /></Campo><Campo etiqueta="Correo"><Input type="email" value={fp.correo} onChange={(e) => setFp({ ...fp, correo: e.target.value })} /></Campo></div>
          <Campo etiqueta="Dirección"><Input value={fp.direccion} onChange={(e) => setFp({ ...fp, direccion: e.target.value })} /></Campo>
          {fp.id && <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="size-5" checked={fp.activo} onChange={(e) => setFp({ ...fp, activo: e.target.checked })} />Activo</label>}
          <Boton disabled={!fp.nombre.trim()} onClick={async () => { const { id, ...body } = fp; if (await run(() => api(id ? `compras/proveedores/${id}` : "compras/proveedores", { method: id ? "PATCH" : "POST", body }), "Proveedor guardado")) setFp(null); }}>Guardar</Boton>
        </div>}
      </Modal>

      {/* Nueva orden manual */}
      <Modal abierto={!!no} titulo="Nueva orden de compra" onCerrar={() => setNo(null)}>
        {no && <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Obra"><Select value={no.obra_id} onChange={(e) => setNo({ ...no, obra_id: e.target.value })}>{obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Select></Campo>
            <Campo etiqueta="Proveedor"><Select value={no.proveedor_id} onChange={(e) => setNo({ ...no, proveedor_id: e.target.value })}>{provs.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</Select></Campo>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Campo etiqueta="Fecha"><Input type="date" value={no.fecha} onChange={(e) => setNo({ ...no, fecha: e.target.value })} /></Campo>
            <Campo etiqueta="Entrega"><Input type="date" min={no.fecha} value={no.fecha_entrega} onChange={(e) => setNo({ ...no, fecha_entrega: e.target.value })} /></Campo>
            <Campo etiqueta="IVA %"><Input type="number" min={0} value={no.iva_pct} onChange={(e) => setNo({ ...no, iva_pct: e.target.value })} /></Campo>
          </div>
          {no.items.map((it, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-[1fr_5rem_7rem_auto]">
              <div className="grid gap-2">
                <Select aria-label="Material" value={it.material_id} onChange={(e) => { const m = mats.find((x) => x.id === e.target.value); setNo({ ...no, items: no.items.map((x, k) => (k === i ? { ...x, material_id: e.target.value, unidad: m?.unidad ?? x.unidad } : x)) }); }}><option value="">Otro (descripción)</option>{mats.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</Select>
                {!it.material_id && <Input aria-label="Descripción" placeholder="Descripción" value={it.descripcion} onChange={(e) => setNo({ ...no, items: no.items.map((x, k) => (k === i ? { ...x, descripcion: e.target.value } : x)) })} />}
              </div>
              <Input aria-label="Cantidad" type="number" min={0} step="any" placeholder="Cant." value={it.cantidad} onChange={(e) => setNo({ ...no, items: no.items.map((x, k) => (k === i ? { ...x, cantidad: e.target.value } : x)) })} />
              <Input aria-label="Precio" type="number" min={0} placeholder="Precio" value={it.precio} onChange={(e) => setNo({ ...no, items: no.items.map((x, k) => (k === i ? { ...x, precio: e.target.value } : x)) })} />
              <Boton variante="fantasma" disabled={no.items.length === 1} onClick={() => setNo({ ...no, items: no.items.filter((_, k) => k !== i) })}>✕</Boton>
            </div>
          ))}
          <Boton variante="secundario" onClick={() => setNo({ ...no, items: [...no.items, { material_id: "", descripcion: "", unidad: "UND", cantidad: "", precio: "" }] })}>+ Agregar ítem</Boton>
          <Campo etiqueta="Condiciones de pago / entrega"><Input value={no.condiciones} onChange={(e) => setNo({ ...no, condiciones: e.target.value })} /></Campo>
          <Boton disabled={!no.obra_id || !no.proveedor_id || no.items.some((i) => !Number(i.cantidad) || (!i.material_id && !i.descripcion.trim()))}
            onClick={async () => { if (await run(() => api("compras/ordenes", { method: "POST", body: { obra_id: no.obra_id, proveedor_id: no.proveedor_id, fecha: no.fecha, fecha_entrega: no.fecha_entrega || null, iva_pct: Number(no.iva_pct) || 0, condiciones: no.condiciones,
              items: no.items.map((i) => ({ ...itemReq(i), precio_unitario: Number(i.precio) || 0 })) } }), "Orden creada")) setNo(null); }}>Crear orden</Boton>
        </div>}
      </Modal>

      {/* Detalle de la orden */}
      <Modal abierto={!!oc} titulo={oc ? `${oc.etiqueta} · ${oc.proveedor}` : ""} onCerrar={() => { setOc(null); setRec(null); }}>
        {oc && (
          <div className="space-y-3" id="orden-imprimible">
            <div className="flex flex-wrap items-center gap-2 text-sm"><Insignia tono={TONO[oc.estado]}>{oc.estado}</Insignia><span>{oc.obra}</span><span className="text-slate-500">{fechaCorta(oc.fecha)}{oc.fecha_entrega ? ` · entrega ${fechaCorta(oc.fecha_entrega)}` : ""}</span>{oc.vencida && <Insignia tono="rojo">Entrega vencida</Insignia>}</div>
            <Tabla cabeceras={["Ítem", "Cant.", "Precio", rec ? "Recibir ahora" : "Recibido"]}>
              {oc.items.map((i, k) => (
                <tr key={k}><td className="px-3 py-2">{i.descripcion}</td><td className="px-3 py-2">{fmtNum(i.cantidad)} {i.unidad}</td>
                  <td className="px-3 py-2">{oc.estado === "Borrador" && puede ? <Input type="number" min={0} className="!min-h-9 w-28" value={precios[k] ?? ""} onChange={(e) => setPrecios(precios.map((p, j) => (j === k ? e.target.value : p)))} /> : fmtCOP(i.precio_unitario)}</td>
                  <td className="px-3 py-2">{rec ? <Input type="number" min={0} max={i.cantidad - i.recibido} step="any" className="!min-h-9 w-24" placeholder={`máx ${fmtNum(i.cantidad - i.recibido)}`} value={rec.cant[k] ?? ""} onChange={(e) => setRec({ ...rec, cant: rec.cant.map((c, j) => (j === k ? e.target.value : c)) })} /> : fmtNum(i.recibido)}</td></tr>
              ))}
            </Tabla>
            <div className="text-right text-sm"><div>Subtotal {fmtCOP(oc.subtotal)}</div><div>IVA {oc.iva_pct}% {fmtCOP(oc.iva)}</div><div className="font-semibold">Total {fmtCOP(oc.total)}</div></div>
            {oc.condiciones && <p className="text-xs text-slate-500">Condiciones: {oc.condiciones}</p>}
            {rec && <Campo etiqueta="Fecha de recepción"><Input type="date" max={hoy()} value={rec.fecha} onChange={(e) => setRec({ ...rec, fecha: e.target.value })} /></Campo>}
            <div className="no-imprimir flex flex-wrap justify-end gap-2">
              {puede && oc.estado === "Borrador" && <Boton variante="secundario" onClick={async () => {
                if (await run(() => api(`compras/ordenes/${oc.id}`, { method: "PUT", body: { obra_id: oc.obra_id, proveedor_id: oc.proveedor_id, requisicion_id: oc.requisicion_id, fecha: oc.fecha, fecha_entrega: oc.fecha_entrega, iva_pct: oc.iva_pct, condiciones: oc.condiciones, observaciones: oc.observaciones,
                  items: oc.items.map((i, k) => ({ material_id: i.material_id, descripcion: i.descripcion, unidad: i.unidad, cantidad: i.cantidad, precio_unitario: Number(precios[k]) || 0 })) } }), "Precios guardados")) await refrescarOC(oc.id); }}>Guardar precios</Boton>}
              {puede && oc.estado === "Borrador" && <Boton onClick={async () => { if (await run(() => api(`compras/ordenes/${oc.id}`, { method: "PATCH", body: { estado: "Emitida" } }), "Orden emitida")) await refrescarOC(oc.id); }}>Emitir orden</Boton>}
              {puede && ["Emitida", "Parcial"].includes(oc.estado) && !rec && <Boton onClick={() => setRec({ fecha: hoy(), cant: oc.items.map(() => "") })}>Recibir mercancía</Boton>}
              {rec && <Boton disabled={!rec.cant.some((c) => Number(c) > 0)} onClick={async () => {
                if (await run(() => api(`compras/ordenes/${oc.id}/recibir`, { method: "POST", body: { fecha: rec.fecha, items: rec.cant.map((c, k) => ({ indice: k, cantidad: Number(c) })).filter((x) => x.cantidad > 0) } }), "Recepción registrada: entró al inventario y a los gastos de la obra")) await refrescarOC(oc.id); }}>Confirmar recepción</Boton>}
              {puede && ["Borrador", "Emitida"].includes(oc.estado) && <Boton variante="peligro" onClick={async () => { if (confirm("¿Cancelar la orden?") && await run(() => api(`compras/ordenes/${oc.id}`, { method: "PATCH", body: { estado: "Cancelada" } }), "Orden cancelada")) await refrescarOC(oc.id); }}>Cancelar</Boton>}
              <Boton variante="secundario" onClick={() => window.print()}>Imprimir</Boton>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
