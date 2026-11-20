import { Campo, Input } from "./ui";

/** Selector de color con el valor hexadecimal visible (no solo una muestra de color) */
export function CampoColor({ etiqueta, ayuda, valor, onChange }: { etiqueta: string; ayuda?: string; valor: string; onChange: (v: string) => void }) {
  return (
    <Campo etiqueta={etiqueta} ayuda={ayuda}>
      <span className="flex items-center gap-3">
        <Input type="color" className="!w-16 shrink-0 !p-1" value={valor} onChange={(e) => onChange(e.target.value)} />
        <code className="num text-sm font-semibold uppercase text-tinta">{valor}</code>
      </span>
    </Campo>
  );
}
