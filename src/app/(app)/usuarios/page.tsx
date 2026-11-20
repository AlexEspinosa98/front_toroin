"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { fechaHora, ROL_TEXTO } from "@/lib/format";
import { PermisosUsuario, type UsuarioPerm } from "@/components/PermisosUsuario";
import { Aviso, Boton, Campo, Input, Insignia, Modal, Select, Tabla, Titulo, useAviso } from "@/components/ui";

type U = UsuarioPerm & { correo: string; activo: boolean; ultimo_acceso: string | null };
const ROLES = ["admin", "gerencia", "rrhh", "sst", "residente"];

export default function Usuarios() {
  const { me, tieneModulo } = useSession();
  const aviso = useAviso();
  const [lista, setLista] = useState<U[] | null>(null);
  const [error, setError] = useState("");
  const [nuevo, setNuevo] = useState<{ nombre: string; correo: string; rol: string } | null>(null);
  const [permisos, setPermisos] = useState<U | null>(null);
  const [clave, setClave] = useState<{ correo: string; password: string } | null>(null);
  const puede = !me.solo_lectura && me.licencia?.escritura;

  const cargar = useCallback(() => api<U[]>("empresa/usuarios").then(setLista).catch((e) => setError(e.message)), []);
  useEffect(() => { if (tieneModulo("usuarios")) void cargar(); }, [cargar, tieneModulo]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevo) return;
    try {
      const r = await api<{ password_temporal: string }>("empresa/usuarios", { method: "POST", body: nuevo });
      setClave({ correo: nuevo.correo, password: r.password_temporal }); setNuevo(null); void cargar();
    } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo crear", "error"); }
  }
  async function cambiar(u: U, cambios: Partial<U>) {
    try { await api(`empresa/usuarios/${u.id}`, { method: "PATCH", body: cambios }); void cargar(); } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo actualizar", "error"); }
  }
  async function reiniciar(u: U) {
    if (!confirm(`¿Generar una contraseña temporal nueva para ${u.nombre}?`)) return;
    try { const r = await api<{ password_temporal: string }>(`empresa/usuarios/${u.id}/reiniciar-password`, { method: "POST" }); setClave({ correo: u.correo, password: r.password_temporal }); }
    catch (x) { aviso(x instanceof Error ? x.message : "No se pudo reiniciar", "error"); }
  }

  return (
    <>
      <Titulo sub="Cada rol trae sus módulos; usted puede darle o quitarle módulos y alertas a cada persona." acciones={puede && <Boton onClick={() => setNuevo({ nombre: "", correo: "", rol: "residente" })}>Nuevo usuario</Boton>}>Usuarios</Titulo>
      {error && <Aviso tono="error">{error}</Aviso>}
      {lista && (
        <Tabla cabeceras={["Nombre", "Rol", "Módulos", "Último acceso", "Estado", ""]}>
          {lista.map((u) => (
            <tr key={u.id}>
              <td className="px-3 py-3"><div className="font-medium">{u.nombre}</div><div className="text-xs text-slate-500">{u.correo}</div></td>
              <td className="px-3 py-3">
                {puede && u.id !== me.id ? <Select aria-label={`Rol de ${u.nombre}`} className="!min-h-9" value={u.rol} onChange={(e) => cambiar(u, { rol: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{ROL_TEXTO[r]}</option>)}</Select> : ROL_TEXTO[u.rol]}
              </td>
              <td className="px-3 py-3 text-xs">{u.rol === "admin" ? "Todos" : u.modulos_efectivos.length ? u.modulos_efectivos.join(", ") : "Ninguno"}{u.modulos && <Insignia tono="azul">Personalizado</Insignia>}</td>
              <td className="px-3 py-3">{fechaHora(u.ultimo_acceso)}</td>
              <td className="px-3 py-3"><Insignia tono={u.activo ? "verde" : "gris"}>{u.activo ? "Activo" : "Inactivo"}</Insignia></td>
              <td className="px-3 py-3 text-right whitespace-nowrap">{puede && u.id !== me.id && <>
                {u.rol !== "admin" && <Boton variante="fantasma" className="!min-h-9" onClick={() => setPermisos(u)}>Permisos</Boton>}
                <Boton variante="fantasma" className="!min-h-9" onClick={() => reiniciar(u)}>Reiniciar clave</Boton>
                <Boton variante="fantasma" className="!min-h-9" onClick={() => cambiar(u, { activo: !u.activo })}>{u.activo ? "Desactivar" : "Activar"}</Boton></>}</td>
            </tr>
          ))}
        </Tabla>
      )}
      <PermisosUsuario usuario={permisos} onCerrar={() => setPermisos(null)} onGuardado={() => void cargar()} />
      <Modal abierto={!!nuevo} titulo="Nuevo usuario" onCerrar={() => setNuevo(null)}>
        <form onSubmit={crear} className="space-y-4">
          <Campo etiqueta="Nombre"><Input required minLength={2} value={nuevo?.nombre ?? ""} onChange={(e) => setNuevo({ ...nuevo!, nombre: e.target.value })} /></Campo>
          <Campo etiqueta="Correo"><Input type="email" required value={nuevo?.correo ?? ""} onChange={(e) => setNuevo({ ...nuevo!, correo: e.target.value })} /></Campo>
          <Campo etiqueta="Rol"><Select value={nuevo?.rol} onChange={(e) => setNuevo({ ...nuevo!, rol: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{ROL_TEXTO[r]}</option>)}</Select></Campo>
          <div className="flex justify-end gap-2"><Boton type="button" variante="secundario" onClick={() => setNuevo(null)}>Cancelar</Boton><Boton type="submit">Crear</Boton></div>
        </form>
      </Modal>
      <Modal abierto={!!clave} titulo="Contraseña temporal" onCerrar={() => setClave(null)}>
        <div className="space-y-3">
          <Aviso tono="alerta">Cópiela y entréguela ahora: <strong>no se volverá a mostrar</strong>. La persona deberá cambiarla al ingresar.</Aviso>
          <p className="text-sm">Usuario: <strong>{clave?.correo}</strong></p>
          <div className="flex items-center gap-2"><code className="flex-1 rounded-lg bg-slate-100 px-3 py-3 text-base font-semibold">{clave?.password}</code>
            <Boton variante="secundario" onClick={() => { void navigator.clipboard?.writeText(clave?.password ?? ""); aviso("Copiada"); }}>Copiar</Boton></div>
        </div>
      </Modal>
    </>
  );
}
