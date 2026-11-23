"use client";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Copy, KeyRound, Plus, Power, SearchX, ShieldCheck, UserPlus, Users } from "lucide-react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { fechaHora, ROL_TEXTO } from "@/lib/format";
import { PermisosUsuario, type UsuarioPerm } from "@/components/PermisosUsuario";
import { Aviso, Boton, BotonIcono, Buscador, Campo, Chip, cx, Esqueleto, Input, Modal, Select, Tabla, Titulo, Vacio, useAviso, useConfirmar } from "@/components/ui";

type U = UsuarioPerm & { correo: string; activo: boolean; ultimo_acceso: string | null };
const ROLES = ["admin", "gerencia", "rrhh", "sst", "residente"];

const Avatar = ({ nombre, activo }: { nombre: string; activo: boolean }) => (
  <span aria-hidden className={cx("grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold", activo ? "bg-marca-100 text-marca-texto" : "bg-fondo text-placeholder")}>{(nombre.trim()[0] ?? "?").toUpperCase()}</span>
);

export default function Usuarios() {
  const { me, tieneModulo } = useSession();
  const aviso = useAviso();
  const confirmar = useConfirmar();
  const [lista, setLista] = useState<U[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [nuevo, setNuevo] = useState<{ nombre: string; correo: string; rol: string } | null>(null);
  const [permisos, setPermisos] = useState<U | null>(null);
  const [clave, setClave] = useState<{ correo: string; password: string } | null>(null);
  const [creando, setCreando] = useState(false);
  const puede = !me.solo_lectura && me.licencia?.escritura;

  const cargar = useCallback(() => api<U[]>("empresa/usuarios").then(setLista).catch((e) => setError(e.message)), []);
  useEffect(() => { if (tieneModulo("usuarios")) void cargar(); }, [cargar, tieneModulo]);
  const visibles = useMemo(() => (lista ?? []).filter((u) => `${u.nombre} ${u.correo}`.toLowerCase().includes(q.toLowerCase())), [lista, q]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevo) return;
    setCreando(true);
    try {
      const r = await api<{ password_temporal: string }>("empresa/usuarios", { method: "POST", body: nuevo });
      setClave({ correo: nuevo.correo, password: r.password_temporal }); setNuevo(null); void cargar();
    } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo crear", "error"); }
    finally { setCreando(false); }
  }
  async function cambiar(u: U, cambios: Partial<U>) {
    try { await api(`empresa/usuarios/${u.id}`, { method: "PATCH", body: cambios }); void cargar(); } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo actualizar", "error"); }
  }
  async function reiniciar(u: U) {
    if (!(await confirmar({ titulo: `¿Nueva contraseña para ${u.nombre}?`, texto: "Se genera una contraseña temporal y la actual deja de funcionar.", aceptar: "Generar" }))) return;
    try { const r = await api<{ password_temporal: string }>(`empresa/usuarios/${u.id}/reiniciar-password`, { method: "POST" }); setClave({ correo: u.correo, password: r.password_temporal }); }
    catch (x) { aviso(x instanceof Error ? x.message : "No se pudo reiniciar", "error"); }
  }

  // Lista completa de módulos (celular) y resumen con la lista en el tooltip (escritorio, donde el ancho es corto)
  const textoModulos = (u: U) => (u.rol === "admin" ? "Todos los módulos" : u.modulos_efectivos.length ? u.modulos_efectivos.join(", ") : "Ningún módulo");
  const modulos = (u: U): ReactNode => <>{textoModulos(u)}{u.modulos && <> <Chip tono="info">Personalizado</Chip></>}</>;
  const resumenModulos = (u: U): ReactNode => (
    <span title={textoModulos(u)} className="flex flex-wrap items-center gap-1.5">
      <span className="font-medium text-tinta">{u.rol === "admin" ? "Todos" : `${u.modulos_efectivos.length} ${u.modulos_efectivos.length === 1 ? "módulo" : "módulos"}`}</span>
      {u.modulos && <Chip tono="info">Personalizado</Chip>}
    </span>
  );
  const rol = (u: U): ReactNode => (
    puede && u.id !== me.id
      ? <Select aria-label={`Rol de ${u.nombre}`} className="pointer-fine:min-h-9 md:w-44" value={u.rol} onChange={(e) => cambiar(u, { rol: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{ROL_TEXTO[r]}</option>)}</Select>
      : <span className="font-medium text-tinta">{ROL_TEXTO[u.rol]}</span>
  );
  const hayAcciones = (u: U) => !!puede && u.id !== me.id;
  const acciones = (u: U): ReactNode => (
    <>
      {u.rol !== "admin" && <Boton variante="fantasma" tam="sm" icono={<ShieldCheck className="size-4" aria-hidden />} onClick={() => setPermisos(u)}>Permisos</Boton>}
      <Boton variante="fantasma" tam="sm" icono={<KeyRound className="size-4" aria-hidden />} onClick={() => reiniciar(u)}>Reiniciar clave</Boton>
      <Boton variante="fantasma" tam="sm" icono={<Power className="size-4" aria-hidden />} onClick={() => cambiar(u, { activo: !u.activo })}>{u.activo ? "Desactivar" : "Activar"}</Boton>
    </>
  );
  // En la tabla de escritorio las acciones son solo íconos (con nombre accesible y tooltip) para que quepan
  const accionesIcono = (u: U): ReactNode => (
    <span className="inline-flex">
      {u.rol !== "admin" && <BotonIcono etiqueta={`Permisos de ${u.nombre}`} className="pointer-fine:size-9" onClick={() => setPermisos(u)}><ShieldCheck className="size-5" aria-hidden /></BotonIcono>}
      <BotonIcono etiqueta={`Reiniciar la clave de ${u.nombre}`} className="pointer-fine:size-9" onClick={() => reiniciar(u)}><KeyRound className="size-5" aria-hidden /></BotonIcono>
      <BotonIcono etiqueta={`${u.activo ? "Desactivar" : "Activar"} a ${u.nombre}`} className="pointer-fine:size-9" onClick={() => cambiar(u, { activo: !u.activo })}><Power className="size-5" aria-hidden /></BotonIcono>
    </span>
  );
  const abrirNuevo = () => setNuevo({ nombre: "", correo: "", rol: "residente" });

  return (
    <>
      <Titulo sub="Cada rol trae sus módulos; usted puede darle o quitarle módulos y alertas a cada persona."
        acciones={puede && <Boton icono={<Plus className="size-4" aria-hidden />} onClick={abrirNuevo}>Nuevo usuario</Boton>}>Usuarios</Titulo>
      {error && <Aviso tono="error">{error}</Aviso>}
      {!lista && !error && <div className="space-y-3">{[0, 1, 2].map((i) => <Esqueleto key={i} className="h-16" />)}</div>}
      {lista && lista.length > 0 && <Buscador className="mb-4 max-w-sm" etiqueta="Buscar por nombre o correo" valor={q} onChange={setQ} />}
      {lista && lista.length === 0 && (
        <Vacio icono={<Users className="size-6" aria-hidden />} titulo="Aún no hay usuarios" texto="Cree el primero y entréguele su contraseña temporal."
          accion={puede ? <Boton icono={<UserPlus className="size-4" aria-hidden />} onClick={abrirNuevo}>Nuevo usuario</Boton> : undefined} />
      )}
      {lista && lista.length > 0 && visibles.length === 0 && <Vacio icono={<SearchX className="size-6" aria-hidden />} titulo="Sin resultados" texto="Pruebe con otro nombre o correo." />}

      {visibles.length > 0 && (
        <>
          {/* Celular: una tarjeta por persona */}
          <ul className="space-y-3 md:hidden">
            {visibles.map((u) => (
              <li key={u.id} className="rounded-xl border border-borde bg-white p-4">
                <div className="flex items-start gap-3">
                  <Avatar nombre={u.nombre} activo={u.activo} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-tinta">{u.nombre}</p>
                    <p className="truncate text-xs text-suave">{u.correo}</p>
                  </div>
                  <Chip tono={u.activo ? "ok" : "neutro"}>{u.activo ? "Activo" : "Inactivo"}</Chip>
                </div>
                <div className="mt-3">{rol(u)}</div>
                <p className="mt-2 text-xs text-suave">{modulos(u)}</p>
                <p className="mt-1 text-xs text-suave">Último acceso: {fechaHora(u.ultimo_acceso)}</p>
                {hayAcciones(u) && <div className="-mx-2 mt-2 flex flex-wrap border-t border-borde pt-2">{acciones(u)}</div>}
              </li>
            ))}
          </ul>

          {/* Escritorio: tabla */}
          <div className="hidden md:block">
            <Tabla cabeceras={["Nombre", "Rol", "Módulos", "Estado", ""]}>
              {visibles.map((u) => (
                <tr key={u.id}>
                  <td className="px-3 py-3"><div className="flex items-center gap-3"><Avatar nombre={u.nombre} activo={u.activo} /><div className="min-w-0"><div className="font-semibold text-tinta">{u.nombre}</div><div className="text-xs text-suave">{u.correo}</div><div className="text-xs text-suave">Último acceso: {fechaHora(u.ultimo_acceso)}</div></div></div></td>
                  <td className="px-3 py-3">{rol(u)}</td>
                  <td className="px-3 py-3 text-sm">{resumenModulos(u)}</td>
                  <td className="px-3 py-3"><Chip tono={u.activo ? "ok" : "neutro"}>{u.activo ? "Activo" : "Inactivo"}</Chip></td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">{hayAcciones(u) && accionesIcono(u)}</td>
                </tr>
              ))}
            </Tabla>
          </div>
        </>
      )}

      <PermisosUsuario usuario={permisos} onCerrar={() => setPermisos(null)} onGuardado={() => void cargar()} />
      <Modal abierto={!!nuevo} titulo="Nuevo usuario" onCerrar={() => setNuevo(null)} sucio={!!nuevo && (nuevo.nombre !== "" || nuevo.correo !== "")}
        pie={<><Boton type="button" variante="secundario" onClick={() => setNuevo(null)}>Cancelar</Boton><Boton type="submit" form="form-nuevo-usuario" cargando={creando}>{creando ? "Creando…" : "Crear usuario"}</Boton></>}>
        <form id="form-nuevo-usuario" onSubmit={crear} className="space-y-4">
          <Campo etiqueta="Nombre"><Input data-autofocus required minLength={2} value={nuevo?.nombre ?? ""} onChange={(e) => setNuevo({ ...nuevo!, nombre: e.target.value })} autoComplete="off" /></Campo>
          <Campo etiqueta="Correo"><Input type="email" required value={nuevo?.correo ?? ""} onChange={(e) => setNuevo({ ...nuevo!, correo: e.target.value })} autoComplete="off" /></Campo>
          <Campo etiqueta="Rol" ayuda="Después podrá darle o quitarle módulos desde «Permisos»."><Select value={nuevo?.rol} onChange={(e) => setNuevo({ ...nuevo!, rol: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{ROL_TEXTO[r]}</option>)}</Select></Campo>
        </form>
      </Modal>
      <Modal abierto={!!clave} titulo="Contraseña temporal" onCerrar={() => setClave(null)}
        pie={<Boton onClick={() => setClave(null)}>Listo, ya la copié</Boton>}>
        <div className="space-y-3">
          <Aviso tono="alerta">Cópiela y entréguela ahora: <strong>no se volverá a mostrar</strong>. La persona deberá cambiarla al ingresar.</Aviso>
          <p className="text-sm">Usuario: <strong className="break-all">{clave?.correo}</strong></p>
          <div className="flex items-center gap-2"><code className="num min-w-0 flex-1 break-all rounded-lg bg-fondo px-3 py-3 text-base font-semibold text-tinta">{clave?.password}</code>
            <Boton variante="secundario" icono={<Copy className="size-4" aria-hidden />} onClick={() => { void navigator.clipboard?.writeText(clave?.password ?? ""); aviso("Copiada"); }}>Copiar</Boton></div>
        </div>
      </Modal>
    </>
  );
}
