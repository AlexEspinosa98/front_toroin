import { cookies } from "next/headers";
import { COOKIE, COOKIE_ORIG, esPeticionLegitima, json, opcionesCookie } from "@/lib/server";

export async function POST(req: Request) {
  if (!esPeticionLegitima(req)) return json({ detail: "Petición no válida" }, 400);
  const jar = await cookies();
  const original = jar.get(COOKIE_ORIG)?.value;
  if (original) jar.set(COOKIE, original, opcionesCookie(60 * 60 * 8));
  else jar.delete(COOKIE);
  jar.delete(COOKIE_ORIG);
  return json({ ok: true });
}
