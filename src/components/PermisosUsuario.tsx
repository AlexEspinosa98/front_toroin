"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { Aviso, Boton, Modal, useAviso } from "./ui";

export type UsuarioPerm = { id: string; nombre: string; rol: string; modulos: string[] | null; alertas: string[] | null; modulos_efectivos: string[] };
type Cat = { modulos: { clave: string; nombre: string; descripcion: string; requiere: string[]; roles: string[] }[]; alertas: { clave: string; nombre: string }[] };

export function PermisosUsuario({ usuario, onCerrar, onGuardado }: { usuario: UsuarioPerm | null; onCerrar: () => void; onGuardado: () => void }) {
  const aviso = useAviso();
  const [cat, setCat] = useState<Cat | null>(null);
  const [error, setError] = useState("");
  const [porRol, setPorRol] = useState(true);
  const [mods, setMods] = useState<Set<string>>(new Set());
  const [alAuto, setAlAuto] = useState(true);
  const [als, setAls] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { api<Cat>("empresa/permisos").then(setCat).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    if (!usuario || !cat) return;
    setPorRol(usuario.modulos === null);
    setMods(new Set(usuario.modulos ?? usuario.modulos_efectivos));
    setAlAuto(usuario.alertas === null);
    setAls(new Set(usuario.alertas ?? [...usuario.modulos_efectivos, ...(usuario.rol === "admin" ? ["licencia"] : [])]));
  }, [usuario, cat]);

  const porRolDefecto = useMemo(() => new Set(cat?.modulos.filter((m) => usuario && m.roles.includes(usuario.rol)).map((m) => m.clave) ?? []), [cat, usuario]);

  function alternar(clave: string, on: boolean) {
    if (!cat) return;
    setPorRol(false);
    setMods((prev) => {
      const s = new Set(prev);
      if (on) {
        const agregar = (k: string) => { s.add(k); cat.modulos.find((m) => m.clave === k)?.requiere.forEach((r) => { if (!s.has(r) && cat.modulos.some((m) => m.clave === r)) agregar(r); }); };
        agregar(clave);
      } else {
        const quitar = (k: string) => { s.delete(k); cat.modulos.filter((m) => m.requiere.includes(k) && s.has(m.clave)).forEach((m) => quitar(m.clave)); };
        quitar(clave);
      }
      return s;
    });
  }
  const volverRol = () => { setPorRol(true); setMods(new Set(porRolDefecto)); };

  async function guardar() {
    if (!usuario) return;
    setGuardando(true);
    try {
      await api(`empresa/usuarios/${usuario.id}`, { method: "PATCH", body: { modulos: porRol ? null : [...mods], alertas: alAuto ? null : [...als] } });
      aviso("Permisos guardados"); onGuardado(); onCerrar();
    } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo guardar", "error"); }
    finally { setGuardando(false); }
  }

  const casilla = "size-5 accent-[var(--primario)]";
  return (
    <Modal abierto={!!usuario} titulo={`Permisos de ${usuario?.nombre ?? ""}`} onCerrar={onCerrar}>
      {error && <Aviso tono="error">{error}</Aviso>}
      {cat && usuario && (
        <div className="space-y-5">
          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Qué módulos puede usar</h3>
              <Boton variante="fantasma" className="!min-h-8 !text-xs" onClick={volverRol} disabled={porRol}>Usar los de su rol</Boton>
            </div>
            {porRol && <p className="mb-2 text-xs text-slate-500">Hoy tiene los módulos que trae su rol. Marque o desmarque para personalizar.</p>}
            <ul className="space-y-1">
              {cat.modulos.map((m) => (
                <li key={m.clave}>
                  <label className="flex min-h-11 items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                    <input type="checkbox" className={`${casilla} mt-0.5`} checked={mods.has(m.clave)} onChange={(e) => alternar(m.clave, e.target.checked)} />
                    <span className="text-sm"><strong>{m.nombre}</strong>{porRolDefecto.has(m.clave) && <span className="ml-2 text-xs text-slate-400">viene con su rol</span>}
                      <span className="block text-xs text-slate-500">{m.descripcion}{m.requiere.length ? ` · necesita ${m.requiere.map((r) => cat.modulos.find((x) => x.clave === r)?.nombre ?? r).join(", ")}` : ""}</span></span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">Un módulo asignado aquí se puede usar completo (ver y registrar). Solo ve lo que su empresa tiene contratado.</p>
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold">De qué módulos recibe alertas</h3>
            <label className="flex min-h-11 items-center gap-3 px-2 text-sm"><input type="checkbox" className={casilla} checked={alAuto} onChange={(e) => setAlAuto(e.target.checked)} />De todos los módulos que ve</label>
            {!alAuto && (
              <ul className="ml-2 space-y-1 border-l border-slate-200 pl-3">
                {cat.alertas.filter((a) => a.clave === "licencia" || mods.has(a.clave)).map((a) => (
                  <li key={a.clave}><label className="flex min-h-10 items-center gap-3 text-sm"><input type="checkbox" className={casilla} checked={als.has(a.clave)}
                    onChange={(e) => setAls((p) => { const s = new Set(p); if (e.target.checked) s.add(a.clave); else s.delete(a.clave); return s; })} />{a.nombre}</label></li>
                ))}
              </ul>
            )}
          </section>
          <div className="flex justify-end gap-2"><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar permisos"}</Boton></div>
        </div>
      )}
    </Modal>
  );
}
