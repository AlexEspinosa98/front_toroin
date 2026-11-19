"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { fecha, limiteTexto } from "@/lib/format";
import { InsigniaEstado, Tarjeta, Titulo } from "@/components/ui";

type Lic = { uso: Record<string, number>; limites: Record<string, number | null>; fin: string | null; plan: string | null; modulos: { clave: string; nombre: string; activo: boolean }[] };

export default function Inicio() {
  const { me } = useSession();
  const [lic, setLic] = useState<Lic | null>(null);
  useEffect(() => { if (me.ambito === "empresa") api<Lic>("empresa/licencia").then(setLic).catch(() => {}); }, [me.ambito]);
  if (me.ambito !== "empresa") return null;

  const contadores = [
    { k: "obras", t: "Obras", m: "obras" }, { k: "trabajadores", t: "Trabajadores", m: "personal" }, { k: "usuarios", t: "Usuarios", m: "usuarios" },
  ].filter((c) => me.modulos.includes(c.m));

  return (
    <>
      <Titulo sub={`Hola, ${me.nombre}`}>{me.empresa?.nombre_app || me.empresa?.nombre}</Titulo>
      <div className="grid gap-4 sm:grid-cols-3">
        {contadores.map((c) => {
          const tope = lic?.limites[`max_${c.k}`];
          return (
            <Tarjeta key={c.k}>
              <p className="text-sm text-slate-500">{c.t}</p>
              <p className="text-3xl font-bold">{lic ? lic.uso[c.k] ?? 0 : "…"}</p>
              {lic && <p className="text-xs text-slate-500">de {limiteTexto(tope)}</p>}
            </Tarjeta>
          );
        })}
      </div>
      <Tarjeta titulo="Módulos de su licencia" className="mt-4" acciones={me.licencia && <InsigniaEstado estado={me.licencia.estado} />}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {lic?.modulos.map((m) => (
            <div key={m.clave} className={`rounded-lg border px-3 py-2 text-sm ${m.activo ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
              {m.nombre} {m.activo ? "✓" : "· no incluido"}
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-600">Plan {lic?.plan ?? "—"} · vigencia hasta {lic?.fin ? fecha(lic.fin) : "sin vencimiento"}. <Link className="font-semibold underline" href="/licencia">Ver detalle</Link></p>
      </Tarjeta>
    </>
  );
}
