import { cookies } from "next/headers";
import { COOKIE, COOKIE_ORIG, esPeticionLegitima, json } from "@/lib/server";

export async function POST(req: Request) {
  if (!esPeticionLegitima(req)) return json({ detail: "Petición no válida" }, 400);
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete(COOKIE_ORIG);
  return json({ ok: true });
}
