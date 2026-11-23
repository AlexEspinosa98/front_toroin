"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, post } from "@/lib/client";
import { aplicarMarca, slugDesdeHost } from "@/lib/branding";
import type { Marca } from "@/lib/types";
import { Eye, EyeOff, LogIn, ShieldCheck } from "lucide-react";
import { Aviso, Boton, Campo, Input } from "@/components/ui";

export function LoginForm({ slugFijo }: { slugFijo?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [slug, setSlug] = useState("");
  const [fijo, setFijo] = useState(false); // el subdominio fija la empresa
  const [marca, setMarca] = useState<Marca | null>(null);
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [ver, setVer] = useState(false);

  useEffect(() => {
    const host = slugFijo ?? slugDesdeHost(window.location.host);
    const guardado = (() => { try { return localStorage.getItem("empresa") ?? ""; } catch { return ""; } })();
    const s = host ?? params.get("empresa") ?? guardado;
    // localStorage y el host solo existen en el navegador: se leen al montar y se aplican fuera del cuerpo del efecto
    void Promise.resolve().then(() => { setFijo(!!host); setSlug(s); });
  }, [params, slugFijo]);

  // Marca de la empresa en la pantalla de login (antes de autenticarse)
  useEffect(() => {
    const s = slug.trim().toLowerCase();
    const t = setTimeout(() => {
      if (!s) { setMarca(null); aplicarMarca(null); return; }
      api<Marca>(`public/empresas/${encodeURIComponent(s)}/marca`).then((m) => { setMarca(m); aplicarMarca(m); document.title = m.nombre_app || m.nombre; }).catch(() => { setMarca(null); aplicarMarca(null); });
    }, s ? 350 : 0);
    return () => clearTimeout(t);
  }, [slug]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setCargando(true);
    try {
      await post("/api/auth/login", { correo: correo.trim(), password, empresa: slug.trim().toLowerCase() || null });
      try { localStorage.setItem("empresa", slug.trim().toLowerCase()); } catch {}
      router.replace("/");
    } catch (x) {
      setError(x instanceof Error ? x.message : "No se pudo iniciar sesión");
    } finally { setCargando(false); }
  }

  const nombre = marca ? marca.nombre_app || marca.nombre : slug ? "Iniciar sesión" : "Plataforma";
  return (
    <main className="sobre-oscuro relative grid min-h-dvh place-items-center overflow-hidden bg-marca p-4 pt-seguro">
      {/* Fondo: degradado suave del color de la empresa con un destello del acento */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_40rem_at_85%_-10%,color-mix(in_oklab,var(--secundario)_28%,transparent),transparent),radial-gradient(50rem_40rem_at_0%_110%,color-mix(in_oklab,var(--sobre-primario)_14%,transparent),transparent)]" />
      <div className="animar-aviso relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-col items-center gap-3 bg-marca px-6 pb-7 pt-8 text-sobre-marca">
          {marca?.logo_claro  ? <img src={marca.logo_claro} alt={marca.nombre} className="max-h-16 max-w-48 object-contain" />
            : !slug ? <span aria-hidden className="grid size-14 place-items-center rounded-2xl bg-sobre-marca/15"><ShieldCheck className="size-8" /></span> : null}
          <h1 className="text-center text-xl font-bold text-balance">{nombre}</h1>
          {!slug && <p className="-mt-2 text-sm opacity-90">Administración de empresas</p>}
          <span className="h-0.5 w-10 rounded-full bg-marca2" aria-hidden />
        </div>
        <form onSubmit={enviar} className="space-y-4 p-6">
          {!fijo && (
            <Campo etiqueta="Código de empresa" ayuda="Déjelo vacío solo si es personal de la plataforma.">
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} autoCapitalize="none" autoComplete="organization" placeholder="ej. torres" />
            </Campo>
          )}
          <Campo etiqueta="Correo"><Input type="email" required value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="username" /></Campo>
          <Campo etiqueta="Contraseña">
            <span className="relative block">
              <Input type={ver ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="pr-12" />
              <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={ver}
                className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-suave hover:text-tinta">
                {ver ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
              </button>
            </span>
          </Campo>
          {error && <Aviso tono="error">{error}</Aviso>}
          <Boton type="submit" tam="lg" cargando={cargando} icono={cargando ? undefined : <LogIn className="size-5" aria-hidden />} className="w-full">{cargando ? "Ingresando…" : "Ingresar"}</Boton>
        </form>
        {marca?.pie && <p className="border-t border-borde px-6 py-3 text-center text-xs text-suave">{marca.pie}</p>}
      </div>
    </main>
  );
}

export function LoginEmpresa({ slugFijo }: { slugFijo?: string }) {
  return <Suspense><LoginForm slugFijo={slugFijo} /></Suspense>;
}
