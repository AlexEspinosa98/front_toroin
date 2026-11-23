"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, ChevronRight, Info, Trash2, Upload, UserPlus, Users } from "lucide-react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { fechaCorta, fmtCOP } from "@/lib/format";
import { hoy } from "@/lib/fechas";
import { habilitacion, type EstadoHab } from "@/lib/habilitacion";
import { leerExcelPersonal } from "@/lib/excel";
import { useObras } from "@/lib/obras";
import { Aviso, Boton, Buscador, Campo, Chip, cx, Esqueleto, Input, Modal, Segmentado, Select, Titulo, Vacio, useAviso, useConfirmar } from "@/components/ui";
import { ChipHabilitacion } from "@/components/comunes";

type Asig = { id: string; trabajador_id: string; obra_id: string; fecha_ingreso: string; fecha_retiro: string | null };
type T = {
  id: string; nombre: string; cedula: string; cargo: string; telefono: string;
  examen_fecha: string | null; examen_vence: string | null; alturas_fecha: string | null; alturas_vence: string | null; jornal: number | null; notas: string[];
};
const JORNAL_MINIMO = 58364; // referencia visual; el servidor valida el mínimo legal vigente

const vacio = (): Partial<T> => ({ nombre: "", cedula: "", cargo: "", telefono: "", examen_fecha: null, examen_vence: null, alturas_fecha: null, alturas_vence: null, jornal: null, notas: [] });
const titulo = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());

/** Días que faltan para el vencimiento; el color y el texto avisan sin depender solo del color */
function Dias({ d, vence }: { d?: number; vence?: string | null }) {
  if (d === undefined) return <span className="text-suave">{vence ? fechaCorta(vence) : "—"}</span>;
  const c = d < 0 ? "font-bold text-error" : d <= 30 ? "font-bold text-alerta" : "text-texto";
  return (
    <span className="num">
      <span className={c}>{d < 0 ? `Vencido (${-d} d)` : `${d} días`}</span>
      <span className="block text-xs text-suave">{fechaCorta(vence)}</span>
    </span>
  );
}

export default function Personal() {
  const { me, tieneModulo } = useSession();
  const aviso = useAviso();
  const confirmar = useConfirmar();
  const { obras } = useObras({ todas: true });
  const [lista, setLista] = useState<T[] | null>(null);
  const [asigs, setAsigs] = useState<Asig[]>([]);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [obraF, setObraF] = useState("");
  const [estadoF, setEstadoF] = useState<"todos" | EstadoHab>("todos");
  const [edit, setEdit] = useState<Partial<T> | null>(null);
  const [inicial, setInicial] = useState("");
  const [asig, setAsig] = useState({ obraId: "", fecha: hoy() });
  const [importando, setImportando] = useState<{ hecho: number; total: number } | null>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const puedeEscribir = !me.solo_lectura && me.licencia?.escritura && ["admin", "gerencia", "rrhh", "super_admin"].includes(me.rol);

  const cargar = useCallback(() => api<T[]>("personal").then(setLista).catch((e) => setError(e.message)), []);
  const cargarAsig = useCallback(() => { api<Asig[]>("asignaciones").then(setAsigs).catch(() => {}); }, []);
  useEffect(() => { if (tieneModulo("personal")) { void cargar(); void cargarAsig(); } }, [cargar, cargarAsig, tieneModulo]);

  const nombreObra = (id: string) => obras.find((o) => o.id === id)?.nombre ?? "—";
  const vigentes = useCallback((tid: string) => asigs.filter((a) => a.trabajador_id === tid && !a.fecha_retiro), [asigs]);
  const filas = useMemo(() => (lista ?? []).map((t) => ({ t, h: habilitacion(t), as: vigentes(t.id) })), [lista, vigentes]);
  const cuenta = (e: EstadoHab) => filas.filter((f) => f.h.estado === e).length;
  const visibles = filas.filter((f) =>
    (!q || `${f.t.nombre} ${f.t.cedula} ${f.t.cargo}`.toLowerCase().includes(q.toLowerCase())) &&
    (!obraF || f.as.some((a) => a.obra_id === obraF)) && (estadoF === "todos" || f.h.estado === estadoF));

  const abrir = (t: Partial<T>) => { setEdit({ ...t }); setInicial(JSON.stringify(t)); setAsig({ obraId: "", fecha: hoy() }); };
  const sucio = !!edit && JSON.stringify(edit) !== inicial;
  const set = <K extends keyof T>(k: K, v: T[K] | null) => setEdit((x) => ({ ...x, [k]: v }));
  const fechaCampo = (etiqueta: string, k: "examen_fecha" | "examen_vence" | "alturas_fecha" | "alturas_vence") => (
    <Campo etiqueta={etiqueta}><Input type="date" value={edit?.[k] ?? ""} onChange={(e) => set(k, e.target.value || null)} /></Campo>
  );

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!edit?.nombre?.trim()) return;
    const { id, ...resto } = edit;
    const body = { ...resto, nombre: titulo(edit.nombre.trim()), jornal: resto.jornal || null };
    try {
      if (id) await api(`personal/${id}`, { method: "PUT", body });
      else {
        const nuevo = await api<T>("personal", { method: "POST", body });
        if (asig.obraId) await api("asignaciones", { method: "POST", body: { trabajador_id: nuevo.id, obra_id: asig.obraId, fecha_ingreso: asig.fecha } });
      }
      setEdit(null); aviso("Trabajador guardado"); void cargar(); void cargarAsig();
    } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo guardar", "error"); }
  }
  async function borrar(t: Partial<T>) {
    if (!t.id || !(await confirmar({ titulo: `¿Eliminar a ${t.nombre}?`, texto: "Esta acción no se puede deshacer.", aceptar: "Eliminar", peligro: true }))) return;
    try { await api(`personal/${t.id}`, { method: "DELETE" }); setEdit(null); aviso("Trabajador eliminado"); void cargar(); void cargarAsig(); }
    catch (x) { aviso(x instanceof Error ? x.message : "No se pudo eliminar", "error"); }
  }
  async function asignar() {
    if (!edit?.id || !asig.obraId) return;
    try { await api("asignaciones", { method: "POST", body: { trabajador_id: edit.id, obra_id: asig.obraId, fecha_ingreso: asig.fecha } }); setAsig({ obraId: "", fecha: hoy() }); aviso("Asignado a la obra"); void cargarAsig(); }
    catch (x) { aviso(x instanceof Error ? x.message : "No se pudo asignar", "error"); }
  }
  async function retirar(a: Asig) {
    if (!(await confirmar({ titulo: `¿Retirar de ${nombreObra(a.obra_id)}?`, texto: "Dejará de aparecer en la asistencia de esa obra desde hoy. El historial se conserva.", aceptar: "Retirar", peligro: true }))) return;
    try { await api(`asignaciones/${a.id}/retiro`, { method: "PATCH", body: { fecha_retiro: hoy() } }); aviso("Retiro registrado"); void cargarAsig(); }
    catch (x) { aviso(x instanceof Error ? x.message : "No se pudo retirar", "error"); }
  }

  /** Importa el Excel de la base TOROIN: crea o actualiza (por nombre) y asigna a la obra indicada si existe */
  async function importar(file?: File) {
    if (!file || !lista) return;
    try {
      const filasX = await leerExcelPersonal(file);
      if (!filasX.length) return aviso("No se encontraron filas válidas en el Excel.", "error");
      if (!(await confirmar({ titulo: `¿Importar ${filasX.length} filas del Excel?`, texto: "Se crean los trabajadores nuevos y se actualizan las fechas de examen y alturas de los que ya existen (se comparan por nombre). Si la obra del Excel existe, también se asignan a ella.", aceptar: "Importar" }))) return;
      const porNombre = new Map(lista.map((t) => [t.nombre.toLowerCase(), t]));
      const asignados = new Set(asigs.filter((a) => !a.fecha_retiro).map((a) => `${a.trabajador_id}|${a.obra_id}`));
      let nuevos = 0, actualizados = 0, nAsig = 0, fallos = 0, seguidos = 0, primerError = "";
      setImportando({ hecho: 0, total: filasX.length });
      for (const [i, r] of filasX.entries()) {
        try {
          const nombre = titulo(r.nombre.replace(/\s+/g, " "));
          const ex = porNombre.get(nombre.toLowerCase());
          const body = {
            nombre, cedula: ex?.cedula ?? "", cargo: ex?.cargo ?? "", telefono: ex?.telefono ?? "", jornal: ex?.jornal ?? null, notas: ex?.notas ?? [],
            examen_fecha: r.examen_fecha ?? ex?.examen_fecha ?? null, examen_vence: r.examen_vence ?? ex?.examen_vence ?? null,
            alturas_fecha: r.alturas_fecha ?? ex?.alturas_fecha ?? null, alturas_vence: r.alturas_vence ?? ex?.alturas_vence ?? null,
          };
          const t = ex ? await api<T>(`personal/${ex.id}`, { method: "PUT", body }) : await api<T>("personal", { method: "POST", body });
          porNombre.set(nombre.toLowerCase(), t);
          if (ex) actualizados++; else nuevos++;
          const obra = obras.find((o) => o.nombre.toLowerCase().startsWith(r.obra.toLowerCase()) || o.id === r.obra.toLowerCase());
          if (obra && !asignados.has(`${t.id}|${obra.id}`)) {
            await api("asignaciones", { method: "POST", body: { trabajador_id: t.id, obra_id: obra.id, fecha_ingreso: hoy() } });
            asignados.add(`${t.id}|${obra.id}`); nAsig++;
          }
          seguidos = 0;
        } catch (x) {
          fallos++; seguidos++; primerError ||= x instanceof Error ? x.message : "Error";
          if (seguidos >= 3) break; // p. ej. se alcanzó el límite del plan: no se insiste
        }
        setImportando({ hecho: i + 1, total: filasX.length });
      }
      aviso(`Importado: ${nuevos} nuevos, ${actualizados} actualizados, ${nAsig} asignaciones${fallos ? ` · ${fallos} con error (${primerError})` : ""}`, fallos ? "error" : "ok");
      void cargar(); void cargarAsig();
    } catch (e) {
      aviso(`No se pudo leer el Excel: ${(e as Error).message}`, "error");
    } finally {
      setImportando(null);
      if (archivo.current) archivo.current.value = "";
    }
  }

  const asignacionesEdit = edit?.id ? asigs.filter((a) => a.trabajador_id === edit.id) : [];

  return (
    <>
      <Titulo sub={lista ? `${lista.length} trabajadores · ${cuenta("habilitado") + cuenta("por-vencer")} habilitados` : undefined}
        acciones={puedeEscribir && (
          <>
            <Boton variante="secundario" icono={<Upload className="size-4" aria-hidden />} cargando={!!importando} onClick={() => archivo.current?.click()}>
              {importando ? `Importando ${importando.hecho}/${importando.total}` : "Importar Excel"}
            </Boton>
            <Boton icono={<UserPlus className="size-4" aria-hidden />} onClick={() => abrir(vacio())}>Nuevo trabajador</Boton>
            <input ref={archivo} type="file" tabIndex={-1} aria-hidden="true" accept=".xlsx" className="sr-only" onChange={(e) => importar(e.target.files?.[0])} />
          </>
        )}>Personal</Titulo>

      {error && <Aviso tono="error">{error}</Aviso>}
      {!lista && !error && <div className="space-y-3"><Esqueleto className="h-11" /><Esqueleto className="h-64" /></div>}
      {lista && (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <Buscador className="flex-1" etiqueta="Buscar trabajador" placeholder="Buscar por nombre, cédula o cargo" valor={q} onChange={setQ} />
            <Select aria-label="Filtrar por obra" className="lg:w-56" value={obraF} onChange={(e) => setObraF(e.target.value)}>
              <option value="">Todas las obras</option>
              {obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </Select>
          </div>
          <div className="mt-3">
            <Segmentado etiqueta="Filtrar por estado de habilitación" valor={estadoF} onChange={setEstadoF}
              opciones={[
                { valor: "todos", texto: `Todos (${filas.length})` },
                { valor: "habilitado", texto: `Habilitados (${cuenta("habilitado")})` },
                { valor: "por-vencer", texto: `Por vencer (${cuenta("por-vencer")})` },
                { valor: "vencido", texto: `No habilitados (${cuenta("vencido")})` },
              ]} />
          </div>

          {visibles.length === 0 ? (
            <div className="mt-4"><Vacio icono={<Users className="size-6" aria-hidden />} titulo={lista.length ? "Sin resultados" : "Aún no hay trabajadores"}
              texto={lista.length ? "Pruebe con otro nombre o quite los filtros." : "Registre al personal uno por uno o impórtelo desde el Excel de la base."}
              accion={!lista.length && puedeEscribir ? <Boton icono={<UserPlus className="size-4" aria-hidden />} onClick={() => abrir(vacio())}>Nuevo trabajador</Boton> : undefined} /></div>
          ) : (
            <>
              {/* Celular: tarjetas */}
              <ul className="mt-4 space-y-2 lg:hidden">
                {visibles.map(({ t, h, as }) => (
                  <li key={t.id} className="rounded-xl border border-borde bg-tarjeta p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {puedeEscribir
                          ? <button type="button" onClick={() => abrir(t)} className="-ml-1 flex min-h-11 items-center gap-1 rounded-lg px-1 text-left font-bold text-tinta">{t.nombre}<ChevronRight className="size-4 shrink-0 text-suave" aria-hidden /></button>
                          : <p className="font-bold text-tinta">{t.nombre}</p>}
                        <p className="text-sm text-suave">{t.cedula ? `C.C. ${t.cedula}` : "Sin cédula"} · {t.cargo || "Sin cargo"}</p>
                      </div>
                      <ChipHabilitacion e={h.estado} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {as.map((a) => <Chip key={a.id} tono="info">{nombreObra(a.obra_id)}</Chip>)}
                      {as.length === 0 && <span className="text-sm text-suave">Sin obra asignada</span>}
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-xs font-semibold uppercase tracking-wide text-suave">Examen médico</dt><dd><Dias d={h.diasExamen} vence={t.examen_vence} /></dd></div>
                      <div><dt className="text-xs font-semibold uppercase tracking-wide text-suave">Curso de alturas</dt><dd><Dias d={h.diasAlturas} vence={t.alturas_vence} /></dd></div>
                    </dl>
                    {h.estado !== "habilitado" && <p className="mt-2 text-sm text-suave">{h.motivo}</p>}
                  </li>
                ))}
              </ul>

              {/* Escritorio: tabla */}
              <div className="mt-4 hidden overflow-hidden rounded-xl border border-borde bg-tarjeta lg:block">
                <table className="w-full text-sm">
                  <thead className="bg-fondo text-left text-xs uppercase tracking-wide text-suave">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 font-semibold">Trabajador</th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">Obras</th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">Examen médico</th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">Curso de alturas</th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borde">
                    {visibles.map(({ t, h, as }) => (
                      <tr key={t.id} className={cx("align-top", puedeEscribir && "cursor-pointer hover:bg-marca-50/60")} onClick={() => puedeEscribir && abrir(t)}>
                        <td className="px-4 py-3">
                          {puedeEscribir
                            ? <button type="button" onClick={(e) => { e.stopPropagation(); abrir(t); }} className="-ml-1 rounded px-1 text-left font-semibold text-tinta hover:underline">{t.nombre}</button>
                            : <span className="font-semibold">{t.nombre}</span>}
                          <span className="block text-xs text-suave">{t.cedula ? `C.C. ${t.cedula}` : "Sin cédula"} · {t.cargo || "Sin cargo"}</span>
                          {t.notas.length > 0 && <span className="mt-1 flex items-center gap-1 text-xs font-medium text-alerta"><Info className="size-3.5" aria-hidden /> Dato a verificar</span>}
                        </td>
                        <td className="px-3 py-3"><div className="flex flex-wrap gap-1">{as.map((a) => <Chip key={a.id} tono="info">{nombreObra(a.obra_id)}</Chip>)}{as.length === 0 && <span className="text-suave">Sin asignar</span>}</div></td>
                        <td className="px-3 py-3"><Dias d={h.diasExamen} vence={t.examen_vence} /></td>
                        <td className="px-3 py-3"><Dias d={h.diasAlturas} vence={t.alturas_vence} /></td>
                        <td className="px-3 py-3"><ChipHabilitacion e={h.estado} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      <Modal abierto={!!edit} onCerrar={() => setEdit(null)} sucio={sucio} titulo={edit?.id ? edit.nombre || "Trabajador" : "Nuevo trabajador"}
        pie={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            {edit?.id ? <Boton type="button" variante="peligro" icono={<Trash2 className="size-4" aria-hidden />} onClick={() => edit && borrar(edit)}>Eliminar</Boton> : <span />}
            <div className="flex gap-2">
              <Boton type="button" variante="secundario" onClick={() => setEdit(null)}>Cancelar</Boton>
              <Boton type="submit" form="form-trabajador" disabled={!edit?.nombre?.trim()}>Guardar</Boton>
            </div>
          </div>
        }>
        {edit && (
          <form id="form-trabajador" onSubmit={guardar} className="space-y-4">
            {edit.notas && edit.notas.length > 0 && <Aviso tono="alerta">{edit.notas.map((n) => <p key={n}>{n}</p>)}</Aviso>}
            <Campo etiqueta="Nombre completo"><Input data-autofocus={edit.id ? undefined : true} required minLength={2} value={edit.nombre ?? ""} onChange={(e) => set("nombre", e.target.value)} /></Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Cédula"><Input inputMode="numeric" className="num" value={edit.cedula ?? ""} onChange={(e) => set("cedula", e.target.value)} /></Campo>
              <Campo etiqueta="Teléfono"><Input type="tel" value={edit.telefono ?? ""} onChange={(e) => set("telefono", e.target.value)} /></Campo>
              <Campo etiqueta="Cargo"><Input placeholder="Oficial, ayudante…" value={edit.cargo ?? ""} onChange={(e) => set("cargo", e.target.value)} /></Campo>
              <Campo etiqueta="Jornal (valor del día)" ayuda={`Vacío = jornal base de Ajustes. Mínimo legal de referencia: ${fmtCOP(JORNAL_MINIMO)}`}>
                <Input type="number" inputMode="numeric" min={0} className="num" value={edit.jornal ?? ""} onChange={(e) => set("jornal", e.target.value ? Number(e.target.value) : null)} />
              </Campo>
              {fechaCampo("Examen médico: fecha", "examen_fecha")}{fechaCampo("Examen médico: vence", "examen_vence")}
              {fechaCampo("Curso de alturas: fecha", "alturas_fecha")}{fechaCampo("Curso de alturas: vence", "alturas_vence")}
            </div>
            <p className="text-xs text-suave">Por la Ley 1581 de 2012 solo se guarda la vigencia del examen (apto), no su contenido médico.</p>

            <fieldset className="rounded-lg border border-borde p-3">
              <legend className="px-1 text-sm font-bold text-tinta">Asignación a obra (RRHH)</legend>
              {asignacionesEdit.length > 0 && (
                <ul className="mb-3 space-y-1.5">
                  {asignacionesEdit.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 flex-wrap items-center gap-2"><Building2 className="size-4 shrink-0 text-marca-texto" aria-hidden /><strong>{nombreObra(a.obra_id)}</strong> desde {fechaCorta(a.fecha_ingreso)}{a.fecha_retiro && <Chip>Retirado {fechaCorta(a.fecha_retiro)}</Chip>}</span>
                      {!a.fecha_retiro && <Boton type="button" tam="sm" variante="peligro" onClick={() => retirar(a)}>Retirar</Boton>}
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_160px_auto]">
                <Select aria-label="Obra" value={asig.obraId} onChange={(e) => setAsig({ ...asig, obraId: e.target.value })}>
                  <option value="">Asignar a obra…</option>
                  {obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </Select>
                <Input aria-label="Fecha de ingreso" type="date" value={asig.fecha} onChange={(e) => setAsig({ ...asig, fecha: e.target.value })} />
                {edit.id && <Boton type="button" variante="secundario" disabled={!asig.obraId} onClick={asignar}>Asignar</Boton>}
              </div>
              {!edit.id && <p className="mt-1 text-xs text-suave">Se asignará al guardar.</p>}
            </fieldset>
          </form>
        )}
      </Modal>
    </>
  );
}
