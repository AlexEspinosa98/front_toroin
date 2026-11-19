"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { ESTADO_TEXTO, fecha } from "@/lib/format";
import type { EstadoLic } from "@/lib/types";
import { Aviso, Boton, InsigniaEstado, Tabla, Tarjeta, Titulo, Vacio } from "@/components/ui";

type D = { empresas: number; por_estado: Record<string, number>; por_vencer: { id: string; nombre: string; slug: string; licencia_estado: EstadoLic; fin: string; dias_restantes: number }[]; usuarios: number; obras: number; trabajadores: number };

export default function Panel() {
  const [d, setD] = useState<D | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<D>("platform/dashboard").then(setD).catch((e) => setError(e.message)); }, []);
  if (error) return <Aviso tono="error">{error}</Aviso>;
  if (!d) return null;
  const tiles = [
    { t: "Empresas", v: d.empresas }, { t: "Activas", v: (d.por_estado.activa ?? 0) + (d.por_estado.por_vencer ?? 0) },
    { t: "En prueba", v: d.por_estado.prueba ?? 0 }, { t: "Vencidas / gracia", v: (d.por_estado.vencida ?? 0) + (d.por_estado.gracia ?? 0) },
    { t: "Suspendidas", v: d.por_estado.suspendida ?? 0 }, { t: "Usuarios", v: d.usuarios }, { t: "Obras", v: d.obras }, { t: "Trabajadores", v: d.trabajadores },
  ];
  return (
    <>
      <Titulo sub="Resumen de todas las empresas de la plataforma" acciones={<Link href="/plataforma/empresas/nueva"><Boton>Nueva empresa</Boton></Link>}>Panel</Titulo>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (<Tarjeta key={t.t}><p className="text-xs uppercase tracking-wide text-slate-500">{t.t}</p><p className="text-3xl font-bold">{t.v}</p></Tarjeta>))}
      </div>
      <Tarjeta titulo="Licencias por vencer y pruebas en curso" className="mt-4">
        {d.por_vencer.length === 0 ? <Vacio>Nada por vencer en los próximos días.</Vacio> : (
          <Tabla cabeceras={["Empresa", "Estado", "Vence", "Días"]}>
            {d.por_vencer.map((e) => (
              <tr key={e.id}><td className="px-3 py-3"><Link className="font-medium underline" href={`/plataforma/empresas/${e.id}`}>{e.nombre}</Link> <span className="text-xs text-slate-500">({e.slug})</span></td>
                <td className="px-3 py-3"><InsigniaEstado estado={e.licencia_estado} /></td><td className="px-3 py-3">{fecha(e.fin)}</td>
                <td className="px-3 py-3 font-semibold">{e.dias_restantes}</td></tr>
            ))}
          </Tabla>)}
      </Tarjeta>
      <p className="mt-3 text-xs text-slate-500">Estados: {Object.keys(ESTADO_TEXTO).map((k) => `${ESTADO_TEXTO[k as EstadoLic]} ${d.por_estado[k] ?? 0}`).join(" · ")}</p>
    </>
  );
}
