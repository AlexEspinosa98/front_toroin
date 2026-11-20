import { API_URL, tokenActual } from "@/lib/server";

export const dynamic = "force-dynamic";

// Ícono de la empresa (guardado como data URI) servido como imagen; si no hay, el de la plataforma.
export async function GET(req: Request) {
  const token = await tokenActual();
  if (token) {
    try {
      const r = await fetch(`${API_URL}/auth/me`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
      const uri: string | null = r.ok ? (await r.json()).empresa?.icono : null;
      const m = uri?.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
      if (m) return new Response(Buffer.from(m[2], "base64"), { headers: { "content-type": m[1], "cache-control": "private, max-age=3600" } });
    } catch { /* ícono por defecto */ }
  }
  return Response.redirect(new URL("/icon-512.png", req.url), 302);
}
