"use client";
import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { api } from "@/lib/client";
import type { Auditoria } from "@/lib/types";
import { TablaAuditoria } from "@/components/TablaAuditoria";
import { Aviso, Esqueleto, Titulo, Vacio } from "@/components/ui";

export default function AuditoriaGlobal() {
  const [a, setA] = useState<Auditoria[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<Auditoria[]>("platform/auditoria?limite=200").then(setA).catch((e) => setError(e.message)); }, []);
  return (
    <>
      <Titulo sub="Últimos 200 eventos de toda la plataforma, incluidas las suplantaciones.">Auditoría</Titulo>
      {error && <Aviso tono="error">{error}</Aviso>}
      {!a && !error && <Esqueleto className="h-72" />}
      {a && (a.length === 0
        ? <Vacio icono={<ScrollText className="size-6" aria-hidden />} titulo="Sin eventos todavía" texto="Aquí quedará registrado cada cambio de la plataforma y cada vez que se vea una empresa como ella la ve." />
        : <TablaAuditoria filas={a} />)}
    </>
  );
}
