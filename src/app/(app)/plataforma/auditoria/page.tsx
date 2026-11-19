"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { Auditoria } from "@/lib/types";
import { TablaAuditoria } from "@/components/TablaAuditoria";
import { Aviso, Titulo, Vacio } from "@/components/ui";

export default function AuditoriaGlobal() {
  const [a, setA] = useState<Auditoria[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<Auditoria[]>("platform/auditoria?limite=200").then(setA).catch((e) => setError(e.message)); }, []);
  return (
    <>
      <Titulo sub="Últimos 200 eventos de toda la plataforma, incluidas las suplantaciones.">Auditoría</Titulo>
      {error && <Aviso tono="error">{error}</Aviso>}
      {a && (a.length === 0 ? <Vacio>Sin eventos.</Vacio> : <TablaAuditoria filas={a} />)}
    </>
  );
}
