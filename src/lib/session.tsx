"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { api, ApiError, post } from "./client";
import { aplicarMarca, rutaAcceso } from "./branding";
import type { Me } from "./types";

type Ctx = { me: Me; recargar: () => Promise<void>; salir: () => Promise<void>; tieneModulo: (m: string) => boolean };
const SessionCtx = createContext<Ctx | null>(null);

export const useSession = () => {
  const c = useContext(SessionCtx);
  if (!c) throw new Error("useSession fuera del proveedor");
  return c;
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  const recargar = useCallback(async () => {
    try {
      const m = await api<Me>("auth/me");
      setMe(m);
      aplicarMarca(m.empresa);
      document.title = m.empresa ? m.empresa.nombre_app || m.empresa.nombre : "Plataforma";
      const ic = m.empresa?.icono;
      if (ic) {
        let l = document.querySelector<HTMLLinkElement>("link[rel='icon']");
        if (!l) { l = document.createElement("link"); l.rel = "icon"; document.head.appendChild(l); }
        l.href = ic;
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.replace(rutaAcceso());
      else if (e instanceof ApiError && e.status === 403) { setError(e.message); }
      else setError("No se pudo conectar con el servidor");
    }
  }, [router]);

  useEffect(() => { void Promise.resolve().then(recargar); }, [recargar]);

  // Quien debe cambiar su clave temporal no navega a ningún otro lado
  useEffect(() => {
    if (me?.debe_cambiar_password && pathname !== "/cambiar-password") router.replace("/cambiar-password");
  }, [me, pathname, router]);

  const salir = useCallback(async () => {
    await post("/api/auth/logout").catch(() => {});
    router.replace(rutaAcceso());
  }, [router]);

  if (error && !me)
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="flex max-w-md flex-col items-center gap-4">
          <span className="rounded-full bg-error-50 p-3 text-error"><TriangleAlert className="size-6" aria-hidden /></span>
          <p className="text-lg font-semibold text-tinta">{error}</p>
          <button onClick={salir} className="min-h-11 rounded-lg bg-marca px-4 font-semibold text-sobre-marca hover:bg-marca-700">Volver al inicio de sesión</button>
        </div>
      </div>
    );
  if (!me)
    return (
      <div role="status" aria-label="Cargando" className="grid min-h-dvh place-items-center">
        <span className="size-8 animate-spin rounded-full border-[3px] border-marca-100 border-t-marca" aria-hidden />
      </div>
    );

  return (
    <SessionCtx.Provider value={{ me, recargar, salir, tieneModulo: (m) => me.modulos.includes(m) }}>{children}</SessionCtx.Provider>
  );
}
