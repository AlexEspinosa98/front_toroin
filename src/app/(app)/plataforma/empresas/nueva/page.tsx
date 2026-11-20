"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, Rocket, Zap } from "lucide-react";
import { api } from "@/lib/client";
import type { ModuloCatalogo, Plan } from "@/lib/types";
import { CampoColor } from "@/components/CampoColor";
import { ImagenInput } from "@/components/ImagenInput";
import { VistaPreviaMarca } from "@/components/VistaPreviaMarca";
import { Aviso, Boton, Campo, Chip, Input, Modal, Select, Tarjeta, Titulo, cx, useAviso } from "@/components/ui";

const PASOS = ["Empresa y marca", "Administrador", "Plan y licencia", "Resumen"];
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export default function NuevaEmpresa() {
  const aviso = useAviso();
  const [paso, setPaso] = useState(0);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [cat, setCat] = useState<ModuloCatalogo[]>([]);
  const [error, setError] = useState("");
  const [creando, setCreando] = useState(false);
  const [res, setRes] = useState<{ empresa: { id: string; slug: string }; admin: { correo: string; password_temporal: string } } | null>(null);

  const [f, setF] = useState({
    nombre: "", slug: "", slugManual: false, nit: "", pais: "CO", moneda: "COP", nombre_app: "", color_primario: "#19185A", color_secundario: "#F59E0B",
    logo_claro: null as string | null, logo_oscuro: null as string | null, icono: null as string | null, pie: "",
    adminNombre: "", adminCorreo: "", plan: "profesional", tipo: "periodo", meses: 12, fin: "", dias_prueba: 14, gracia_dias: 7, inicio: "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    api<Plan[]>("platform/planes").then((p) => setPlanes(p.filter((x) => x.activo))).catch((e) => setError(e.message));
    api<ModuloCatalogo[]>("platform/catalogo").then(setCat).catch(() => {});
  }, []);

  const plan = planes.find((p) => p.clave === f.plan);
  const nombreMod = (k: string) => cat.find((m) => m.clave === k)?.nombre ?? k;
  const base = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_BASE_DOMAIN ? `${f.slug}.${process.env.NEXT_PUBLIC_BASE_DOMAIN}` : `${window.location.origin}/${f.slug}`) : "";

  function validar(): string {
    if (paso === 0) { if (f.nombre.trim().length < 2) return "Escriba el nombre de la empresa"; if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(f.slug)) return "El código debe tener 3-63 caracteres: letras minúsculas, números y guiones"; }
    if (paso === 1) { if (f.adminNombre.trim().length < 2) return "Escriba el nombre del administrador"; if (!/^\S+@\S+\.\S+$/.test(f.adminCorreo)) return "Escriba un correo válido"; }
    if (paso === 2) {
      if (!f.plan) return "Elija un plan";
      if (f.tipo === "hasta_fecha" && !f.fin) return "Indique la fecha final de la licencia";
      if (f.tipo === "periodo" && f.meses < 1) return "Indique los meses";
    }
    return "";
  }
  const [rapida, setRapida] = useState({ nombre: "", correo: "", plan: "profesional" });
  async function altaRapida() {
    setCreando(true); setError("");
    try {
      const nombre = rapida.nombre.trim();
      const r = await api<NonNullable<typeof res>>("platform/empresas", { method: "POST", body: {
        slug: norm(nombre), nombre, admin: { nombre: "Administrador", correo: rapida.correo.trim() },
        licencia: { plan: rapida.plan, tipo: "prueba", dias_prueba: 14, gracia_dias: 7 },
      } });
      setRes(r);
    } catch (x) { setError(x instanceof Error ? x.message : "No se pudo crear la empresa"); }
    finally { setCreando(false); }
  }
  const siguiente = () => { const e = validar(); setError(e); if (!e) setPaso(paso + 1); };

  async function crear() {
    setCreando(true); setError("");
    try {
      const r = await api<NonNullable<typeof res>>("platform/empresas", { method: "POST", body: {
        slug: f.slug, nombre: f.nombre.trim(), nit: f.nit, pais: f.pais, moneda: f.moneda,
        marca: { nombre_app: f.nombre_app, color_primario: f.color_primario, color_secundario: f.color_secundario, logo_claro: f.logo_claro, logo_oscuro: f.logo_oscuro, icono: f.icono, pie: f.pie },
        admin: { nombre: f.adminNombre.trim(), correo: f.adminCorreo.trim() },
        licencia: { plan: f.plan, tipo: f.tipo, inicio: f.inicio || null, meses: f.tipo === "periodo" ? f.meses : null, fin: f.tipo === "hasta_fecha" ? f.fin : null, dias_prueba: f.tipo === "prueba" ? f.dias_prueba : null, gracia_dias: f.gracia_dias },
      } });
      setRes(r);
    } catch (x) { setError(x instanceof Error ? x.message : "No se pudo crear la empresa"); setPaso(x instanceof Error && /subdominio|código/i.test(x.message) ? 0 : paso); }
    finally { setCreando(false); }
  }

  return (
    <>
      <Titulo sub="Cuatro pasos: datos y marca, administrador, plan y licencia.">Nueva empresa</Titulo>
      <ol className="mb-5 flex gap-2" aria-label="Pasos">
        {PASOS.map((p, i) => {
          const hecho = i < paso;
          const actual = i === paso;
          return (
            <li key={p} aria-current={actual ? "step" : undefined}
              className={cx("flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors duration-150", actual ? "flex-[3] bg-marca text-sobre-marca sm:flex-1" : "flex-none sm:flex-1", !actual && (hecho ? "bg-ok-50 text-ok" : "border border-borde bg-white text-suave"))}>
              <span aria-hidden className={cx("grid size-6 shrink-0 place-items-center rounded-full text-xs", actual ? "bg-white/20" : hecho ? "bg-ok/15" : "bg-fondo")}>{hecho ? <Check className="size-3.5" /> : i + 1}</span>
              <span className={cx("truncate", !actual && "sr-only sm:not-sr-only")}>{p}</span>
              {hecho && <span className="sr-only">(completado)</span>}
            </li>
          );
        })}
      </ol>
      {error && <div className="mb-4"><Aviso tono="error">{error}</Aviso></div>}
      {paso === 0 && (
        <Tarjeta titulo={<span className="flex items-center gap-2"><Zap className="size-4 text-marca-texto" aria-hidden />Alta rápida</span>} className="mb-5" sub="Prueba de 14 días; la marca y la licencia se ajustan después. O siga con los 4 pasos de abajo.">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_12rem_auto] sm:items-end">
            <Campo etiqueta="Nombre de la empresa"><Input value={rapida.nombre} onChange={(e) => setRapida({ ...rapida, nombre: e.target.value })} /></Campo>
            <Campo etiqueta="Correo del administrador"><Input type="email" value={rapida.correo} onChange={(e) => setRapida({ ...rapida, correo: e.target.value })} /></Campo>
            <Campo etiqueta="Plan"><Select value={rapida.plan} onChange={(e) => setRapida({ ...rapida, plan: e.target.value })}>{planes.map((p) => <option key={p.id} value={p.clave}>{p.nombre}</option>)}</Select></Campo>
            <Boton onClick={altaRapida} cargando={creando} icono={creando ? undefined : <Rocket className="size-4" aria-hidden />} disabled={norm(rapida.nombre).length < 3 || !/^\S+@\S+\.\S+$/.test(rapida.correo)}>{creando ? "Creando…" : "Crear ahora"}</Boton>
          </div>
        </Tarjeta>
      )}

      {paso === 0 && (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <Tarjeta className="space-y-4">
            <Campo etiqueta="Nombre de la empresa"><Input value={f.nombre} onChange={(e) => setF((x) => ({ ...x, nombre: e.target.value, slug: x.slugManual ? x.slug : norm(e.target.value) }))} /></Campo>
            <Campo etiqueta="Código de acceso (subdominio)" ayuda="Es lo que escribirán al iniciar sesión, o su subdominio: codigo.tudominio.com"><Input value={f.slug} onChange={(e) => setF((x) => ({ ...x, slug: norm(e.target.value), slugManual: true }))} autoCapitalize="none" /></Campo>
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo etiqueta="NIT"><Input value={f.nit} onChange={(e) => set("nit", e.target.value)} /></Campo>
              <Campo etiqueta="País"><Input maxLength={2} value={f.pais} onChange={(e) => set("pais", e.target.value.toUpperCase())} /></Campo>
              <Campo etiqueta="Moneda"><Input maxLength={3} value={f.moneda} onChange={(e) => set("moneda", e.target.value.toUpperCase())} /></Campo>
            </div>
            <Campo etiqueta="Nombre de la aplicación" ayuda="Se muestra en el encabezado. Vacío = nombre de la empresa."><Input value={f.nombre_app} onChange={(e) => set("nombre_app", e.target.value)} /></Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoColor etiqueta="Color principal" ayuda="Barra lateral, botones y títulos" valor={f.color_primario} onChange={(v) => set("color_primario", v)} />
              <CampoColor etiqueta="Color de acento" ayuda="Detalles, indicadores y gráficas" valor={f.color_secundario} onChange={(v) => set("color_secundario", v)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <ImagenInput etiqueta="Logo (sobre color)" valor={f.logo_claro} onChange={(v) => set("logo_claro", v)} fondoOscuro />
              <ImagenInput etiqueta="Logo (sobre claro)" valor={f.logo_oscuro} onChange={(v) => set("logo_oscuro", v)} />
              <ImagenInput etiqueta="Ícono" valor={f.icono} onChange={(v) => set("icono", v)} maxLado={128} />
            </div>
            <Campo etiqueta="Pie de página"><Input value={f.pie} maxLength={300} onChange={(e) => set("pie", e.target.value)} /></Campo>
          </Tarjeta>
          <VistaPreviaMarca nombre={f.nombre_app || f.nombre} primario={f.color_primario} secundario={f.color_secundario} logo={f.logo_claro} pie={f.pie} />
        </div>
      )}

      {paso === 1 && (
        <Tarjeta className="max-w-xl space-y-4">
          <Aviso>Se generará una contraseña temporal que verá una sola vez al terminar. La persona deberá cambiarla en su primer ingreso.</Aviso>
          <Campo etiqueta="Nombre del administrador"><Input value={f.adminNombre} onChange={(e) => set("adminNombre", e.target.value)} /></Campo>
          <Campo etiqueta="Correo"><Input type="email" value={f.adminCorreo} onChange={(e) => set("adminCorreo", e.target.value)} /></Campo>
        </Tarjeta>
      )}

      {paso === 2 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Tarjeta titulo="Plan" className="space-y-4">
            <Campo etiqueta="Plan base"><Select value={f.plan} onChange={(e) => set("plan", e.target.value)}>{planes.map((p) => <option key={p.id} value={p.clave}>{p.nombre}</option>)}</Select></Campo>
            {plan && (<><p className="text-sm text-suave">{plan.descripcion}</p>
              <div className="flex flex-wrap gap-1.5">{plan.modulos.map((m) => <Chip key={m} tono="ok">{nombreMod(m)}</Chip>)}</div>
              <p className="text-xs text-suave">Podrá activar o desactivar módulos uno por uno después de crear la empresa.</p></>)}
          </Tarjeta>
          <Tarjeta titulo="Licencia" className="space-y-4">
            <Campo etiqueta="Tipo"><Select value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>
              <option value="periodo">Por periodo (meses)</option><option value="hasta_fecha">Hasta una fecha</option><option value="ilimitada">Ilimitada</option><option value="prueba">Prueba</option></Select></Campo>
            {f.tipo === "periodo" && <Campo etiqueta="Duración (meses)"><Input type="number" min={1} max={120} value={f.meses} onChange={(e) => set("meses", Number(e.target.value))} /></Campo>}
            {f.tipo === "hasta_fecha" && <Campo etiqueta="Vence el"><Input type="date" value={f.fin} onChange={(e) => set("fin", e.target.value)} /></Campo>}
            {f.tipo === "prueba" && <Campo etiqueta="Días de prueba"><Input type="number" min={1} max={365} value={f.dias_prueba} onChange={(e) => set("dias_prueba", Number(e.target.value))} /></Campo>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Inicia" ayuda="Vacío = hoy"><Input type="date" value={f.inicio} onChange={(e) => set("inicio", e.target.value)} /></Campo>
              <Campo etiqueta="Días de gracia" ayuda="Tras vencer, sigue funcionando con aviso"><Input type="number" min={0} max={90} value={f.gracia_dias} onChange={(e) => set("gracia_dias", Number(e.target.value))} /></Campo>
            </div>
          </Tarjeta>
        </div>
      )}

      {paso === 3 && (
        <Tarjeta titulo="Revise y cree" className="max-w-2xl">
          <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
            <dt className="text-suave">Empresa</dt><dd>{f.nombre} <span className="text-suave">({f.slug})</span></dd>
            <dt className="text-suave">Acceso</dt><dd className="break-all">{base}</dd>
            <dt className="text-suave">Administrador</dt><dd>{f.adminNombre} · {f.adminCorreo}</dd>
            <dt className="text-suave">Plan</dt><dd>{plan?.nombre}</dd>
            <dt className="text-suave">Licencia</dt><dd>{f.tipo === "periodo" ? `${f.meses} meses` : f.tipo === "hasta_fecha" ? `Hasta ${f.fin}` : f.tipo === "prueba" ? `Prueba de ${f.dias_prueba} días` : "Ilimitada"} · gracia {f.gracia_dias} días</dd>
          </dl>
        </Tarjeta>
      )}

      <div className="mt-5 flex gap-2">
        {paso > 0 && <Boton variante="secundario" icono={<ArrowLeft className="size-4" aria-hidden />} onClick={() => { setError(""); setPaso(paso - 1); }}>Atrás</Boton>}
        {paso < 3
          ? <Boton onClick={siguiente}>Siguiente<ArrowRight className="size-4" aria-hidden /></Boton>
          : <Boton onClick={crear} cargando={creando} icono={creando ? undefined : <Rocket className="size-4" aria-hidden />}>{creando ? "Creando…" : "Crear empresa"}</Boton>}
      </div>

      <Modal abierto={!!res} titulo="Empresa creada" onCerrar={() => {}}>
        {res && (
          <div className="space-y-3">
            <Aviso tono="alerta">Entregue estas credenciales al administrador. La contraseña <strong>no se volverá a mostrar</strong>.</Aviso>
            <dl className="grid grid-cols-[7rem_1fr] gap-y-1 text-sm">
              <dt className="text-suave">Acceso</dt><dd className="break-all">{typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_BASE_DOMAIN ? `${res.empresa.slug}.${process.env.NEXT_PUBLIC_BASE_DOMAIN}` : `${window.location.origin}/${res.empresa.slug}`) : ""}</dd>
              <dt className="text-suave">Código</dt><dd>{res.empresa.slug}</dd>
              <dt className="text-suave">Correo</dt><dd>{res.admin.correo}</dd>
            </dl>
            <div className="flex items-center gap-2"><code className="num min-w-0 flex-1 break-all rounded-lg bg-fondo px-3 py-3 text-base font-semibold text-tinta">{res.admin.password_temporal}</code>
              <Boton variante="secundario" icono={<Copy className="size-4" aria-hidden />} onClick={() => { void navigator.clipboard?.writeText(res.admin.password_temporal); aviso("Copiada"); }}>Copiar</Boton></div>
            <div className="flex justify-end"><Link href={`/plataforma/empresas/${res.empresa.id}`}><Boton>Ir a la empresa</Boton></Link></div>
          </div>
        )}
      </Modal>
    </>
  );
}
