"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { ESTADO_TEXTO, fecha, TIPO_TEXTO } from "@/lib/format";
import type { EstadoLic, ResumenEmpresa } from "@/lib/types";
import { Aviso, Boton, Input, InsigniaEstado, Select, Tabla, Titulo, Vacio } from "@/components/ui";

export default function Empresas() {
  const [lista, setLista] = useState<ResumenEmpresa[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  useEffect(() => { api<ResumenEmpresa[]>("platform/empresas").then(setLista).catch((e) => setError(e.message)); }, []);
  const filtrada = useMemo(() => (lista ?? []).filter((e) => (!estado || e.licencia_estado === estado) && `${e.nombre} ${e.slug} ${e.nit}`.toLowerCase().includes(q.toLowerCase())), [lista, q, estado]);
  return (
    <>
      <Titulo acciones={<Link href="/plataforma/empresas/nueva"><Boton>Nueva empresa</Boton></Link>}>Empresas</Titulo>
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="min-w-56 flex-1 sm:max-w-sm"><Input placeholder="Buscar por nombre, código o NIT" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" /></div>
        <div className="w-48"><Select value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Filtrar por estado"><option value="">Todos los estados</option>{(Object.keys(ESTADO_TEXTO) as EstadoLic[]).map((k) => <option key={k} value={k}>{ESTADO_TEXTO[k]}</option>)}</Select></div>
      </div>
      {error && <Aviso tono="error">{error}</Aviso>}
      {lista && (filtrada.length === 0 ? <Vacio>{lista.length ? "Sin resultados." : "Aún no hay empresas. Cree la primera."}</Vacio> : (
        <Tabla cabeceras={["Empresa", "Plan", "Licencia", "Vence", "Módulos", ""]}>
          {filtrada.map((e) => (
            <tr key={e.id}>
              <td className="px-3 py-3"><div className="flex items-center gap-3">
                {e.logo_claro /* eslint-disable-next-line @next/next/no-img-element */ ? <img src={e.logo_claro} alt="" className="size-8 rounded object-contain" style={{ background: e.color_primario }} /> : <span className="grid size-8 place-items-center rounded text-xs font-bold text-white" style={{ background: e.color_primario }}>{e.nombre[0]}</span>}
                <div><div className="font-medium">{e.nombre}</div><div className="text-xs text-slate-500">{e.slug}</div></div></div></td>
              <td className="px-3 py-3">{e.plan ?? "—"}</td>
              <td className="px-3 py-3"><InsigniaEstado estado={e.licencia_estado} /><div className="mt-0.5 text-xs text-slate-500">{e.tipo ? TIPO_TEXTO[e.tipo] : ""}</div></td>
              <td className="px-3 py-3">{e.fin ? fecha(e.fin) : e.tipo === "ilimitada" ? "Sin vencimiento" : "—"}</td>
              <td className="px-3 py-3">{e.modulos.length}</td>
              <td className="px-3 py-3 text-right"><Link href={`/plataforma/empresas/${e.id}`} className="font-semibold underline">Gestionar</Link></td>
            </tr>
          ))}
        </Tabla>
      ))}
    </>
  );
}
