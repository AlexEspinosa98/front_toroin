// Cliente del navegador: habla con el proxy interno (/api/proxy), nunca directo con el backend.
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function mensaje(data: unknown, status: number): string {
  const d = (data as { detail?: unknown })?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => (e as { msg?: string }).msg ?? "").filter(Boolean).join(". ") || "Datos inválidos";
  return status >= 500 ? "Error del servidor. Intente de nuevo." : "No se pudo completar la acción";
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const r = await fetch(`/api/proxy/${path}`, {
    method,
    headers: { "x-toroin": "1", ...(opts.body !== undefined ? { "content-type": "application/json" } : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  if (r.status === 204) return undefined as T;
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new ApiError(r.status, mensaje(data, r.status));
  return data as T;
}

/** Descarga un archivo del backend (PDF de un otrosí, por ejemplo) y lo abre en una pestaña nueva. */
export async function abrirArchivo(path: string): Promise<void> {
  const r = await fetch(`/api/proxy/${path}`, { headers: { "x-toroin": "1" }, cache: "no-store" });
  if (!r.ok) throw new ApiError(r.status, mensaje(await r.json().catch(() => null), r.status));
  const url = URL.createObjectURL(await r.blob());
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function post(url: string, body?: unknown) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "x-toroin": "1", "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new ApiError(r.status, mensaje(data, r.status));
  return data;
}
