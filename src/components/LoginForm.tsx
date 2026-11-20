"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, post } from "@/lib/client";
import { aplicarMarca, slugDesdeHost } from "@/lib/branding";
import type { Marca } from "@/lib/types";
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

  useEffect(() => {
    const host = slugFijo ?? slugDesdeHost(window.location.host);
    const guardado = (() => { try { return localStorage.getItem("empresa") ?? ""; } catch { return ""; } })();
    const s = host ?? params.get("empresa") ?? guardado;
    setFijo(!!host);
    setSlug(s);
  }, [params, slugFijo]);

  // Marca de la empresa en la pantalla de login (antes de autenticarse)
  useEffect(() => {
    const s = slug.trim().toLowerCase();
    if (!s) { setMarca(null); aplicarMarca(null); return; }
    const t = setTimeout(() => {
      api<Marca>(`public/empresas/${encodeURIComponent(s)}/marca`).then((m) => { setMarca(m); aplicarMarca(m); document.title = m.nombre_app || m.nombre; }).catch(() => { setMarca(null); aplicarMarca(null); });
    }, 350);
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

  return (
    <main className="grid min-h-screen place-items-center bg-fondo p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="flex flex-col items-center gap-3 bg-marca px-6 py-8 text-sobre-marca">
          {marca?.logo_claro /* eslint-disable-next-line @next/next/no-img-element */ ? <img src={marca.logo_claro} alt={marca.nombre} className="max-h-16 max-w-48 object-contain" /> : null}
          <h1 className="text-center text-xl font-bold">{marca ? marca.nombre_app || marca.nombre : slug ? "Iniciar sesión" : "TOROIN · Plataforma"}</h1>
        </div>
        <form onSubmit={enviar} className="space-y-4 p-6">
          {!fijo && (
            <Campo etiqueta="Código de empresa" ayuda="Déjelo vacío solo si es personal de la plataforma.">
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} autoCapitalize="none" autoComplete="organization" placeholder="ej. torres" />
            </Campo>
          )}
          <Campo etiqueta="Correo"><Input type="email" required value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="username" /></Campo>
          <Campo etiqueta="Contraseña"><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Campo>
          {error && <Aviso tono="error">{error}</Aviso>}
          <Boton type="submit" disabled={cargando} className="w-full">{cargando ? "Ingresando…" : "Ingresar"}</Boton>
        </form>
        {marca?.pie && <p className="border-t border-slate-100 px-6 py-3 text-center text-xs text-slate-500">{marca.pie}</p>}
      </div>
    </main>
  );
}

export function LoginEmpresa({ slugFijo }: { slugFijo?: string }) {
  return <Suspense><LoginForm slugFijo={slugFijo} /></Suspense>;
}
