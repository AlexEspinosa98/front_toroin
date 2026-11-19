import { cookies } from "next/headers";
import { API_URL, COOKIE, COOKIE_ORIG, esPeticionLegitima, json, opcionesCookie, tokenActual } from "@/lib/server";

/** El super admin pide un token temporal para ver la app como una empresa (solo lectura, con motivo y auditoría). */
export async function POST(req: Request) {
  if (!esPeticionLegitima(req)) return json({ detail: "Petición no válida" }, 400);
  const { empresaId, motivo, soloLectura } = await req.json();
  const original = await tokenActual();
  if (!original) return json({ detail: "No autenticado" }, 401);
  const r = await fetch(`${API_URL}/platform/empresas/${encodeURIComponent(empresaId)}/impersonar`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${original}` },
    body: JSON.stringify({ motivo, solo_lectura: soloLectura !== false }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return json({ detail: typeof data.detail === "string" ? data.detail : "No se pudo iniciar la vista" }, r.status);
  const jar = await cookies();
  jar.set(COOKIE_ORIG, original, opcionesCookie(60 * 60 * 2));
  jar.set(COOKIE, data.token, opcionesCookie(60 * 60));
  return json({ ok: true });
}
