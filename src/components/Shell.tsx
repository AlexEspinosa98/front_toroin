"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "@/lib/session";
import { api, post } from "@/lib/client";
import { ROL_TEXTO } from "@/lib/format";
import { Aviso, Boton, cx, useAviso } from "./ui";

type Item = { href: string; texto: string };

const NOMBRES: Record<string, string> = {
  obras: "Obras", contrato: "Contrato y tablero", personal: "Personal", asistencia: "Asistencia", bitacora: "Bitácora y avance",
  control_personal: "Control de personal", pagos: "Pagos al personal", finanzas: "Finanzas", epp: "EPP / SST",
  inventario: "Inventario y bodega", compras: "Compras", presupuesto: "Presupuesto vs. real", cronograma: "Cronograma",
};
const RUTA_PROPIA = new Set(["obras", "personal", "asistencia", "contrato", "bitacora", "epp", "control_personal", "pagos", "finanzas", "inventario", "compras", "presupuesto", "cronograma"]); // módulos ya portados; el resto usa /m/[clave]

function itemsEmpresa(modulos: string[], rol: string): Item[] {
  const it: Item[] = [{ href: "/", texto: "Inicio" }, { href: "/alertas", texto: "Alertas" }];
  for (const m of modulos) {
    if (m === "usuarios" || !NOMBRES[m]) continue;
    it.push({ href: RUTA_PROPIA.has(m) ? `/${m.replace("_", "-")}` : `/m/${m}`, texto: NOMBRES[m] });
  }
  if (modulos.includes("control_personal") && (rol === "admin" || rol === "gerencia" || rol === "super_admin")) it.push({ href: "/ajustes", texto: "Ajustes" });
  if (modulos.includes("usuarios")) it.push({ href: "/usuarios", texto: "Usuarios" });
  if (rol === "admin" || rol === "super_admin") { it.push({ href: "/actividad", texto: "Actividad" }); it.push({ href: "/marca", texto: "Marca" }); }
  it.push({ href: "/licencia", texto: "Mi licencia" });
  return it;
}

const ITEMS_PLATAFORMA: Item[] = [
  { href: "/plataforma", texto: "Panel" },
  { href: "/plataforma/empresas", texto: "Empresas" },
  { href: "/plataforma/planes", texto: "Planes y módulos" },
  { href: "/plataforma/parametros", texto: "Parámetros legales" },
  { href: "/plataforma/auditoria", texto: "Auditoría" },
];

function Campana() {
  const [n, setN] = useState<{ total: number; altas: number } | null>(null);
  useEffect(() => {
    let vivo = true;
    const cargar = () => api<{ total: number; altas: number }>("alertas").then((r) => vivo && setN(r)).catch(() => {});
    cargar();
    const t = setInterval(cargar, 5 * 60_000);
    return () => { vivo = false; clearInterval(t); };
  }, []);
  return (
    <Link href="/alertas" aria-label={n ? `${n.total} alertas` : "Alertas"} className="relative grid size-11 place-items-center rounded-lg hover:bg-white/10 lg:hover:bg-slate-100">
      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9a6 6 0 1 1 12 0c0 6 2 7.5 2 7.5H4S6 15 6 9Z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
      {n && n.total > 0 && <span className={cx("absolute right-1 top-1 grid min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold leading-5 text-white", n.altas ? "bg-red-600" : "bg-amber-500")}>{n.total > 99 ? "99+" : n.total}</span>}
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

export function Shell({ children }: { children: ReactNode }) {
  const { me, salir } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const aviso = useAviso();
  const instalar = useInstalar();
  const [abierto, setAbierto] = useState(false);
  const plataforma = me.ambito === "plataforma";
  const items = plataforma ? ITEMS_PLATAFORMA : itemsEmpresa(me.modulos, me.rol);
  const e = me.empresa;
  const nombreApp = plataforma ? "TOROIN · Plataforma" : e?.nombre_app || e?.nombre || "";
  const lic = me.licencia;

  useEffect(() => setAbierto(false), [pathname]);
  // Guardas de ámbito: el super admin no ve la app de empresa (salvo suplantando) y viceversa
  useEffect(() => {
    if (plataforma && !pathname.startsWith("/plataforma") && pathname !== "/cambiar-password") router.replace("/plataforma");
    if (!plataforma && pathname.startsWith("/plataforma")) router.replace("/");
  }, [plataforma, pathname, router]);

  const activo = (h: string) => (h === "/" ? pathname === "/" : h === "/plataforma" ? pathname === h : pathname.startsWith(h));

  async function salirSuplantacion() {
    // Recarga completa: evita que el guardián de ámbito use la sesión anterior mientras se renueva
    try { await post("/api/suplantar/salir"); window.location.href = "/plataforma"; } catch { aviso("No se pudo salir de la vista", "error"); }
  }

  const nav = (
    <nav aria-label="Principal" className="flex flex-col gap-1 p-3">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={activo(i.href) ? "page" : undefined}
          className={cx("flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition", activo(i.href) ? "bg-marca text-sobre-marca" : "text-slate-700 hover:bg-slate-100")}>
          {i.texto}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden border-r border-slate-200 bg-white lg:block">
        <div className="flex h-16 items-center gap-3 bg-marca px-4 text-sobre-marca">
          {e?.logo_claro /* eslint-disable-next-line @next/next/no-img-element */ ? <img src={e.logo_claro} alt="" className="h-9 max-w-32 object-contain" /> : null}
          <strong className="truncate text-sm">{nombreApp}</strong>
        </div>
        {nav}
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="pt-seguro sticky top-0 z-30 flex h-16 items-center justify-between gap-3 bg-marca px-4 text-sobre-marca lg:bg-white lg:text-slate-900 lg:shadow-sm">
          <div className="flex min-w-0 items-center gap-3 lg:hidden">
            <button onClick={() => setAbierto(true)} aria-label="Abrir menú" className="grid size-11 place-items-center rounded-lg hover:bg-white/10">☰</button>
            {e?.logo_claro /* eslint-disable-next-line @next/next/no-img-element */ ? <img src={e.logo_claro} alt="" className="h-8 max-w-24 object-contain" /> : null}
            <strong className="truncate text-sm">{nombreApp}</strong>
          </div>
          <div className="hidden lg:block text-sm text-slate-500">{plataforma ? "Administración de la plataforma" : e?.nombre}</div>
          <div className="flex items-center gap-1 sm:gap-3">
            {instalar && <Boton variante="secundario" className="!min-h-9 !px-3 !text-slate-900" onClick={instalar}>Instalar app</Boton>}
            {!plataforma && <Campana />}
            <div className="hidden text-right text-xs sm:block">
              <div className="font-semibold">{me.nombre}</div>
              <div className="opacity-70">{ROL_TEXTO[me.rol] ?? me.rol}</div>
            </div>
            {me.suplantando ? <Boton variante="secundario" className="!min-h-9 !text-slate-900" onClick={salirSuplantacion}>Salir de la vista</Boton>
              : <Boton variante="secundario" className="!min-h-9 !text-slate-900" onClick={salir}>Salir</Boton>}
          </div>
        </header>

        {abierto && (
          <div className="fixed inset-0 z-40 lg:hidden" onMouseDown={(ev) => ev.target === ev.currentTarget && setAbierto(false)}>
            <div className="absolute inset-0 bg-slate-900/50" onClick={() => setAbierto(false)} />
            <div className="relative h-full w-72 max-w-[85vw] overflow-y-auto bg-white shadow-xl">
              <div className="flex h-16 items-center justify-between bg-marca px-4 text-sobre-marca">
                <strong className="truncate text-sm">{nombreApp}</strong>
                <button onClick={() => setAbierto(false)} aria-label="Cerrar menú" className="grid size-10 place-items-center rounded-lg hover:bg-white/10">✕</button>
              </div>
              {nav}
            </div>
          </div>
        )}

        {me.suplantando && (
          <div className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">
            Viendo «{e?.nombre}» como la ve la empresa{me.solo_lectura ? " · solo lectura" : ""}. Esta sesión queda registrada en la auditoría.
          </div>
        )}
        {!plataforma && lic && ["por_vencer", "gracia", "vencida", "prueba"].includes(lic.estado) && (
          <div className="px-4 pt-4 sm:px-6"><Aviso tono={lic.estado === "vencida" || lic.estado === "gracia" ? "alerta" : "info"}>{lic.mensaje}</Aviso></div>
        )}

        <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
        <nav aria-label="Acceso rápido" className="pb-seguro fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white lg:hidden no-imprimir">
          <ul className="grid grid-cols-5">
            {items.slice(0, 4).map((i) => (
              <li key={i.href}><Link href={i.href} className={cx("flex h-14 flex-col items-center justify-center px-1 text-center text-[11px] font-medium leading-tight", activo(i.href) ? "text-marca" : "text-slate-500")}>
                <span className={cx("mb-0.5 h-1 w-8 rounded-full", activo(i.href) ? "bg-marca" : "bg-transparent")} />{i.texto.split(" ")[0]}</Link></li>
            ))}
            <li><button onClick={() => setAbierto(true)} className="flex h-14 w-full flex-col items-center justify-center text-[11px] font-medium text-slate-500"><span className="mb-0.5 h-1 w-8" />Más</button></li>
          </ul>
        </nav>
        {!plataforma && e?.pie && <footer className="border-t border-slate-200 px-6 py-4 text-center text-xs text-slate-500">{e.pie}</footer>}
      </div>
    </div>
  );
}
