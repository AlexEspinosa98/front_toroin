import { API_URL, tokenActual } from "@/lib/server";

export const dynamic = "force-dynamic";

// Manifiesto de la app instalable: toma el nombre, el color y el ícono de la empresa si hay sesión.
export async function GET() {
  let nombre = "TOROIN", color = "#19185A", icono = false;
  const token = await tokenActual();
  if (token) {
    try {
      const r = await fetch(`${API_URL}/auth/me`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
      if (r.ok) {
        const e = (await r.json()).empresa;
        if (e) { nombre = e.nombre_app || e.nombre || nombre; color = e.color_primario || color; icono = !!e.icono; }
      }
    } catch { /* manifiesto por defecto */ }
  }
  const iconos = icono
    ? [{ src: "/api/icono", sizes: "192x192", type: "image/png", purpose: "any" }, { src: "/api/icono", sizes: "512x512", type: "image/png", purpose: "any" }]
    : [{ src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" }, { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" }];
  return Response.json({
    name: nombre, short_name: nombre.slice(0, 12), description: "Gestión de obra, personal y finanzas", lang: "es", start_url: "/", scope: "/",
    display: "standalone", orientation: "portrait", background_color: "#f6f7fb", theme_color: color, icons: iconos,
  }, { headers: { "content-type": "application/manifest+json", "cache-control": "private, no-store" } });
}
