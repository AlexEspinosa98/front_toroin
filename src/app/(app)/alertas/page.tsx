"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Aviso, Insignia, Tarjeta, Titulo, Vacio } from "@/components/ui";

export type Alerta = { tipo: string; severidad: "alta" | "media" | "baja"; titulo: string; detalle: string; href: string };
const TONO = { alta: "rojo", media: "ambar", baja: "gris" } as const;
const TEXTO = { alta: "Urgente", media: "Atención", baja: "Informativa" } as const;

export default function Alertas() {
  const [d, setD] = useState<{ total: number; altas: number; alertas: Alerta[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<NonNullable<typeof d>>("alertas").then(setD).catch((e) => setError(e.message)); }, []);
  return (
    <>
      <Titulo sub="Lo que necesita su atención hoy; se actualiza cada vez que entra">Alertas</Titulo>
      {error && <Aviso tono="error">{error}</Aviso>}
      {d && !d.alertas.length && <Vacio>Todo en orden: no hay alertas pendientes.</Vacio>}
      <div className="grid gap-3">
        {d?.alertas.map((a, i) => (
          <Link key={i} href={a.href}>
            <Tarjeta className="transition hover:border-slate-400">
              <div className="flex flex-wrap items-center gap-2"><Insignia tono={TONO[a.severidad]}>{TEXTO[a.severidad]}</Insignia><strong className="text-sm">{a.titulo}</strong></div>
              <p className="mt-1 text-sm text-slate-600">{a.detalle}</p>
            </Tarjeta>
          </Link>
        ))}
      </div>
    </>
  );
}
