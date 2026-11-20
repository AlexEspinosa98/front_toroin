"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import Link from "next/link";
import { Aviso, Boton, Campo, Input, Insignia, Modal, Select, Tabla, Titulo, Vacio, useAviso } from "@/components/ui";

type Obra = { id: string; nombre: string; ciudad: string; estado: string };

export default function Obras() {
  const { me, tieneModulo } = useSession();
  const aviso = useAviso();
  const [obras, setObras] = useState<Obra[] | null>(null);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<Partial<Obra> | null>(null);
  const puedeEscribir = !me.solo_lectura && me.licencia?.escritura && ["admin", "gerencia", "super_admin"].includes(me.rol);

  const cargar = useCallback(() => api<Obra[]>("obras").then(setObras).catch((e) => setError(e.message)), []);
  useEffect(() => { if (tieneModulo("obras")) void cargar(); }, [cargar, tieneModulo]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    try {
      const body = { nombre: edit.nombre ?? "", ciudad: edit.ciudad ?? "", estado: edit.estado ?? "activa" };
      if (edit.id) await api(`obras/${edit.id}`, { method: "PUT", body }); else await api("obras", { method: "POST", body });
      setEdit(null); aviso("Obra guardada"); void cargar();
    } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo guardar", "error"); }
  }
  async function borrar(o: Obra) {
    if (!confirm(`¿Eliminar la obra «${o.nombre}»? Esta acción no se puede deshacer.`)) return;
    try { await api(`obras/${o.id}`, { method: "DELETE" }); aviso("Obra eliminada"); void cargar(); } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo eliminar", "error"); }
  }

  return (
    <>
      <Titulo acciones={puedeEscribir && <Boton onClick={() => setEdit({ estado: "activa" })}>Nueva obra</Boton>}>Obras</Titulo>
      {error && <Aviso tono="error">{error}</Aviso>}
      {obras && (obras.length === 0 ? <Vacio>Aún no hay obras registradas.</Vacio> : (
        <Tabla cabeceras={["Obra", "Ciudad", "Estado", ""]}>
          {obras.map((o) => (
            <tr key={o.id}>
              <td className="px-3 py-3 font-medium">{o.nombre}</td><td className="px-3 py-3">{o.ciudad || "—"}</td>
              <td className="px-3 py-3"><Insignia tono={o.estado === "activa" ? "verde" : o.estado === "pausada" ? "ambar" : "gris"}>{o.estado}</Insignia></td>
              <td className="px-3 py-3 text-right whitespace-nowrap">{tieneModulo("contrato") && <Link href={`/obras/${o.id}`} className="mr-2 inline-flex min-h-9 items-center rounded-lg px-3 text-sm font-semibold text-marca hover:bg-slate-100">Tablero</Link>}{puedeEscribir && <><Boton variante="fantasma" className="!min-h-9" onClick={() => setEdit(o)}>Editar</Boton><Boton variante="fantasma" className="!min-h-9 !text-red-700" onClick={() => borrar(o)}>Eliminar</Boton></>}</td>
            </tr>
          ))}
        </Tabla>
      ))}
      <Modal abierto={!!edit} titulo={edit?.id ? "Editar obra" : "Nueva obra"} onCerrar={() => setEdit(null)}>
        <form onSubmit={guardar} className="space-y-4">
          <Campo etiqueta="Nombre"><Input required minLength={2} value={edit?.nombre ?? ""} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></Campo>
          <Campo etiqueta="Ciudad"><Input value={edit?.ciudad ?? ""} onChange={(e) => setEdit({ ...edit, ciudad: e.target.value })} /></Campo>
          <Campo etiqueta="Estado">
            <Select value={edit?.estado ?? "activa"} onChange={(e) => setEdit({ ...edit, estado: e.target.value })}>
              <option value="activa">Activa</option><option value="pausada">Pausada</option><option value="terminada">Terminada</option>
            </Select>
          </Campo>
          <div className="flex justify-end gap-2"><Boton type="button" variante="secundario" onClick={() => setEdit(null)}>Cancelar</Boton><Boton type="submit">Guardar</Boton></div>
        </form>
      </Modal>
    </>
  );
}
