// Utilidades solo de servidor (rutas /api). El token vive en una cookie httpOnly: el JavaScript del navegador nunca lo ve.
import { cookies } from "next/headers";

export const API_URL = (process.env.API_URL ?? "http://localhost:8000").replace(/\/$/, "");
export const COOKIE = "tk";
export const COOKIE_ORIG = "tk_orig"; // token del super admin mientras suplanta

export const opcionesCookie = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

export async function tokenActual(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE)?.value;
}

/** Defensa CSRF: los cambios exigen una cabecera propia que un formulario de otro sitio no puede enviar. */
export function esPeticionLegitima(req: Request): boolean {
  return req.method === "GET" || req.headers.get("x-toroin") === "1";
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}
