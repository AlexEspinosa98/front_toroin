import { contraste, textoSobre } from "@/lib/branding";

/** Vista previa en vivo de cómo verán la app los usuarios de la empresa. */
export function VistaPreviaMarca({ nombre, primario, secundario, logo, pie }: { nombre: string; primario: string; secundario: string; logo: string | null; pie?: string }) {
  const ok = /^#[0-9a-fA-F]{6}$/.test(primario) && /^#[0-9a-fA-F]{6}$/.test(secundario);
  const p = ok ? primario : "#19185A";
  const s = ok ? secundario : "#F59E0B";
  const bajo = ok && contraste(p, textoSobre(p)) < 4.5;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Vista previa de la marca">
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: p, color: textoSobre(p) }}>
        {logo /* eslint-disable-next-line @next/next/no-img-element */ ? <img src={logo} alt="" className="h-8 max-w-28 object-contain" /> : <span className="grid size-8 place-items-center rounded bg-white/20 text-sm font-bold">{(nombre || "E")[0]}</span>}
        <strong className="truncate text-sm">{nombre || "Nombre de la app"}</strong>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: p, color: textoSobre(p) }}>Botón principal</span>
          <span className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: s, color: textoSobre(s) }}>Acento</span>
        </div>
        <div className="h-2 overflow-hidden rounded bg-slate-100"><div className="h-full w-2/3" style={{ background: s }} /></div>
        {pie && <p className="text-xs text-slate-500">{pie}</p>}
        {bajo && <p className="text-xs text-amber-700">Contraste bajo en el color principal: puede costar leer los textos.</p>}
      </div>
    </div>
  );
}
