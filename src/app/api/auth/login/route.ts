import { cookies } from "next/headers";
import { API_URL, COOKIE, COOKIE_ORIG, esPeticionLegitima, json, opcionesCookie } from "@/lib/server";

export async function POST(req: Request) {
  if (!esPeticionLegitima(req)) return json({ detail: "Petición no válida" }, 400);
  const body = await req.text();
  const r = await fetch(`${API_URL}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return json({ detail: typeof data.detail === "string" ? data.detail : "No se pudo iniciar sesión" }, r.status);
  const jar = await cookies();
  jar.set(COOKIE, data.token, opcionesCookie(60 * 60 * 8));
  jar.delete(COOKIE_ORIG);
  return json({ debe_cambiar_password: data.debe_cambiar_password });
}
