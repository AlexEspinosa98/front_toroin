"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
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
      document.title = m.empresa ? m.empresa.nombre_app || m.empresa.nombre : "TOROIN · Plataforma";
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

  useEffect(() => { void recargar(); }, [recargar]);

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
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <p className="text-lg font-semibold text-slate-800">{error}</p>
          <button onClick={salir} className="rounded-lg bg-slate-800 px-4 py-2 text-white">Volver al inicio de sesión</button>
        </div>
      </div>
    );
  if (!me) return <div className="grid min-h-screen place-items-center text-slate-500">Cargando…</div>;

  return (
    <SessionCtx.Provider value={{ me, recargar, salir, tieneModulo: (m) => me.modulos.includes(m) }}>{children}</SessionCtx.Provider>
  );
}
