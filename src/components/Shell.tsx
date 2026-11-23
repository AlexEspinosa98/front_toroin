"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity, BadgeCheck, Banknote, Bell, Building, Building2, CalendarDays, ClipboardCheck, Download, Ellipsis, Eye, FileText, HardHat,
  GanttChart, Layers, LayoutDashboard, LogOut, NotebookPen, Package, Palette, PiggyBank, Scale, ScrollText, Settings, ShieldCheck, ShoppingCart, UserCog, Users, Wallet, type LucideIcon,
} from "lucide-react";
import { useSession } from "@/lib/session";
import { api, post } from "@/lib/client";
import { ROL_TEXTO } from "@/lib/format";
import type { Marca } from "@/lib/types";
import { Aviso, Boton, cx, Modal, useAviso } from "./ui";

type Item = { href: string; texto: string; corto?: string; icono: LucideIcon; admin?: boolean };

const NOMBRES: Record<string, { texto: string; corto?: string; icono: LucideIcon }> = {
  obras: { texto: "Obras", icono: Building2 },
  contrato: { texto: "Contrato y tablero", corto: "Contrato", icono: FileText },
  personal: { texto: "Personal", icono: Users },
  asistencia: { texto: "Asistencia", icono: ClipboardCheck },
  bitacora: { texto: "Bitácora y avance", corto: "Bitácora", icono: NotebookPen },
  control_personal: { texto: "Control de personal", corto: "Días", icono: CalendarDays },
  pagos: { texto: "Pagos al personal", corto: "Pagos", icono: Banknote },
  finanzas: { texto: "Finanzas", icono: Wallet },
  epp: { texto: "EPP / SST", corto: "EPP", icono: HardHat },
  inventario: { texto: "Inventario y bodega", corto: "Inventario", icono: Package },
  compras: { texto: "Compras", icono: ShoppingCart },
  presupuesto: { texto: "Presupuesto vs. real", corto: "Presupuesto", icono: PiggyBank },
  cronograma: { texto: "Cronograma", icono: GanttChart },
};
const RUTA_PROPIA = new Set(["obras", "personal", "asistencia", "contrato", "bitacora", "epp", "control_personal", "pagos", "finanzas", "inventario", "compras", "presupuesto", "cronograma"]); // módulos ya portados; el resto usa /m/[clave]

function itemsEmpresa(modulos: string[], rol: string): Item[] {
  const it: Item[] = [{ href: "/", texto: "Inicio", icono: LayoutDashboard }, { href: "/alertas", texto: "Alertas", icono: Bell }];
  for (const m of modulos) {
    const n = NOMBRES[m];
    if (m === "usuarios" || !n) continue;
    it.push({ href: RUTA_PROPIA.has(m) ? `/${m.replace("_", "-")}` : `/m/${m}`, ...n });
  }
  if (modulos.includes("control_personal") && (rol === "admin" || rol === "gerencia" || rol === "super_admin")) it.push({ href: "/ajustes", texto: "Ajustes", icono: Settings, admin: true });
  if (modulos.includes("usuarios")) it.push({ href: "/usuarios", texto: "Usuarios", icono: UserCog, admin: true });
  if (rol === "admin" || rol === "super_admin") {
    it.push({ href: "/actividad", texto: "Actividad", icono: Activity, admin: true });
    it.push({ href: "/marca", texto: "Marca", icono: Palette, admin: true });
  }
  it.push({ href: "/licencia", texto: "Mi licencia", corto: "Licencia", icono: BadgeCheck, admin: true });
  return it;
}

const ITEMS_PLATAFORMA: Item[] = [
  { href: "/plataforma", texto: "Panel", icono: LayoutDashboard },
  { href: "/plataforma/empresas", texto: "Empresas", icono: Building },
  { href: "/plataforma/planes", texto: "Planes y módulos", corto: "Planes", icono: Layers },
  { href: "/plataforma/parametros", texto: "Parámetros legales", corto: "Parámetros", icono: Scale },
  { href: "/plataforma/auditoria", texto: "Auditoría", icono: ScrollText },
];

function Campana({ oscuro }: { oscuro?: boolean }) {
  const [n, setN] = useState<{ total: number; altas: number } | null>(null);
  useEffect(() => {
    let vivo = true;
    const cargar = () => api<{ total: number; altas: number }>("alertas").then((r) => vivo && setN(r)).catch(() => {});
    cargar();
    const t = setInterval(cargar, 5 * 60_000);
    return () => { vivo = false; clearInterval(t); };
  }, []);
  return (
    <Link href="/alertas" aria-label={n ? `${n.total} alertas` : "Alertas"}
      className={cx("relative grid size-11 place-items-center rounded-lg transition-colors", oscuro ? "hover:bg-sobre-marca/10" : "text-suave hover:bg-marca-50 hover:text-marca-texto")}>
      <Bell className="size-5" aria-hidden />
      {n && n.total > 0 && (
        <span className={cx("absolute right-1 top-1 grid min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold leading-5 text-white ring-2", oscuro ? "ring-marca" : "ring-white", n.altas ? "bg-error" : "bg-alerta")}>
          {n.total > 99 ? "99+" : n.total}
        </span>
      )}
    </Link>
  );
}

type EvInstalar = Event & { prompt: () => Promise<void> };
function useInstalar() {
  const [ev, setEv] = useState<EvInstalar | null>(null);
  useEffect(() => {
    const f = (e: Event) => { e.preventDefault(); setEv(e as EvInstalar); };
    window.addEventListener("beforeinstallprompt", f);
    return () => window.removeEventListener("beforeinstallprompt", f);
  }, []);
  return ev ? async () => { await ev.prompt(); setEv(null); } : null;
}

/**
 * Logo de la empresa; si no tiene, su inicial sobre el color de marca.
 * El panel de plataforma (administra todas las empresas) es marca blanca: no lleva el logo de ninguna empresa, solo un símbolo neutro.
 */
function LogoMarca({ e, plataforma, grande }: { e: Marca | null; plataforma: boolean; grande?: boolean }) {
  const nombre = e?.nombre_app || e?.nombre || "";
  const alto = grande ? "h-11 max-w-44" : "h-8 max-w-28";
  const caja = cx("grid shrink-0 place-items-center rounded-lg bg-sobre-marca/15 text-sobre-marca", grande ? "size-11" : "size-8");
  if (plataforma) return <span aria-hidden className={caja}><ShieldCheck className={grande ? "size-6" : "size-5"} /></span>;
  if (e?.logo_claro) return <img src={e.logo_claro} alt={nombre} className={cx(alto, "w-auto object-contain")} />;
  return <span aria-hidden className={cx(caja, "font-extrabold", grande ? "text-xl" : "text-base")}>{nombre.charAt(0).toUpperCase() || "E"}</span>;
}

export function Shell({ children }: { children: ReactNode }) {
  const { me, salir } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const aviso = useAviso();
  const instalar = useInstalar();
  const [mas, setMas] = useState(false);
  const plataforma = me.ambito === "plataforma";
  const items = plataforma ? ITEMS_PLATAFORMA : itemsEmpresa(me.modulos, me.rol);
  const e = me.empresa;
  const nombreApp = plataforma ? "Plataforma" : e?.nombre_app || e?.nombre || "";
  const lic = me.licencia;

  // Guardas de ámbito: el super admin no ve la app de empresa (salvo suplantando) y viceversa
  useEffect(() => {
    if (plataforma && !pathname.startsWith("/plataforma") && pathname !== "/cambiar-password") router.replace("/plataforma");
    if (!plataforma && pathname.startsWith("/plataforma")) router.replace("/");
  }, [plataforma, pathname, router]);

  // Al cambiar de pantalla el foco va al título (lectores de pantalla); no en la primera carga
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) { primera.current = false; return; }
    requestAnimationFrame(() => document.querySelector<HTMLElement>("main h1")?.focus({ preventScroll: true }));
  }, [pathname]);

  const activo = (h: string) => (h === "/" ? pathname === "/" : h === "/plataforma" ? pathname === h : pathname.startsWith(h));

  async function salirSuplantacion() {
    // Recarga completa: evita que el guardián de ámbito use la sesión anterior mientras se renueva
    // Recarga completa a propósito: la cookie de sesión cambia y no debe quedar estado de la vista anterior
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    try { await post("/api/suplantar/salir"); window.location.href = "/plataforma"; } catch { aviso("No se pudo salir de la vista", "error"); }
  }

  // Navegación inferior: como máximo 5 destinos (4 + «Más», que también lleva la sesión)
  const barra = items.slice(0, 4);
  const resto = items.slice(4);
  const enResto = resto.some((i) => activo(i.href));
  const inicial = (me.nombre || "?").charAt(0).toUpperCase();

  return (
    <div className="min-h-dvh lg:pl-64">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:rounded-lg focus:bg-white focus:p-3 focus:font-semibold focus:text-tinta">
        Saltar al contenido
      </a>

      {/* Barra lateral (escritorio) */}
      <aside className="sobre-oscuro fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-marca text-sobre-marca lg:flex no-imprimir">
        <div className="px-5 pb-3 pt-5">
          <LogoMarca e={e} plataforma={plataforma} grande />
          <p className="mt-2.5 truncate text-sm font-bold">{nombreApp}</p>
          <span className="mt-1.5 block h-0.5 w-8 rounded-full bg-marca2" aria-hidden />
        </div>
        <nav aria-label="Principal" className="desplazable-oscuro flex-1 space-y-0.5 overflow-y-auto py-1 pl-3 pr-1.5">
          {items.map((i, n) => (
            <Fragment key={i.href}>
              {i.admin && !items[n - 1]?.admin && <div role="separator" className="!my-2 border-t border-sobre-marca/15" />}
              <Link href={i.href} aria-current={activo(i.href) ? "page" : undefined}
                className={cx("flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-semibold transition-colors duration-150 pointer-fine:min-h-10",
                  activo(i.href) ? "bg-sobre-marca text-marca" : "text-sobre-marca/90 hover:bg-sobre-marca/10 hover:text-sobre-marca")}>
                <i.icono className="size-5 shrink-0" aria-hidden />
                <span className="truncate">{i.texto}</span>
              </Link>
            </Fragment>
          ))}
        </nav>
        <div className="space-y-2 border-t border-sobre-marca/15 p-4">
          {instalar && (
            <button onClick={instalar} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-sm font-medium text-sobre-marca/90 hover:bg-sobre-marca/10 hover:text-sobre-marca">
              <Download className="size-4" aria-hidden /> Instalar app
            </button>
          )}
          <div className="flex items-center gap-3 px-1">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-sobre-marca/15 text-sm font-bold">{inicial}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{me.nombre}</p>
              <p className="truncate text-xs text-sobre-marca/90">{ROL_TEXTO[me.rol] ?? me.rol}</p>
            </div>
            <button onClick={me.suplantando ? salirSuplantacion : salir} aria-label={me.suplantando ? "Salir de la vista" : "Cerrar sesión"} title={me.suplantando ? "Salir de la vista" : "Cerrar sesión"}
              className="grid size-11 shrink-0 place-items-center rounded-lg text-sobre-marca/90 hover:bg-sobre-marca/10 hover:text-sobre-marca">
              <LogOut className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        {/* Cabecera móvil */}
        <header className="sobre-oscuro pt-seguro sticky top-0 z-30 flex h-14 items-center justify-between gap-2 bg-marca px-4 text-sobre-marca lg:hidden no-imprimir">
          <div className="flex min-w-0 items-center gap-2.5">
            <LogoMarca e={e} plataforma={plataforma} />
            <strong className="truncate text-sm">{nombreApp}</strong>
          </div>
          <div className="flex items-center">
            {!plataforma && <Campana oscuro />}
            <button onClick={me.suplantando ? salirSuplantacion : salir} aria-label={me.suplantando ? "Salir de la vista" : "Cerrar sesión"} className="grid size-11 place-items-center rounded-lg hover:bg-sobre-marca/10">
              <LogOut className="size-5" aria-hidden />
            </button>
          </div>
        </header>
        {/* Cabecera de escritorio */}
        <header className="sticky top-0 z-20 hidden h-14 items-center justify-between gap-3 border-b border-borde bg-white/90 px-8 backdrop-blur lg:flex no-imprimir">
          <p className="truncate text-sm font-medium text-suave">{plataforma ? "Administración de la plataforma" : e?.nombre}</p>
          <div className="flex items-center gap-1">
            {me.suplantando && <Boton variante="secundario" tam="sm" icono={<LogOut className="size-4" aria-hidden />} onClick={salirSuplantacion}>Salir de la vista</Boton>}
            {!plataforma && <Campana />}
          </div>
        </header>

        {me.suplantando && (
          <div className="flex items-center justify-center gap-2 bg-alerta-50 px-4 py-2 text-center text-sm font-medium text-alerta">
            <Eye className="size-4 shrink-0" aria-hidden />
            <span>Viendo «{e?.nombre}» como la ve la empresa{me.solo_lectura ? " · solo lectura" : ""}. Esta sesión queda registrada en la auditoría.</span>
          </div>
        )}
        {!plataforma && lic && ["por_vencer", "gracia", "vencida", "prueba"].includes(lic.estado) && (
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8"><Aviso tono={lic.estado === "vencida" || lic.estado === "gracia" ? "alerta" : "info"}>{lic.mensaje}</Aviso></div>
        )}

        <main id="contenido" className="pb-nav mx-auto w-full max-w-7xl flex-1 px-4 pt-5 sm:px-6 lg:px-8 lg:pt-8">
          {/* Fundido corto al cambiar de pantalla (solo opacidad) */}
          <div key={pathname} className="animar-fundido">{children}</div>
        </main>

        {!plataforma && e?.pie && <footer className="border-t border-borde px-6 pt-4 pb-[calc(4.75rem+env(safe-area-inset-bottom))] text-center text-xs text-suave lg:pb-4">{e.pie}</footer>}

        {/* Navegación inferior (celular) */}
        <nav aria-label="Acceso rápido" className="pb-seguro fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-white lg:hidden no-imprimir">
          <ul className="flex">
            {barra.map((i) => (
              <li key={i.href} className="min-w-0 flex-1">
                <Link href={i.href} aria-current={activo(i.href) ? "page" : undefined}
                  className={cx("flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold transition-colors duration-150", activo(i.href) ? "text-marca-texto" : "text-suave active:text-tinta")}>
                  <span className={cx("rounded-full px-3 py-0.5 transition-colors duration-150", activo(i.href) && "bg-marca-100")}><i.icono className="size-5" aria-hidden /></span>
                  <span className="max-w-full truncate">{i.corto ?? i.texto}</span>
                </Link>
              </li>
            ))}
            <li className="min-w-0 flex-1">
              <button onClick={() => setMas(true)} aria-haspopup="dialog" aria-current={enResto ? "page" : undefined}
                className={cx("flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", enResto ? "text-marca-texto" : "text-suave")}>
                <span className={cx("rounded-full px-3 py-0.5", enResto && "bg-marca-100")}><Ellipsis className="size-5" aria-hidden /></span>
                Más
              </button>
            </li>
          </ul>
        </nav>
      </div>

      {/* Hoja "Más" (celular): resto de módulos, sesión e instalación */}
      <Modal abierto={mas} onCerrar={() => setMas(false)} titulo="Más opciones">
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-marca-50 p-3">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-marca text-sm font-bold text-sobre-marca">{inicial}</span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-tinta">{me.nombre}</p>
            <p className="truncate text-sm text-suave">{ROL_TEXTO[me.rol] ?? me.rol}</p>
          </div>
        </div>
        <ul className="space-y-1">
          {resto.map((i) => (
            <li key={i.href}>
              <Link href={i.href} onClick={() => setMas(false)} aria-current={activo(i.href) ? "page" : undefined}
                className={cx("flex min-h-12 items-center gap-3 rounded-lg px-3 font-semibold", activo(i.href) ? "bg-marca-50 text-marca-texto" : "text-tinta hover:bg-marca-50")}>
                <i.icono className="size-5 text-marca-texto" aria-hidden />{i.texto}
              </Link>
            </li>
          ))}
          {instalar && (
            <li><button onClick={() => { void instalar(); setMas(false); }} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 font-semibold text-tinta hover:bg-marca-50"><Download className="size-5 text-marca-texto" aria-hidden />Instalar app</button></li>
          )}
          <li><button onClick={me.suplantando ? salirSuplantacion : salir} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 font-semibold text-error hover:bg-error-50"><LogOut className="size-5" aria-hidden />{me.suplantando ? "Salir de la vista" : "Cerrar sesión"}</button></li>
        </ul>
      </Modal>
    </div>
  );
}
