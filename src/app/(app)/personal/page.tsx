"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { fecha } from "@/lib/format";
import { Aviso, Boton, Campo, Input, Insignia, Modal, Tabla, Titulo, Vacio, useAviso } from "@/components/ui";

type T = {
  id: string; nombre: string; cedula: string; cargo: string; telefono: string;
  examen_fecha: string | null; examen_vence: string | null; alturas_fecha: string | null; alturas_vence: string | null; jornal: number | null; notas: string[];
};

// Habilitación SST: examen médico y curso de alturas vigentes (alerta a 30 días)
function habilitacion(t: T): { tono: "verde" | "ambar" | "rojo" | "gris"; texto: string } {
  if (!t.examen_vence || !t.alturas_vence) return { tono: "gris", texto: "Faltan fechas" };
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const d = (s: string) => Math.round((new Date(s + "T00:00:00").getTime() - hoy.getTime()) / 86400000);
  const min = Math.min(d(t.examen_vence), d(t.alturas_vence));
  if (min < 0) return { tono: "rojo", texto: "Vencido" };
  if (min <= 30) return { tono: "ambar", texto: `Vence en ${min} d` };
  return { tono: "verde", texto: "Habilitado" };
}
const vacio = (): Partial<T> => ({ nombre: "", cedula: "", cargo: "", telefono: "", examen_fecha: null, examen_vence: null, alturas_fecha: null, alturas_vence: null, jornal: null, notas: [] });

export default function Personal() {
  const { me, tieneModulo } = useSession();
  const aviso = useAviso();
  const [lista, setLista] = useState<T[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Partial<T> | null>(null);
  const puedeEscribir = !me.solo_lectura && me.licencia?.escritura && ["admin", "gerencia", "rrhh", "super_admin"].includes(me.rol);

  const cargar = useCallback(() => api<T[]>("personal").then(setLista).catch((e) => setError(e.message)), []);
  useEffect(() => { if (tieneModulo("personal")) void cargar(); }, [cargar, tieneModulo]);
  const filtrada = useMemo(() => (lista ?? []).filter((t) => `${t.nombre} ${t.cedula} ${t.cargo}`.toLowerCase().includes(q.toLowerCase())), [lista, q]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const { id, ...resto } = edit;
    const body = { ...resto, jornal: resto.jornal || null };
    try {
      if (id) await api(`personal/${id}`, { method: "PUT", body }); else await api("personal", { method: "POST", body });
      setEdit(null); aviso("Trabajador guardado"); void cargar();
    } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo guardar", "error"); }
  }
  async function borrar(t: T) {
    if (!confirm(`¿Eliminar a ${t.nombre}? Esta acción no se puede deshacer.`)) return;
    try { await api(`personal/${t.id}`, { method: "DELETE" }); aviso("Trabajador eliminado"); void cargar(); } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo eliminar", "error"); }
  }
  const set = <K extends keyof T>(k: K, v: T[K] | null) => setEdit((x) => ({ ...x, [k]: v }));
  const fechaCampo = (etiqueta: string, k: "examen_fecha" | "examen_vence" | "alturas_fecha" | "alturas_vence") => (
    <Campo etiqueta={etiqueta}><Input type="date" value={edit?.[k] ?? ""} onChange={(e) => set(k, e.target.value || null)} /></Campo>
  );

  return (
    <>
      <Titulo acciones={puedeEscribir && <Boton onClick={() => setEdit(vacio())}>Nuevo trabajador</Boton>}>Personal</Titulo>
      <div className="mb-4 max-w-sm"><Input placeholder="Buscar por nombre, cédula o cargo" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" /></div>
      {error && <Aviso tono="error">{error}</Aviso>}
      {lista && (filtrada.length === 0 ? <Vacio>{lista.length ? "Sin resultados." : "Aún no hay trabajadores registrados."}</Vacio> : (
        <Tabla cabeceras={["Nombre", "Cédula", "Cargo", "Examen vence", "Alturas vence", "SST", ""]}>
          {filtrada.map((t) => { const h = habilitacion(t); return (
            <tr key={t.id}>
              <td className="px-3 py-3 font-medium">{t.nombre}</td><td className="px-3 py-3">{t.cedula || "—"}</td><td className="px-3 py-3">{t.cargo || "—"}</td>
              <td className="px-3 py-3">{fecha(t.examen_vence)}</td><td className="px-3 py-3">{fecha(t.alturas_vence)}</td>
              <td className="px-3 py-3"><Insignia tono={h.tono}>{h.texto}</Insignia></td>
              <td className="px-3 py-3 text-right whitespace-nowrap">{puedeEscribir && <><Boton variante="fantasma" className="!min-h-9" onClick={() => setEdit(t)}>Editar</Boton><Boton variante="fantasma" className="!min-h-9 !text-red-700" onClick={() => borrar(t)}>Eliminar</Boton></>}</td>
            </tr>); })}
        </Tabla>
      ))}
      <Modal abierto={!!edit} titulo={edit?.id ? "Editar trabajador" : "Nuevo trabajador"} onCerrar={() => setEdit(null)}>
        <form onSubmit={guardar} className="space-y-4">
          <Campo etiqueta="Nombre completo"><Input required minLength={2} value={edit?.nombre ?? ""} onChange={(e) => set("nombre", e.target.value)} /></Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Cédula"><Input value={edit?.cedula ?? ""} onChange={(e) => set("cedula", e.target.value)} /></Campo>
            <Campo etiqueta="Teléfono"><Input value={edit?.telefono ?? ""} onChange={(e) => set("telefono", e.target.value)} /></Campo>
            <Campo etiqueta="Cargo"><Input value={edit?.cargo ?? ""} onChange={(e) => set("cargo", e.target.value)} /></Campo>
            <Campo etiqueta="Jornal (valor del día)"><Input type="number" min={0} value={edit?.jornal ?? ""} onChange={(e) => set("jornal", e.target.value ? Number(e.target.value) : null)} /></Campo>
            {fechaCampo("Examen médico: fecha", "examen_fecha")}{fechaCampo("Examen médico: vence", "examen_vence")}
            {fechaCampo("Curso de alturas: fecha", "alturas_fecha")}{fechaCampo("Curso de alturas: vence", "alturas_vence")}
          </div>
          <div className="flex justify-end gap-2"><Boton type="button" variante="secundario" onClick={() => setEdit(null)}>Cancelar</Boton><Boton type="submit">Guardar</Boton></div>
        </form>
      </Modal>
    </>
  );
}
