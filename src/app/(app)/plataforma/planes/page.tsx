"use client";
import { useCallback, useEffect, useState } from "react";
import { Layers, Lock, Pencil, Plus } from "lucide-react";
import { api } from "@/lib/client";
import { fmtCOP, limiteTexto } from "@/lib/format";
import type { ModuloCatalogo, Plan } from "@/lib/types";
import { Aviso, Boton, Campo, Chip, cx, Esqueleto, Input, Modal, Tarjeta, Titulo, Vacio, useAviso } from "@/components/ui";

const LIM = [["max_usuarios", "Usuarios"], ["max_obras", "Obras"], ["max_trabajadores", "Trabajadores"]] as const;
type Edit = { id?: string; clave: string; nombre: string; descripcion: string; modulos: string[]; limites: Record<string, string>; precio_ref: number; activo: boolean };

export default function Planes() {
  const aviso = useAviso();
  const [planes, setPlanes] = useState<Plan[] | null>(null);
  const [cat, setCat] = useState<ModuloCatalogo[]>([]);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [error, setError] = useState("");
  const [errModal, setErrModal] = useState("");
  const [guardando, setGuardando] = useState(false);

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
    setGuardando(true);
    try { if (edit.id) await api(`platform/planes/${edit.id}`, { method: "PUT", body }); else await api("platform/planes", { method: "POST", body }); setEdit(null); aviso("Plan guardado"); void cargar(); }
    catch (x) { setErrModal(x instanceof Error ? x.message : "No se pudo guardar"); }
    finally { setGuardando(false); }
  }
  const alternar = (k: string) => setEdit((x) => x && ({ ...x, modulos: x.modulos.includes(k) ? x.modulos.filter((m) => m !== k) : [...x.modulos, k] }));

  return (
    <>
      <Titulo sub="Los planes son plantillas: después puede ajustar los módulos de cada empresa por separado." acciones={<Boton icono={<Plus className="size-4" aria-hidden />} onClick={() => abrir()}>Nuevo plan</Boton>}>Planes y módulos</Titulo>
      {error && <Aviso tono="error">{error}</Aviso>}
      {!planes && !error && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Esqueleto key={i} className="h-52" />)}</div>}
      {planes && planes.length === 0 && <Vacio icono={<Layers className="size-6" aria-hidden />} titulo="Aún no hay planes" texto="Cree uno para poder asignarlo a las empresas." accion={<Boton icono={<Plus className="size-4" aria-hidden />} onClick={() => abrir()}>Nuevo plan</Boton>} />}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {planes?.map((p) => (
          <Tarjeta key={p.id} className={cx("flex flex-col", !p.activo && "bg-fondo")} titulo={<span className="flex flex-wrap items-center gap-2">{p.nombre}{!p.activo && <Chip>Inactivo</Chip>}</span>} sub={p.precio_ref > 0 ? `Referencia: ${fmtCOP(p.precio_ref)}` : undefined}
            acciones={<Boton variante="secundario" tam="sm" icono={<Pencil className="size-4" aria-hidden />} aria-label={`Editar el plan ${p.nombre}`} onClick={() => abrir(p)}>Editar</Boton>}>
            <p className="mb-3 text-sm text-suave">{p.descripcion}</p>
            <div className="mb-3 flex flex-wrap gap-1.5">{p.modulos.map((m) => <Chip key={m} tono="ok">{nombre(m)}</Chip>)}</div>
            <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-borde pt-3 text-center">
              {LIM.map(([k, t]) => (<div key={k}><dd className="num text-base font-bold text-tinta">{limiteTexto(p.limites[k])}</dd><dt className="text-xs text-suave">{t}</dt></div>))}
            </dl>
          </Tarjeta>))}
      </div>
      {cat.length > 0 && (
        <Tarjeta titulo="Catálogo de módulos" sub="Lo que se puede incluir en un plan o activar por empresa" className="mt-6">
          <ul className="grid gap-2 sm:grid-cols-2">
            {cat.map((m) => (
              <li key={m.clave} className="rounded-lg border border-borde px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2 font-semibold text-tinta">{m.nombre}{m.nucleo && <Chip tono="info" icono={<Lock className="size-3" aria-hidden />}>Núcleo</Chip>}{!m.disponible && <Chip>Próximamente</Chip>}</div>
                <p className="text-xs text-suave">{m.descripcion}{m.requiere.length > 0 && ` · Requiere: ${m.requiere.map(nombre).join(", ")}`}</p>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      <Modal abierto={!!edit} titulo={edit?.id ? "Editar plan" : "Nuevo plan"} onCerrar={() => setEdit(null)} sucio={!!edit && !edit.id && (edit.nombre !== "" || edit.clave !== "")}
        pie={<><Boton type="button" variante="secundario" onClick={() => setEdit(null)}>Cancelar</Boton><Boton type="submit" form="form-plan" cargando={guardando}>{guardando ? "Guardando…" : "Guardar plan"}</Boton></>}>
        {edit && <form id="form-plan" onSubmit={guardar} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombre"><Input data-autofocus required value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></Campo>
            <Campo etiqueta="Clave" ayuda="Minúsculas, sin espacios"><Input required pattern="[a-z0-9_\-]{2,40}" disabled={!!edit.id} value={edit.clave} onChange={(e) => setEdit({ ...edit, clave: e.target.value })} /></Campo>
          </div>
          <Campo etiqueta="Descripción"><Input value={edit.descripcion} onChange={(e) => setEdit({ ...edit, descripcion: e.target.value })} /></Campo>
          <fieldset><legend className="mb-2 text-sm font-semibold text-texto">Módulos incluidos</legend>
            <div className="grid gap-1.5 sm:grid-cols-2">{vendibles.map((m) => (
              <label key={m.clave} className={cx("flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm transition-colors duration-150", m.disponible ? "cursor-pointer border-borde hover:bg-marca-50" : "border-borde text-placeholder", edit.modulos.includes(m.clave) && "border-marca/40 bg-marca-50")}>
                <input type="checkbox" className="size-5 accent-[var(--marca-texto)]" disabled={!m.disponible} checked={edit.modulos.includes(m.clave)} onChange={() => alternar(m.clave)} /> {m.nombre}{!m.disponible && <span className="text-xs">(próximamente)</span>}</label>))}</div></fieldset>
          <div className="grid gap-3 sm:grid-cols-3">{LIM.map(([k, t]) => (<Campo key={k} etiqueta={`Máx. ${t.toLowerCase()}`} ayuda="Vacío = sin límite"><Input type="number" inputMode="numeric" min={1} value={edit.limites[k] ?? ""} onChange={(e) => setEdit({ ...edit, limites: { ...edit.limites, [k]: e.target.value } })} /></Campo>))}</div>
          <div className="grid gap-4 sm:grid-cols-2"><Campo etiqueta="Precio de referencia"><Input type="number" inputMode="numeric" min={0} value={edit.precio_ref} onChange={(e) => setEdit({ ...edit, precio_ref: Number(e.target.value) })} /></Campo>
            <label className="flex min-h-11 items-center gap-2 self-end text-sm"><input type="checkbox" className="size-5 accent-[var(--marca-texto)]" checked={edit.activo} onChange={(e) => setEdit({ ...edit, activo: e.target.checked })} /> Plan activo (se puede asignar)</label></div>
          {errModal && <Aviso tono="error">{errModal}</Aviso>}
        </form>}
      </Modal>
    </>
  );
}
