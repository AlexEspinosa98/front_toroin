"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { fechaCorta } from "@/lib/format";
import { Aviso, Boton, Campo, Input, Insignia, Modal, Select, Tabla, Tarjeta, Titulo, Vacio, useAviso } from "@/components/ui";

type Obra = { id: string; nombre: string };
type Trab = { id: string; nombre: string };
type Sol = { id: string; trabajador_id: string; obra_id: string; elemento: string; talla: string; cantidad: number; motivo: string; estado: string; observaciones: string; fecha_solicitud: string; fecha_aprobacion: string | null; fecha_entrega: string | null };
type Cat = { elementos: string[]; motivos: string[] };
const TONO: Record<string, "ambar" | "azul" | "verde" | "rojo"> = { Solicitado: "ambar", Aprobado: "azul", Entregado: "verde", Rechazado: "rojo" };

export default function EPP() {
  const { me } = useSession();
  const aviso = useAviso();
  const [obras, setObras] = useState<Obra[]>([]);
  const [trabs, setTrabs] = useState<Trab[]>([]);
  const [cat, setCat] = useState<Cat>({ elementos: [], motivos: [] });
  const [lista, setLista] = useState<Sol[]>([]);
  const [filtro, setFiltro] = useState("");
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState({ obra_id: "", trabajador_id: "", elemento: "", talla: "", cantidad: "1", motivo: "Ingreso a obra", observaciones: "" });
  const [asignados, setAsignados] = useState<string[]>([]);
  const puede = !me.solo_lectura && me.licencia?.escritura && ["admin", "gerencia", "sst", "super_admin"].includes(me.rol);

  const cargar = useCallback(() => { api<Sol[]>("epp").then(setLista).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    cargar();
    Promise.all([api<Obra[]>("obras"), api<Trab[]>("personal"), api<Cat>("epp/catalogo")]).then(([o, t, c]) => { setObras(o); setTrabs(t); setCat(c); setF((x) => ({ ...x, obra_id: o[0]?.id ?? "", elemento: c.elementos[0] ?? "" })); }).catch((e) => setError(e.message));
  }, [cargar]);
  useEffect(() => {
    if (!f.obra_id) return;
    api<{ trabajador_id: string; fecha_retiro: string | null }[]>(`asignaciones?obra_id=${f.obra_id}`).then((a0) => {
      const a = a0.filter((x) => !x.fecha_retiro);
      const ids = a.map((x) => x.trabajador_id); setAsignados(ids); setF((x) => ({ ...x, trabajador_id: ids.includes(x.trabajador_id) ? x.trabajador_id : ids[0] ?? "" }));
    }).catch(() => setAsignados([]));
  }, [f.obra_id]);

  const nombre = (id: string) => trabs.find((t) => t.id === id)?.nombre ?? "—";
  const obraN = (id: string) => obras.find((o) => o.id === id)?.nombre ?? "—";
  const vistas = lista.filter((s) => !filtro || s.estado === filtro);
  const cuenta = (e: string) => lista.filter((s) => s.estado === e).length;

  async function crear() {
    try { await api("epp", { method: "POST", body: { ...f, cantidad: Number(f.cantidad) } }); setAbierto(false); aviso("Solicitud registrada"); cargar(); }
    catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); }
  }
  async function estado(id: string, e: string) {
    try { await api(`epp/${id}`, { method: "PATCH", body: { estado: e } }); cargar(); } catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); }
  }
  async function borrar(id: string) {
    if (!confirm("¿Eliminar la solicitud?")) return;
    try { await api(`epp/${id}`, { method: "DELETE" }); cargar(); } catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); }
  }

  return (
    <>
      <Titulo sub="Solicitud, aprobación y entrega de dotación" acciones={puede && <Boton onClick={() => setAbierto(true)}>Nueva solicitud</Boton>}>EPP / SST</Titulo>
      {error && <Aviso tono="error">{error}</Aviso>}
      <div className="mb-3 flex flex-wrap gap-2">
        {["", "Solicitado", "Aprobado", "Entregado", "Rechazado"].map((e) => (
          <Boton key={e} variante={filtro === e ? "primario" : "secundario"} onClick={() => setFiltro(e)}>{e || "Todas"}{e ? ` (${cuenta(e)})` : ` (${lista.length})`}</Boton>
        ))}
      </div>
      {!vistas.length ? <Vacio>No hay solicitudes.</Vacio> : (
        <Tarjeta>
          <Tabla cabeceras={["Fecha", "Trabajador", "Obra", "Elemento", "Cant.", "Motivo", "Estado", ""]}>
            {vistas.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2">{fechaCorta(s.fecha_solicitud)}</td><td className="px-3 py-2">{nombre(s.trabajador_id)}</td><td className="px-3 py-2">{obraN(s.obra_id)}</td>
                <td className="px-3 py-2">{s.elemento}{s.talla ? ` · ${s.talla}` : ""}</td><td className="px-3 py-2">{s.cantidad}</td><td className="px-3 py-2">{s.motivo}</td>
                <td className="px-3 py-2"><Insignia tono={TONO[s.estado] ?? "gris"}>{s.estado}</Insignia>{s.fecha_entrega && <div className="text-xs text-slate-500">{fechaCorta(s.fecha_entrega)}</div>}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {puede && s.estado === "Solicitado" && <><Boton variante="secundario" onClick={() => estado(s.id, "Aprobado")}>Aprobar</Boton> <Boton variante="fantasma" onClick={() => estado(s.id, "Rechazado")}>Rechazar</Boton></>}
                  {puede && s.estado === "Aprobado" && <Boton onClick={() => estado(s.id, "Entregado")}>Marcar entregado</Boton>}
                  {puede && s.estado !== "Entregado" && <Boton variante="fantasma" onClick={() => borrar(s.id)}>Eliminar</Boton>}
                </td>
              </tr>
            ))}
          </Tabla>
        </Tarjeta>
      )}
      <Modal abierto={abierto} titulo="Nueva solicitud de EPP" onCerrar={() => setAbierto(false)}>
        <div className="grid gap-3">
          <Campo etiqueta="Obra"><Select value={f.obra_id} onChange={(e) => setF({ ...f, obra_id: e.target.value })}>{obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Select></Campo>
          <Campo etiqueta="Trabajador" ayuda="Solo personal asignado a la obra">
            <Select value={f.trabajador_id} onChange={(e) => setF({ ...f, trabajador_id: e.target.value })}>{asignados.map((id) => <option key={id} value={id}>{nombre(id)}</option>)}</Select>
          </Campo>
          <Campo etiqueta="Elemento"><Select value={f.elemento} onChange={(e) => setF({ ...f, elemento: e.target.value })}>{cat.elementos.map((x) => <option key={x}>{x}</option>)}</Select></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Talla"><Input value={f.talla} onChange={(e) => setF({ ...f, talla: e.target.value })} /></Campo>
            <Campo etiqueta="Cantidad"><Input type="number" min={1} value={f.cantidad} onChange={(e) => setF({ ...f, cantidad: e.target.value })} /></Campo>
          </div>
          <Campo etiqueta="Motivo"><Select value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })}>{cat.motivos.map((x) => <option key={x}>{x}</option>)}</Select></Campo>
          <Campo etiqueta="Observaciones"><Input value={f.observaciones} onChange={(e) => setF({ ...f, observaciones: e.target.value })} /></Campo>
          <Boton onClick={crear} disabled={!f.trabajador_id || !f.elemento}>Registrar solicitud</Boton>
        </div>
      </Modal>
    </>
  );
}
