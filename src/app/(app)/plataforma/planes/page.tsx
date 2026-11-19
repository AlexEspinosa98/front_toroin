"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { limiteTexto } from "@/lib/format";
import type { ModuloCatalogo, Plan } from "@/lib/types";
import { Aviso, Boton, Campo, Input, Insignia, Modal, Tarjeta, Titulo, useAviso } from "@/components/ui";

const LIM = [["max_usuarios", "Usuarios"], ["max_obras", "Obras"], ["max_trabajadores", "Trabajadores"]] as const;
type Edit = { id?: string; clave: string; nombre: string; descripcion: string; modulos: string[]; limites: Record<string, string>; precio_ref: number; activo: boolean };

export default function Planes() {
  const aviso = useAviso();
  const [planes, setPlanes] = useState<Plan[] | null>(null);
  const [cat, setCat] = useState<ModuloCatalogo[]>([]);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [error, setError] = useState("");
  const [errModal, setErrModal] = useState("");

  const cargar = useCallback(() => api<Plan[]>("platform/planes").then(setPlanes).catch((e) => setError(e.message)), []);
  useEffect(() => { void cargar(); api<ModuloCatalogo[]>("platform/catalogo").then(setCat).catch(() => {}); }, [cargar]);
  const nombre = (k: string) => cat.find((m) => m.clave === k)?.nombre ?? k;
  const vendibles = cat.filter((m) => !m.nucleo);

  const abrir = (p?: Plan) => { setErrModal(""); setEdit(p ? { id: p.id, clave: p.clave, nombre: p.nombre, descripcion: p.descripcion, modulos: p.modulos, precio_ref: p.precio_ref, activo: p.activo, limites: Object.fromEntries(LIM.map(([k]) => [k, p.limites[k] == null ? "" : String(p.limites[k])])) } : { clave: "", nombre: "", descripcion: "", modulos: [], limites: {}, precio_ref: 0, activo: true }); };

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const body = { clave: edit.clave, nombre: edit.nombre, descripcion: edit.descripcion, modulos: edit.modulos, activo: edit.activo, precio_ref: edit.precio_ref,
      limites: Object.fromEntries(LIM.map(([k]) => [k, edit.limites[k] ? Number(edit.limites[k]) : null])) };
    try { if (edit.id) await api(`platform/planes/${edit.id}`, { method: "PUT", body }); else await api("platform/planes", { method: "POST", body }); setEdit(null); aviso("Plan guardado"); void cargar(); }
    catch (x) { setErrModal(x instanceof Error ? x.message : "No se pudo guardar"); }
  }
  const alternar = (k: string) => setEdit((x) => x && ({ ...x, modulos: x.modulos.includes(k) ? x.modulos.filter((m) => m !== k) : [...x.modulos, k] }));

  return (
    <>
      <Titulo sub="Los planes son plantillas: después puede ajustar los módulos de cada empresa por separado." acciones={<Boton onClick={() => abrir()}>Nuevo plan</Boton>}>Planes y módulos</Titulo>
      {error && <Aviso tono="error">{error}</Aviso>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {planes?.map((p) => (
          <Tarjeta key={p.id} titulo={<>{p.nombre} {!p.activo && <Insignia>Inactivo</Insignia>}</>} acciones={<Boton variante="secundario" className="!min-h-9" onClick={() => abrir(p)}>Editar</Boton>}>
            <p className="mb-3 text-sm text-slate-600">{p.descripcion}</p>
            <div className="mb-3 flex flex-wrap gap-1.5">{p.modulos.map((m) => <span key={m} className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">{nombre(m)}</span>)}</div>
            <p className="text-xs text-slate-500">{LIM.map(([k, t]) => `${t}: ${limiteTexto(p.limites[k])}`).join(" · ")}</p>
          </Tarjeta>))}
      </div>
      <Tarjeta titulo="Catálogo de módulos" className="mt-6">
        <ul className="grid gap-2 sm:grid-cols-2">
          {cat.map((m) => (<li key={m.clave} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><div className="flex flex-wrap items-center gap-2 font-medium">{m.nombre}{m.nucleo && <Insignia tono="azul">Núcleo</Insignia>}{!m.disponible && <Insignia>Próximamente</Insignia>}</div>
            <p className="text-xs text-slate-500">{m.descripcion}{m.requiere.length > 0 && ` · Requiere: ${m.requiere.map(nombre).join(", ")}`}</p></li>))}
        </ul>
      </Tarjeta>

      <Modal abierto={!!edit} titulo={edit?.id ? "Editar plan" : "Nuevo plan"} onCerrar={() => setEdit(null)}>
        {edit && <form onSubmit={guardar} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombre"><Input required value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></Campo>
            <Campo etiqueta="Clave" ayuda="Minúsculas, sin espacios"><Input required pattern="[a-z0-9_\-]{2,40}" disabled={!!edit.id} value={edit.clave} onChange={(e) => setEdit({ ...edit, clave: e.target.value })} /></Campo>
          </div>
          <Campo etiqueta="Descripción"><Input value={edit.descripcion} onChange={(e) => setEdit({ ...edit, descripcion: e.target.value })} /></Campo>
          <fieldset><legend className="mb-2 text-sm font-medium text-slate-700">Módulos incluidos</legend>
            <div className="grid gap-1 sm:grid-cols-2">{vendibles.map((m) => (
              <label key={m.clave} className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm ${m.disponible ? "border-slate-200" : "border-slate-100 text-slate-400"}`}>
                <input type="checkbox" className="size-5" disabled={!m.disponible} checked={edit.modulos.includes(m.clave)} onChange={() => alternar(m.clave)} /> {m.nombre}</label>))}</div></fieldset>
          <div className="grid gap-3 sm:grid-cols-3">{LIM.map(([k, t]) => (<Campo key={k} etiqueta={`Máx. ${t.toLowerCase()}`} ayuda="Vacío = sin límite"><Input type="number" min={1} value={edit.limites[k] ?? ""} onChange={(e) => setEdit({ ...edit, limites: { ...edit.limites, [k]: e.target.value } })} /></Campo>))}</div>
          <div className="grid gap-4 sm:grid-cols-2"><Campo etiqueta="Precio de referencia"><Input type="number" min={0} value={edit.precio_ref} onChange={(e) => setEdit({ ...edit, precio_ref: Number(e.target.value) })} /></Campo>
            <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" className="size-5" checked={edit.activo} onChange={(e) => setEdit({ ...edit, activo: e.target.checked })} /> Plan activo (se puede asignar)</label></div>
          {errModal && <Aviso tono="error">{errModal}</Aviso>}
          <div className="flex justify-end gap-2"><Boton type="button" variante="secundario" onClick={() => setEdit(null)}>Cancelar</Boton><Boton type="submit">Guardar</Boton></div>
        </form>}
      </Modal>
    </>
  );
}
