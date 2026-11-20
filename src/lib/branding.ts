import type { Marca } from "./types";

const HEX = /^#[0-9a-fA-F]{6}$/;

function luminancia(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Texto legible sobre un color de marca (relación de contraste WCAG). */
export const textoSobre = (hex: string) => {
  const L = luminancia(HEX.test(hex) ? hex : "#19185A");
  return (1.05) / (L + 0.05) >= (L + 0.05) / 0.05 ? "#ffffff" : "#111827";
};
export const contraste = (a: string, b: string) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

export const MARCA_PLATAFORMA = { primario: "#19185A", secundario: "#F59E0B" };

export function aplicarMarca(m: Pick<Marca, "color_primario" | "color_secundario"> | null) {
  const root = document.documentElement;
  const p = m && HEX.test(m.color_primario) ? m.color_primario : MARCA_PLATAFORMA.primario;
  const s = m && HEX.test(m.color_secundario) ? m.color_secundario : MARCA_PLATAFORMA.secundario;
  root.style.setProperty("--primario", p);
  root.style.setProperty("--secundario", s);
  root.style.setProperty("--sobre-primario", textoSobre(p));
  root.style.setProperty("--sobre-secundario", textoSobre(s));
}

/** Subdominio de la empresa: torres.tudominio.com -> "torres" (si hay dominio base configurado). */
export function slugDesdeHost(host: string): string | null {
  const base = process.env.NEXT_PUBLIC_BASE_DOMAIN?.toLowerCase();
  const h = host.toLowerCase().split(":")[0];
  if (base && h.endsWith("." + base)) {
    const sub = h.slice(0, -(base.length + 1));
    return sub && !sub.includes(".") && sub !== "www" ? sub : null;
  }
  return null;
}

/** Ruta de acceso a la que volver: el enlace de la empresa recordada, o /login (plataforma). */
export function rutaAcceso(): string {
  try {
    const e = (localStorage.getItem("empresa") ?? "").trim().toLowerCase();
    return /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(e) ? `/${e}` : "/login";
  } catch { return "/login"; }
}
