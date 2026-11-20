"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, HardHat, PackageCheck, Plus, Trash2, X } from "lucide-react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { fechaCorta } from "@/lib/format";
import { useObras } from "@/lib/obras";
import { Aviso, Boton, BotonIcono, Campo, Chip, Esqueleto, Input, Modal, Segmentado, Select, Titulo, Vacio, enfocarPrimerError, useAviso, useConfirmar, type Tono } from "@/components/ui";
import { SelectorObra } from "@/components/comunes";

type Trab = { id: string; nombre: string };
type Sol = { id: string; trabajador_id: string; obra_id: string; elemento: string; talla: string; cantidad: number; motivo: string; estado: string; observaciones: string; fecha_solicitud: string; fecha_aprobacion: string | null; fecha_entrega: string | null };
type Cat = { elementos: string[]; motivos: string[] };
type Filtro = "todas" | "Solicitado" | "Aprobado" | "Entregado" | "Rechazado";
const TONO: Record<string, Tono> = { Solicitado: "alerta", Aprobado: "info", Entregado: "ok", Rechazado: "error" };
const vacioForm = (obra_id = "", elemento = "") => ({ obra_id, trabajador_id: "", elemento, talla: "", cantidad: "1", motivo: "Ingreso a obra", observaciones: "" });

export default function EPP() {
  const { me } = useSession();
  const aviso = useAviso();
  const confirmar = useConfirmar();
  const { obras, obraId, setObraId } = useObras({ todas: true });
  const [trabs, setTrabs] = useState<Trab[]>([]);
  const [cat, setCat] = useState<Cat>({ elementos: [], motivos: [] });
  const [lista, setLista] = useState<Sol[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState(vacioForm());
  const [asignados, setAsignados] = useState<string[]>([]);
  const [intento, setIntento] = useState(false);
  const puede = !me.solo_lectura && me.licencia?.escritura && ["admin", "gerencia", "sst", "super_admin"].includes(me.rol);
  const puedeEliminar = !me.solo_lectura && me.licencia?.escritura && ["admin", "gerencia", "super_admin"].includes(me.rol);

  const cargar = useCallback(() => { api<Sol[]>("epp").then(setLista).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    cargar();
    Promise.all([api<Trab[]>("personal"), api<Cat>("epp/catalogo")]).then(([t, c]) => { setTrabs(t); setCat(c); }).catch((e) => setError(e.message));
  }, [cargar]);
  useEffect(() => {
    if (!f.obra_id) return;
    let vivo = true;
    api<{ trabajador_id: string; fecha_retiro: string | null }[]>(`asignaciones?obra_id=${f.obra_id}`).then((a0) => {
      if (!vivo) return;
      const ids = a0.filter((x) => !x.fecha_retiro).map((x) => x.trabajador_id);
      setAsignados(ids);
      setF((x) => ({ ...x, trabajador_id: ids.includes(x.trabajador_id) ? x.trabajador_id : "" }));
    }).catch(() => vivo && setAsignados([]));
    return () => { vivo = false; };
  }, [f.obra_id]);

  const nombre = (id: string) => trabs.find((t) => t.id === id)?.nombre ?? "—";
  const obraN = (id: string) => obras.find((o) => o.id === id)?.nombre ?? "—";
  const deObra = useMemo(() => (lista ?? []).filter((s) => !obraId || s.obra_id === obraId), [lista, obraId]);
  const vistas = deObra.filter((s) => filtro === "todas" || s.estado === filtro).sort((a, b) => b.fecha_solicitud.localeCompare(a.fecha_solicitud));
  const n = (e: string) => deObra.filter((s) => s.estado === e).length;

  const errTrab = !f.trabajador_id ? "Seleccione el trabajador" : undefined;
  const errCant = !(Number(f.cantidad) >= 1) ? "Mínimo 1" : undefined;
  const abrir = () => { setIntento(false); setF(vacioForm(obraId || obras[0]?.id || "", cat.elementos[0] ?? "")); setAbierto(true); };
  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setIntento(true);
    if (errTrab || errCant || !f.elemento) return enfocarPrimerError(document.querySelector("dialog[open]"));
    try { await api("epp", { method: "POST", body: { ...f, cantidad: Number(f.cantidad) } }); setAbierto(false); aviso("Solicitud de EPP registrada"); cargar(); }
    catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); }
  }
  async function estado(id: string, e: "Aprobado" | "Entregado" | "Rechazado") {
    try { await api(`epp/${id}`, { method: "PATCH", body: { estado: e } }); aviso(e === "Aprobado" ? "Solicitud aprobada" : e === "Entregado" ? "Entrega registrada" : "Solicitud rechazada"); cargar(); }
    catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); }
  }
  async function borrar(s: Sol) {
    if (!(await confirmar({ titulo: "¿Eliminar la solicitud?", texto: `${s.cantidad} × ${s.elemento} · ${nombre(s.trabajador_id)}`, aceptar: "Eliminar", peligro: true }))) return;
    try { await api(`epp/${s.id}`, { method: "DELETE" }); aviso("Solicitud eliminada"); cargar(); } catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); }
  }

  return (
    <>
      <Titulo sub="Solicitud, aprobación y entrega de EPP por trabajador" acciones={puede && <Boton icono={<Plus className="size-4" aria-hidden />} onClick={abrir} disabled={!obras.length}>Nueva solicitud</Boton>}>Elementos de protección personal</Titulo>
      <SelectorObra className="mb-4 max-w-sm" obras={obras} valor={obraId} onChange={setObraId} todas />
      {error && <Aviso tono="error">{error}</Aviso>}
      {!lista && !error && <div className="space-y-2"><Esqueleto className="h-11 w-96 max-w-full" /><Esqueleto className="h-24" /><Esqueleto className="h-24" /></div>}
      {lista && (
        <>
          <Segmentado etiqueta="Filtrar por estado" valor={filtro} onChange={setFiltro}
            opciones={[
              { valor: "todas", texto: `Todas (${deObra.length})` },
              { valor: "Solicitado", texto: `Solicitadas (${n("Solicitado")})` },
              { valor: "Aprobado", texto: `Aprobadas (${n("Aprobado")})` },
              { valor: "Entregado", texto: `Entregadas (${n("Entregado")})` },
              { valor: "Rechazado", texto: `Rechazadas (${n("Rechazado")})` },
            ]} />
          <ul className="mt-4 space-y-2 lg:max-w-4xl">
            {vistas.length === 0 && (
              <li><Vacio icono={<HardHat className="size-6" aria-hidden />} titulo="No hay solicitudes" texto="Registre aquí lo que necesita cada trabajador: casco, botas, guantes, arnés…"
                accion={puede ? <Boton icono={<Plus className="size-4" aria-hidden />} onClick={abrir}>Nueva solicitud</Boton> : undefined} /></li>
            )}
            {vistas.map((s) => (
              <li key={s.id} className="flex flex-col gap-3 rounded-xl border border-borde bg-tarjeta p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-tinta">{s.cantidad} × {s.elemento}{s.talla && ` · talla ${s.talla}`}</h2>
                    <Chip tono={TONO[s.estado] ?? "neutro"}>{s.estado}</Chip>
                  </div>
                  <p className="text-sm text-suave">
                    {nombre(s.trabajador_id)} · {obraN(s.obra_id)} · {s.motivo} · {fechaCorta(s.fecha_solicitud)}
                    {s.fecha_entrega && ` · entregado ${fechaCorta(s.fecha_entrega)}`}
                  </p>
                  {s.observaciones && <p className="text-sm text-suave">“{s.observaciones}”</p>}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {puede && s.estado === "Solicitado" && (
                    <>
                      <Boton tam="sm" variante="secundario" icono={<Check className="size-4" aria-hidden />} onClick={() => estado(s.id, "Aprobado")}>Aprobar</Boton>
                      <Boton tam="sm" variante="fantasma" icono={<X className="size-4" aria-hidden />} onClick={() => estado(s.id, "Rechazado")}>Rechazar</Boton>
                    </>
                  )}
                  {puede && s.estado === "Aprobado" && <Boton tam="sm" icono={<PackageCheck className="size-4" aria-hidden />} onClick={() => estado(s.id, "Entregado")}>Registrar entrega</Boton>}
                  {puedeEliminar && s.estado !== "Entregado" && <BotonIcono peligro etiqueta={`Eliminar solicitud de ${s.elemento}`} onClick={() => borrar(s)}><Trash2 className="size-4" aria-hidden /></BotonIcono>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal abierto={abierto} onCerrar={() => setAbierto(false)} sucio={!!f.trabajador_id || !!f.talla || !!f.observaciones} titulo="Nueva solicitud de EPP"
        pie={<><Boton type="button" variante="secundario" onClick={() => setAbierto(false)}>Cancelar</Boton><Boton type="submit" form="form-epp">Registrar solicitud</Boton></>}>
        <form id="form-epp" onSubmit={crear} className="space-y-4" noValidate>
          <Campo etiqueta="Obra"><Select value={f.obra_id} onChange={(e) => setF({ ...f, obra_id: e.target.value })}>{obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Select></Campo>
          <Campo etiqueta="Trabajador" ayuda={asignados.length ? "Solo personal asignado a la obra" : "Esta obra aún no tiene personal asignado"} error={intento ? errTrab : undefined}>
            <Select data-autofocus value={f.trabajador_id} onChange={(e) => setF({ ...f, trabajador_id: e.target.value })}>
              <option value="">Seleccione…</option>
              {asignados.map((id) => <option key={id} value={id}>{nombre(id)}</option>)}
            </Select>
          </Campo>
          <Campo etiqueta="Elemento"><Select value={f.elemento} onChange={(e) => setF({ ...f, elemento: e.target.value })}>{cat.elementos.map((x) => <option key={x}>{x}</option>)}</Select></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Talla"><Input placeholder="M, 41, única…" value={f.talla} onChange={(e) => setF({ ...f, talla: e.target.value })} /></Campo>
            <Campo etiqueta="Cantidad" error={intento ? errCant : undefined}><Input type="number" min={1} inputMode="numeric" className="num" value={f.cantidad} onChange={(e) => setF({ ...f, cantidad: e.target.value })} /></Campo>
          </div>
          <Campo etiqueta="Motivo"><Select value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })}>{cat.motivos.map((x) => <option key={x}>{x}</option>)}</Select></Campo>
          <Campo etiqueta="Observaciones (opcional)"><Input value={f.observaciones} onChange={(e) => setF({ ...f, observaciones: e.target.value })} /></Campo>
        </form>
      </Modal>
    </>
  );
}
