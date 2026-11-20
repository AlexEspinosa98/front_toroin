import { notFound } from "next/navigation";
import { LoginEmpresa } from "@/components/LoginForm";
import { API_URL } from "@/lib/server";

// Enlace de acceso de una empresa: https://<front>/<codigo>  (p. ej. /toroin)
export default async function AccesoEmpresa({ params }: { params: Promise<{ empresa: string }> }) {
  const { empresa } = await params;
  const slug = empresa.toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(slug)) notFound();
  const r = await fetch(`${API_URL}/public/empresas/${encodeURIComponent(slug)}/marca`, { cache: "no-store" }).catch(() => null);
  if (!r || r.status === 404) notFound();
  return <LoginEmpresa slugFijo={slug} />;
}
