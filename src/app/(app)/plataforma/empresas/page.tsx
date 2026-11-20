"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building, ChevronRight, Plus, SearchX, X } from "lucide-react";
import { api } from "@/lib/client";
import { ESTADO_TEXTO, fecha, TIPO_TEXTO } from "@/lib/format";
import type { EstadoLic, ResumenEmpresa } from "@/lib/types";
import { Aviso, Boton, Buscador, Esqueleto, InsigniaEstado, Select, Tabla, Titulo, Vacio } from "@/components/ui";

/** Logo de la empresa sobre su color de marca (o su inicial si no tiene logo) */
function LogoEmpresa({ e }: { e: ResumenEmpresa }) {
  return e.logo_claro     ? <img src={e.logo_claro} alt="" className="size-10 shrink-0 rounded-lg object-contain p-1" style={{ background: e.color_primario }} />
    : <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg text-sm font-bold text-white" style={{ background: e.color_primario }}>{e.nombre[0]}</span>;
}

const vence = (e: ResumenEmpresa) => (e.fin ? fecha(e.fin) : e.tipo === "ilimitada" ? "Sin vencimiento" : "—");

export default function Empresas() {
  // useSearchParams necesita un límite de Suspense para el prerender
  return <Suspense fallback={null}><ListaEmpresas /></Suspense>;
}

function ListaEmpresas() {
  const params = useSearchParams();
  const router = useRouter();
  const [lista, setLista] = useState<ResumenEmpresa[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState(params.get("estado") ?? "");
  const modulo = params.get("modulo") ?? "";
  useEffect(() => { api<ResumenEmpresa[]>("platform/empresas").then(setLista).catch((e) => setError(e.message)); }, []);
  const filtrada = useMemo(() => (lista ?? []).filter((e) => (!estado || e.licencia_estado === estado || (estado === "activa" && e.licencia_estado === "por_vencer") || (estado === "gracia" && e.licencia_estado === "vencida")) && (!modulo || e.modulos.includes(modulo)) && `${e.nombre} ${e.slug} ${e.nit}`.toLowerCase().includes(q.toLowerCase())), [lista, q, estado, modulo]);
  const nueva = <Link href="/plataforma/empresas/nueva"><Boton icono={<Plus className="size-4" aria-hidden />}>Nueva empresa</Boton></Link>;

  return (
    <>
      <Titulo sub={lista ? `${lista.length} ${lista.length === 1 ? "empresa" : "empresas"} en la plataforma` : undefined} acciones={nueva}>Empresas</Titulo>
      <div className="mb-4 flex flex-wrap gap-3">
        <Buscador className="min-w-56 flex-1 sm:max-w-sm" etiqueta="Buscar por nombre, código o NIT" valor={q} onChange={setQ} />
        <div className="w-full sm:w-52"><Select value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Filtrar por estado de la licencia"><option value="">Todos los estados</option>{(Object.keys(ESTADO_TEXTO) as EstadoLic[]).map((k) => <option key={k} value={k}>{ESTADO_TEXTO[k]}</option>)}</Select></div>
      </div>
      {modulo && (
        <p className="mb-4 flex flex-wrap items-center gap-2 text-sm text-suave">Con el módulo
          <button type="button" onClick={() => router.replace("/plataforma/empresas")} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-marca-texto bg-marca-50 px-3 font-semibold text-tinta hover:bg-marca-100" aria-label={`Quitar filtro de módulo ${modulo}`}>
            {modulo.replace("_", " ")} <X className="size-3.5" aria-hidden />
          </button>
        </p>
      )}
      {error && <Aviso tono="error">{error}</Aviso>}
      {!lista && !error && <div className="space-y-3">{[0, 1, 2].map((i) => <Esqueleto key={i} className="h-16" />)}</div>}
      {lista && filtrada.length === 0 && (lista.length === 0
        ? <Vacio icono={<Building className="size-6" aria-hidden />} titulo="Aún no hay empresas" texto="Cree la primera: elige su marca, su administrador y su licencia." accion={nueva} />
        : <Vacio icono={<SearchX className="size-6" aria-hidden />} titulo="Sin resultados" texto="Pruebe con otro nombre, código o NIT, o quite el filtro de estado." />)}

      {filtrada.length > 0 && (
        <>
          {/* Celular: tarjetas tocables */}
          <ul className="space-y-3 md:hidden">
            {filtrada.map((e) => (
              <li key={e.id}>
                <Link href={`/plataforma/empresas/${e.id}`} className="flex items-center gap-3 rounded-xl border border-borde bg-white p-3 transition-colors duration-150 hover:border-marca/40 active:bg-marca-50">
                  <LogoEmpresa e={e} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-tinta">{e.nombre}</span>
                    <span className="block truncate text-xs text-suave">{e.slug} · {e.plan ?? "Sin plan"} · {e.modulos.length} módulos</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1"><InsigniaEstado estado={e.licencia_estado} /><span className="text-xs text-suave">Vence: {vence(e)}</span></span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-suave" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>

          {/* Escritorio: tabla */}
          <div className="hidden md:block">
            <Tabla cabeceras={["Empresa", "Plan", "Licencia", "Vence", "Módulos", ""]}>
              {filtrada.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-3"><div className="flex items-center gap-3"><LogoEmpresa e={e} /><div><div className="font-semibold text-tinta">{e.nombre}</div><div className="text-xs text-suave">{e.slug}</div></div></div></td>
                  <td className="px-3 py-3">{e.plan ?? "—"}</td>
                  <td className="px-3 py-3"><InsigniaEstado estado={e.licencia_estado} /><div className="mt-0.5 text-xs text-suave">{e.tipo ? TIPO_TEXTO[e.tipo] : ""}</div></td>
                  <td className="px-3 py-3">{vence(e)}</td>
                  <td className="num px-3 py-3">{e.modulos.length}</td>
                  <td className="px-3 py-3 text-right"><Link href={`/plataforma/empresas/${e.id}`} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 font-semibold text-marca-texto hover:bg-marca-50">Gestionar<ChevronRight className="size-4" aria-hidden /></Link></td>
                </tr>
              ))}
            </Tabla>
          </div>
        </>
      )}
    </>
  );
}
