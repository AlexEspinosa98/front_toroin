"use client";
import { CircleCheck, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { fecha, limiteTexto, TIPO_TEXTO } from "@/lib/format";
import type { EstadoLic } from "@/lib/types";
import { Aviso, InsigniaEstado, Tarjeta, Titulo } from "@/components/ui";

type L = { estado: EstadoLic; mensaje: string; fin: string | null; dias_restantes: number | null; tipo: string | null; plan: string | null;
  modulos: { clave: string; nombre: string; activo: boolean }[]; limites: Record<string, number | null>; uso: Record<string, number> };

export default function Licencia() {
  const [l, setL] = useState<L | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<L>("empresa/licencia").then(setL).catch((e) => setError(e.message)); }, []);
  if (error) return <Aviso tono="error">{error}</Aviso>;
  if (!l) return null;
  const filas: [string, string, string][] = [["Usuarios activos", "usuarios", "max_usuarios"], ["Obras", "obras", "max_obras"], ["Trabajadores", "trabajadores", "max_trabajadores"]];
  return (
    <>
      <Titulo sub="Para renovar, ampliar módulos o límites contacte a su proveedor.">Mi licencia</Titulo>
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Estado" acciones={<InsigniaEstado estado={l.estado} />}>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-suave">Plan</dt><dd>{l.plan ?? "—"}</dd>
            <dt className="text-suave">Tipo</dt><dd>{l.tipo ? TIPO_TEXTO[l.tipo] : "—"}</dd>
            <dt className="text-suave">Vence</dt><dd>{l.fin ? fecha(l.fin) : "Sin vencimiento"}</dd>
            <dt className="text-suave">Días restantes</dt><dd>{l.dias_restantes ?? "—"}</dd>
          </dl>
          {l.mensaje && <div className="mt-3"><Aviso tono={["vencida", "gracia", "suspendida"].includes(l.estado) ? "alerta" : "info"}>{l.mensaje}</Aviso></div>}
        </Tarjeta>
        <Tarjeta titulo="Uso y límites">
          <ul className="space-y-3">
            {filas.map(([t, uso, lim]) => {
              const tope = l.limites[lim]; const n = l.uso[uso] ?? 0;
              return (<li key={uso}><div className="flex justify-between text-sm"><span>{t}</span><span className="font-semibold">{n} / {limiteTexto(tope)}</span></div>
                {tope != null && <div className="mt-1 h-2 overflow-hidden rounded bg-fondo"><div className="h-full bg-marca2" style={{ width: `${Math.min(100, (n / tope) * 100)}%` }} /></div>}</li>);
            })}
          </ul>
        </Tarjeta>
        <Tarjeta titulo="Módulos" className="lg:col-span-2">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {l.modulos.map((m) => (<div key={m.clave} className={`rounded-lg border px-3 py-2.5 text-sm font-medium ${m.activo ? "border-ok/30 bg-ok-50 text-ok" : "border-borde bg-fondo text-placeholder"}`}><span className="flex items-center gap-2">{m.activo ? <CircleCheck className="size-4 shrink-0" aria-hidden /> : <Lock className="size-4 shrink-0" aria-hidden />}<span className="min-w-0 flex-1 truncate">{m.nombre}</span>{!m.activo && <span className="shrink-0 text-xs">No incluido</span>}</span></div>))}
          </div>
        </Tarjeta>
      </div>
    </>
  );
}
