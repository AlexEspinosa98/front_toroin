"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, post } from "@/lib/client";
import { fecha, fechaHora, limiteTexto, ROL_TEXTO, TIPO_TEXTO } from "@/lib/format";
import type { Auditoria, DetalleEmpresa, EstadoLic, ModuloEmpresa, Plan } from "@/lib/types";
import { ImagenInput } from "@/components/ImagenInput";
import { VistaPreviaMarca } from "@/components/VistaPreviaMarca";
import { TablaAuditoria } from "@/components/TablaAuditoria";
import { Aviso, Boton, Campo, Input, Insignia, InsigniaEstado, Modal, Select, Tabla, Tarjeta, Textarea, Titulo, Vacio, cx, useAviso } from "@/components/ui";

const TABS = ["General", "Módulos", "Licencia", "Marca", "Usuarios", "Auditoría"] as const;
type Tab = (typeof TABS)[number];

export default function DetalleEmpresaPagina() {
  const { id } = useParams<{ id: string }>();
  const aviso = useAviso();
  const [d, setD] = useState<DetalleEmpresa | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("General");
  const [ver, setVer] = useState(false);
  const [credencial, setCredencial] = useState<{ correo: string; password_temporal: string } | null>(null);

  const cargar = useCallback(() => api<DetalleEmpresa>(`platform/empresas/${id}`).then(setD).catch((e) => setError(e.message)), [id]);
  useEffect(() => { void cargar(); }, [cargar]);
  if (error) return <Aviso tono="error">{error}</Aviso>;
  if (!d) return null;

  const estado = (d.licencia.estado ?? "sin_licencia") as EstadoLic;
  async function suspender() {
    const susp = d!.estado_cuenta !== "suspendida";
    if (!confirm(susp ? `¿Suspender a «${d!.nombre}»? Sus usuarios perderán el acceso de inmediato.` : `¿Reactivar a «${d!.nombre}»?`)) return;
    try { await api(`platform/empresas/${id}/${susp ? "suspender" : "reactivar"}`, { method: "POST" }); aviso(susp ? "Empresa suspendida" : "Empresa reactivada"); void cargar(); }
    catch (x) { aviso(x instanceof Error ? x.message : "No se pudo", "error"); }
  }

  return (
    <>
      <Titulo sub={<><span>{d.slug}</span> · <InsigniaEstado estado={estado} /> {d.estado_cuenta === "suspendida" && <Insignia tono="rojo">Cuenta suspendida</Insignia>}</>}
        acciones={<><Boton variante="secundario" onClick={() => setVer(true)}>Ver como la empresa</Boton>
          <Boton variante={d.estado_cuenta === "suspendida" ? "primario" : "peligro"} onClick={suspender}>{d.estado_cuenta === "suspendida" ? "Reactivar" : "Suspender"}</Boton></>}>{d.nombre}</Titulo>
      <Link href="/plataforma/empresas" className="mb-4 inline-block text-sm text-slate-600 underline">← Todas las empresas</Link>

      <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (<button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
          className={cx("min-h-11 shrink-0 border-b-2 px-4 text-sm font-semibold", tab === t ? "border-marca text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800")}>{t}</button>))}
      </div>

      {tab === "General" && <General d={d} onGuardado={cargar} onCredencial={setCredencial} />}
      {tab === "Módulos" && <Modulos d={d} onGuardado={cargar} />}
      {tab === "Licencia" && <Licencia d={d} onGuardado={cargar} />}
      {tab === "Marca" && <MarcaTab d={d} onGuardado={cargar} />}
      {tab === "Usuarios" && <UsuariosTab d={d} />}
      {tab === "Auditoría" && <AuditoriaTab id={id} />}

      <VerComo abierto={ver} onCerrar={() => setVer(false)} empresa={d} />
      <Modal abierto={!!credencial} titulo="Credenciales del administrador" onCerrar={() => setCredencial(null)}>
        {credencial && <div className="space-y-3">
          <Aviso tono="alerta">La contraseña <strong>no se volverá a mostrar</strong>. Debe cambiarla al ingresar.</Aviso>
          <p className="text-sm">Correo: <strong>{credencial.correo}</strong></p>
          <div className="flex items-center gap-2"><code className="flex-1 rounded-lg bg-slate-100 px-3 py-3 font-semibold">{credencial.password_temporal}</code>
            <Boton variante="secundario" onClick={() => { void navigator.clipboard?.writeText(credencial.password_temporal); aviso("Copiada"); }}>Copiar</Boton></div></div>}
      </Modal>
    </>
  );
}

function VerComo({ abierto, onCerrar, empresa }: { abierto: boolean; onCerrar: () => void; empresa: DetalleEmpresa }) {
  const [motivo, setMotivo] = useState("");
  const [lectura, setLectura] = useState(true);
  const [error, setError] = useState("");
  async function entrar(e: React.FormEvent) {
    e.preventDefault(); setError("");
    try { await post("/api/suplantar/entrar", { empresaId: empresa.id, motivo, soloLectura: lectura }); window.location.href = "/"; }
    catch (x) { setError(x instanceof Error ? x.message : "No se pudo iniciar"); }
  }
  return (
    <Modal abierto={abierto} titulo={`Ver «${empresa.nombre}» como la ve la empresa`} onCerrar={onCerrar}>
      <form onSubmit={entrar} className="space-y-4">
        <Aviso>Verá sus datos reales (incluye datos personales de trabajadores). El motivo queda en la auditoría y la sesión dura 60 minutos.</Aviso>
        <Campo etiqueta="Motivo (obligatorio)"><Textarea required minLength={5} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Soporte: la empresa reporta que no ve Bitácora" /></Campo>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-5" checked={lectura} onChange={(e) => setLectura(e.target.checked)} /> Solo lectura (recomendado)</label>
        {error && <Aviso tono="error">{error}</Aviso>}
        <div className="flex justify-end gap-2"><Boton type="button" variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton type="submit">Entrar</Boton></div>
      </form>
    </Modal>
  );
}

function General({ d, onGuardado, onCredencial }: { d: DetalleEmpresa; onGuardado: () => void; onCredencial: (c: { correo: string; password_temporal: string }) => void }) {
  const aviso = useAviso();
  const [f, setF] = useState({ nombre: d.nombre, nit: d.nit, pais: d.pais, moneda: d.moneda, zona_horaria: d.zona_horaria, notas_internas: d.notas_internas });
  const [adm, setAdm] = useState({ nombre: "", correo: "" });
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    try { await api(`platform/empresas/${d.id}`, { method: "PATCH", body: f }); aviso("Datos guardados"); onGuardado(); } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo guardar", "error"); }
  }
  async function admin(e: React.FormEvent) {
    e.preventDefault();
    try { const r = await api<{ correo: string; password_temporal: string }>(`platform/empresas/${d.id}/admin`, { method: "POST", body: adm }); onCredencial(r); setAdm({ nombre: "", correo: "" }); onGuardado(); }
    catch (x) { aviso(x instanceof Error ? x.message : "No se pudo", "error"); }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Tarjeta titulo="Datos de la empresa"><form onSubmit={guardar} className="space-y-4">
        <Campo etiqueta="Nombre"><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Campo>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="NIT"><Input value={f.nit} onChange={(e) => setF({ ...f, nit: e.target.value })} /></Campo>
          <Campo etiqueta="País"><Input maxLength={2} value={f.pais} onChange={(e) => setF({ ...f, pais: e.target.value.toUpperCase() })} /></Campo>
          <Campo etiqueta="Moneda"><Input maxLength={3} value={f.moneda} onChange={(e) => setF({ ...f, moneda: e.target.value.toUpperCase() })} /></Campo>
        </div>
        <Campo etiqueta="Zona horaria"><Input value={f.zona_horaria} onChange={(e) => setF({ ...f, zona_horaria: e.target.value })} /></Campo>
        <Campo etiqueta="Notas internas (solo plataforma)"><Textarea value={f.notas_internas} onChange={(e) => setF({ ...f, notas_internas: e.target.value })} /></Campo>
        <Boton type="submit">Guardar</Boton></form></Tarjeta>
      <div className="space-y-4">
        <Tarjeta titulo="Uso">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            {([["Usuarios activos", "usuarios", "max_usuarios"], ["Obras", "obras", "max_obras"], ["Trabajadores", "trabajadores", "max_trabajadores"]] as const).map(([t, k, lim]) => (
              <div key={k} className="contents"><dt className="text-slate-500">{t}</dt><dd className="font-semibold">{d.uso[k]} / {limiteTexto(d.licencia.limites_efectivos?.[lim])}</dd></div>))}
            <dt className="text-slate-500">Creada</dt><dd>{fecha(d.creado)}</dd>
          </dl></Tarjeta>
        <Tarjeta titulo="Administrador de la empresa"><form onSubmit={admin} className="space-y-3">
          <p className="text-sm text-slate-600">Crea un administrador nuevo, o reinicia la clave si el correo ya existe.</p>
          <Campo etiqueta="Nombre"><Input required minLength={2} value={adm.nombre} onChange={(e) => setAdm({ ...adm, nombre: e.target.value })} /></Campo>
          <Campo etiqueta="Correo"><Input type="email" required value={adm.correo} onChange={(e) => setAdm({ ...adm, correo: e.target.value })} /></Campo>
          <Boton type="submit" variante="secundario">Crear / reiniciar clave</Boton></form></Tarjeta>
      </div>
    </div>
  );
}

type Modo = "plan" | "on" | "off";
type Ctl = { modo: Modo; inicio: string; fin: string };

function Modulos({ d, onGuardado }: { d: DetalleEmpresa; onGuardado: () => void }) {
  const aviso = useAviso();
  const gestionables = d.modulos.filter((m) => !m.nucleo);
  const inicial = (m: ModuloEmpresa): Ctl => ({ modo: m.control ? (m.control.activo ? "on" : "off") : "plan", inicio: m.control?.inicio ?? "", fin: m.control?.fin ?? "" });
  const [c, setC] = useState<Record<string, Ctl>>(() => Object.fromEntries(gestionables.map((m) => [m.clave, inicial(m)])));
  const [error, setError] = useState("");
  const nombre = (k: string) => d.modulos.find((m) => m.clave === k)?.nombre ?? k;

  async function guardar() {
    setError("");
    const modulos: Record<string, unknown> = {};
    for (const m of gestionables.filter((m) => m.disponible)) {
      const x = c[m.clave];
      modulos[m.clave] = x.modo === "plan" ? null : x.modo === "off" ? { activo: false } : { activo: true, inicio: x.inicio || null, fin: x.fin || null };
    }
    try { await api(`platform/empresas/${d.id}/modulos`, { method: "PUT", body: { modulos } }); aviso("Módulos actualizados"); onGuardado(); }
    catch (x) { setError(x instanceof Error ? x.message : "No se pudo guardar"); }
  }

  return (
    <Tarjeta titulo="Módulos de esta empresa" acciones={<Boton onClick={guardar}>Guardar cambios</Boton>}>
      <p className="mb-4 text-sm text-slate-600">«Según plan» usa lo que incluye el plan. Puede forzar un módulo encendido (con fechas opcionales) o apagado. Apagar un módulo <strong>no borra sus datos</strong>: al reactivarlo todo sigue ahí.</p>
      {error && <div className="mb-4"><Aviso tono="error">{error}</Aviso></div>}
      <ul className="divide-y divide-slate-100">
        {gestionables.map((m) => (
          <li key={m.clave} className={cx("flex flex-col gap-3 py-3 sm:flex-row sm:items-center", !m.disponible && "opacity-50")}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{m.nombre}</span>
                {!m.disponible && <Insignia>Próximamente</Insignia>}
                {m.disponible && <Insignia tono={m.activo ? "verde" : "gris"}>{m.activo ? "Activo" : "Inactivo"}</Insignia>}
                {m.en_plan && <Insignia tono="azul">En el plan</Insignia>}</div>
              <p className="text-xs text-slate-500">{m.descripcion}{m.requiere.filter((r) => d.modulos.find((x) => x.clave === r && !x.nucleo)).length > 0 && ` · Requiere: ${m.requiere.filter((r) => !d.modulos.find((x) => x.clave === r)?.nucleo).map(nombre).join(", ")}`}</p>
            </div>
            {m.disponible && (
              <div className="flex flex-wrap items-center gap-2">
                <Select aria-label={`Control de ${m.nombre}`} className="!w-40" value={c[m.clave].modo} onChange={(e) => setC({ ...c, [m.clave]: { ...c[m.clave], modo: e.target.value as Modo } })}>
                  <option value="plan">Según plan</option><option value="on">Forzar activo</option><option value="off">Forzar inactivo</option></Select>
                {c[m.clave].modo === "on" && <>
                  <Input type="date" aria-label="Desde" className="!w-40" value={c[m.clave].inicio} onChange={(e) => setC({ ...c, [m.clave]: { ...c[m.clave], inicio: e.target.value } })} />
                  <Input type="date" aria-label="Hasta" className="!w-40" value={c[m.clave].fin} onChange={(e) => setC({ ...c, [m.clave]: { ...c[m.clave], fin: e.target.value } })} /></>}
              </div>)}
          </li>))}
      </ul>
    </Tarjeta>
  );
}

function Licencia({ d, onGuardado }: { d: DetalleEmpresa; onGuardado: () => void }) {
  const aviso = useAviso();
  const l = d.licencia;
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [error, setError] = useState("");
  const [n, setN] = useState({ plan: l.plan_clave ?? "profesional", tipo: "periodo", meses: 12, fin: "", dias_prueba: 14, gracia_dias: 7, inicio: "", notas: "" });
  const [ext, setExt] = useState(l.fin ?? "");
  const [lim, setLim] = useState({ max_usuarios: l.limites?.max_usuarios ?? "", max_obras: l.limites?.max_obras ?? "", max_trabajadores: l.limites?.max_trabajadores ?? "" } as Record<string, number | string>);
  useEffect(() => { api<Plan[]>("platform/planes").then(setPlanes).catch(() => {}); }, []);

  async function patch(body: unknown, ok: string) {
    try { await api(`platform/empresas/${d.id}/licencia`, { method: "PATCH", body }); aviso(ok); onGuardado(); } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo", "error"); }
  }
  async function nueva(e: React.FormEvent) {
    e.preventDefault(); setError("");
    try {
      await api(`platform/empresas/${d.id}/licencias`, { method: "POST", body: { plan: n.plan, tipo: n.tipo, inicio: n.inicio || null, meses: n.tipo === "periodo" ? n.meses : null, fin: n.tipo === "hasta_fecha" ? n.fin : null, dias_prueba: n.tipo === "prueba" ? n.dias_prueba : null, gracia_dias: n.gracia_dias, notas: n.notas } });
      aviso("Licencia creada"); onGuardado();
    } catch (x) { setError(x instanceof Error ? x.message : "No se pudo crear"); }
  }
  const guardarLimites = () => patch({ limites: Object.fromEntries(Object.entries(lim).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)])) }, "Límites actualizados");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Tarjeta titulo="Licencia vigente" acciones={<InsigniaEstado estado={(l.estado ?? "sin_licencia") as EstadoLic} />}>
        {!l.id ? <Vacio>Sin licencia. Cree una a la derecha.</Vacio> : <>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-500">Plan</dt><dd>{l.plan}</dd><dt className="text-slate-500">Tipo</dt><dd>{l.tipo && TIPO_TEXTO[l.tipo]}</dd>
            <dt className="text-slate-500">Inicio</dt><dd>{fecha(l.inicio)}</dd><dt className="text-slate-500">Vence</dt><dd>{l.fin ? fecha(l.fin) : "Sin vencimiento"}</dd>
            <dt className="text-slate-500">Gracia</dt><dd>{l.gracia_dias} días</dd></dl>
          {l.mensaje && <div className="mt-3"><Aviso tono="info">{l.mensaje}</Aviso></div>}
          <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
            {l.tipo !== "ilimitada" && <div className="flex flex-wrap items-end gap-2"><Campo etiqueta="Cambiar fecha final"><Input type="date" value={ext} onChange={(e) => setExt(e.target.value)} /></Campo>
              <Boton variante="secundario" disabled={!ext} onClick={() => patch({ fin: ext }, "Fecha actualizada")}>Aplicar</Boton></div>}
            <div><p className="mb-2 text-sm font-medium text-slate-700">Límites (vacío = según plan)</p>
              <div className="grid gap-2 sm:grid-cols-3">{([["max_usuarios", "Usuarios"], ["max_obras", "Obras"], ["max_trabajadores", "Trabajadores"]] as const).map(([k, t]) => (
                <Campo key={k} etiqueta={t}><Input type="number" min={1} value={lim[k]} onChange={(e) => setLim({ ...lim, [k]: e.target.value })} /></Campo>))}</div>
              <Boton variante="secundario" className="mt-2" onClick={guardarLimites}>Guardar límites</Boton></div>
            <Boton variante={l.suspendida ? "primario" : "peligro"} onClick={() => patch({ suspendida: !l.suspendida }, l.suspendida ? "Licencia reactivada" : "Licencia suspendida")}>{l.suspendida ? "Reactivar licencia" : "Suspender licencia"}</Boton>
          </div></>}
      </Tarjeta>

      <Tarjeta titulo="Renovar o cambiar plan"><form onSubmit={nueva} className="space-y-4">
        <p className="text-sm text-slate-600">Crea una licencia nueva; la anterior queda en el historial. Se conservan los controles por módulo vigentes.</p>
        <Campo etiqueta="Plan"><Select value={n.plan} onChange={(e) => setN({ ...n, plan: e.target.value })}>{planes.filter((p) => p.activo).map((p) => <option key={p.id} value={p.clave}>{p.nombre}</option>)}</Select></Campo>
        <Campo etiqueta="Tipo"><Select value={n.tipo} onChange={(e) => setN({ ...n, tipo: e.target.value })}><option value="periodo">Por periodo (meses)</option><option value="hasta_fecha">Hasta una fecha</option><option value="ilimitada">Ilimitada</option><option value="prueba">Prueba</option></Select></Campo>
        {n.tipo === "periodo" && <Campo etiqueta="Meses"><Input type="number" min={1} max={120} value={n.meses} onChange={(e) => setN({ ...n, meses: Number(e.target.value) })} /></Campo>}
        {n.tipo === "hasta_fecha" && <Campo etiqueta="Vence el"><Input type="date" required value={n.fin} onChange={(e) => setN({ ...n, fin: e.target.value })} /></Campo>}
        {n.tipo === "prueba" && <Campo etiqueta="Días de prueba"><Input type="number" min={1} max={365} value={n.dias_prueba} onChange={(e) => setN({ ...n, dias_prueba: Number(e.target.value) })} /></Campo>}
        <div className="grid gap-4 sm:grid-cols-2"><Campo etiqueta="Inicia (vacío = hoy)"><Input type="date" value={n.inicio} onChange={(e) => setN({ ...n, inicio: e.target.value })} /></Campo>
          <Campo etiqueta="Días de gracia"><Input type="number" min={0} max={90} value={n.gracia_dias} onChange={(e) => setN({ ...n, gracia_dias: Number(e.target.value) })} /></Campo></div>
        <Campo etiqueta="Notas"><Input value={n.notas} onChange={(e) => setN({ ...n, notas: e.target.value })} placeholder="Ej. Pago recibido 12/03, factura 0045" /></Campo>
        {error && <Aviso tono="error">{error}</Aviso>}
        <Boton type="submit">Crear licencia</Boton></form></Tarjeta>

      <Tarjeta titulo="Historial de licencias" className="lg:col-span-2">
        <Tabla cabeceras={["#", "Plan", "Tipo", "Inicio", "Fin", "Notas"]}>
          {d.historial.map((h) => (<tr key={h.id}><td className="px-3 py-2.5">{h.numero}</td><td className="px-3 py-2.5">{h.plan}</td><td className="px-3 py-2.5">{TIPO_TEXTO[h.tipo]}</td>
            <td className="px-3 py-2.5">{fecha(h.inicio)}</td><td className="px-3 py-2.5">{h.fin ? fecha(h.fin) : "—"}</td><td className="px-3 py-2.5 text-slate-600">{h.notas}</td></tr>))}
        </Tabla></Tarjeta>
    </div>
  );
}

function MarcaTab({ d, onGuardado }: { d: DetalleEmpresa; onGuardado: () => void }) {
  const aviso = useAviso();
  const [m, setM] = useState(d.marca);
  const set = <K extends keyof typeof m>(k: K, v: (typeof m)[K]) => setM({ ...m, [k]: v });
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    try { await api(`platform/empresas/${d.id}/marca`, { method: "PUT", body: m }); aviso("Marca guardada"); onGuardado(); } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo guardar", "error"); }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <form onSubmit={guardar}><Tarjeta className="space-y-4">
        <Campo etiqueta="Nombre de la aplicación"><Input value={m.nombre_app} onChange={(e) => set("nombre_app", e.target.value)} placeholder={d.nombre} /></Campo>
        <div className="grid grid-cols-2 gap-4"><Campo etiqueta="Color principal"><Input type="color" className="!p-1" value={m.color_primario} onChange={(e) => set("color_primario", e.target.value)} /></Campo>
          <Campo etiqueta="Color de acento"><Input type="color" className="!p-1" value={m.color_secundario} onChange={(e) => set("color_secundario", e.target.value)} /></Campo></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <ImagenInput etiqueta="Logo (sobre color)" valor={m.logo_claro} onChange={(v) => set("logo_claro", v)} fondoOscuro />
          <ImagenInput etiqueta="Logo (sobre claro)" valor={m.logo_oscuro} onChange={(v) => set("logo_oscuro", v)} />
          <ImagenInput etiqueta="Ícono" valor={m.icono} onChange={(v) => set("icono", v)} maxLado={128} /></div>
        <Campo etiqueta="Pie de página"><Input maxLength={300} value={m.pie} onChange={(e) => set("pie", e.target.value)} /></Campo>
        <Boton type="submit">Guardar marca</Boton></Tarjeta></form>
      <VistaPreviaMarca nombre={m.nombre_app || d.nombre} primario={m.color_primario} secundario={m.color_secundario} logo={m.logo_claro} pie={m.pie} />
    </div>
  );
}

function UsuariosTab({ d }: { d: DetalleEmpresa }) {
  return (
    <Tarjeta titulo={`${d.usuarios.length} usuarios`}>
      {d.usuarios.length === 0 ? <Vacio>Sin usuarios.</Vacio> : (
        <Tabla cabeceras={["Nombre", "Correo", "Rol", "Último acceso", "Estado"]}>
          {d.usuarios.map((u) => (<tr key={u.id}><td className="px-3 py-2.5 font-medium">{u.nombre}</td><td className="px-3 py-2.5">{u.correo}</td><td className="px-3 py-2.5">{ROL_TEXTO[u.rol] ?? u.rol}</td>
            <td className="px-3 py-2.5">{fechaHora(u.ultimo_acceso)}</td><td className="px-3 py-2.5"><Insignia tono={u.activo ? "verde" : "gris"}>{u.activo ? "Activo" : "Inactivo"}</Insignia></td></tr>))}
        </Tabla>)}
    </Tarjeta>
  );
}

function AuditoriaTab({ id }: { id: string }) {
  const [a, setA] = useState<Auditoria[] | null>(null);
  useEffect(() => { api<Auditoria[]>(`platform/auditoria?empresa_id=${id}&limite=100`).then(setA).catch(() => setA([])); }, [id]);
  return <Tarjeta titulo="Actividad reciente">{!a ? null : a.length === 0 ? <Vacio>Sin actividad registrada.</Vacio> : <TablaAuditoria filas={a} />}</Tarjeta>;
}
