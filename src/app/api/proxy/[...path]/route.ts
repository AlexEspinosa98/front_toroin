import { API_URL, esPeticionLegitima, json, tokenActual } from "@/lib/server";

// Solo se reenvían estas rutas del backend. Login/logout tienen su propio manejador (cookie).
const PERMITIDAS = ["platform/", "empresa/", "obras", "personal", "asignaciones", "asistencia", "contratos", "bitacora", "tareas", "fotos", "epp", "inventario", "compras", "presupuesto", "cronograma", "alertas", "config", "festivos", "control-personal", "pagos", "finanzas", "gastos", "facturas", "actividades", "tarifas", "auth/me", "auth/cambiar-password", "public/empresas/"];

async function reenviar(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const ruta = path.join("/");
  if (!PERMITIDAS.some((p) => ruta === p || ruta.startsWith(p))) return json({ detail: "Ruta no permitida" }, 404);
  if (!esPeticionLegitima(req)) return json({ detail: "Petición no válida" }, 400);

  const headers: Record<string, string> = {};
  const token = await tokenActual();
  if (token) headers.authorization = `Bearer ${token}`;
  const ct = req.headers.get("content-type");
  if (ct) headers["content-type"] = ct;

  const url = new URL(req.url);
  const r = await fetch(`${API_URL}/${ruta}${url.search}`, {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.text(),
    cache: "no-store",
  });
  const texto = await r.text();
  return new Response(texto || null, {
    status: r.status,
    headers: { "content-type": r.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
  });
}

export { reenviar as GET, reenviar as POST, reenviar as PUT, reenviar as PATCH, reenviar as DELETE };
