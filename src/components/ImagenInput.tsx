"use client";
import { useRef, useState } from "react";
import { Boton } from "./ui";

const MAX_CHARS = 380_000; // el backend acepta ~400.000 caracteres de data URI

/** Reduce y comprime la imagen en el navegador para que quepa como base64 en la base de datos. */
async function procesar(file: File, maxLado: number): Promise<string> {
  if (file.type === "image/svg+xml") {
    const url = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
    if (url.length > MAX_CHARS) throw new Error("El SVG es muy pesado (máx. ~280 KB)");
    return url;
  }
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  let url = c.toDataURL("image/png");
  if (url.length > MAX_CHARS) url = c.toDataURL("image/webp", 0.85);
  if (url.length > MAX_CHARS) url = c.toDataURL("image/webp", 0.6);
  if (url.length > MAX_CHARS) throw new Error("La imagen sigue siendo muy pesada; use una más simple");
  return url;
}

export function ImagenInput({ etiqueta, valor, onChange, maxLado = 480, fondoOscuro }: { etiqueta: string; valor: string | null; onChange: (v: string | null) => void; maxLado?: number; fondoOscuro?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-slate-700">{etiqueta}</span>
      <div className={`grid h-24 place-items-center rounded-lg border border-dashed border-slate-300 ${fondoOscuro ? "bg-slate-800" : "bg-slate-50"}`}>
        {valor ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={valor} alt={etiqueta} className="max-h-20 max-w-[85%] object-contain" /> : <span className="text-xs text-slate-400">Sin imagen</span>}
      </div>
      <div className="flex gap-2">
        <Boton type="button" variante="secundario" className="!min-h-9 flex-1" onClick={() => ref.current?.click()}>{valor ? "Cambiar" : "Subir"}</Boton>
        {valor && <Boton type="button" variante="fantasma" className="!min-h-9" onClick={() => onChange(null)}>Quitar</Boton>}
      </div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = "";
          if (!f) return;
          setError("");
          try { onChange(await procesar(f, maxLado)); } catch (x) { setError(x instanceof Error ? x.message : "No se pudo leer la imagen"); }
        }} />
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
