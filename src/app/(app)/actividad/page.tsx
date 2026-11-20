"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { fechaHora } from "@/lib/format";
import { Aviso, Boton, Insignia, Tabla, Tarjeta, Titulo, Vacio } from "@/components/ui";

type Fila = { id: string; fecha: string; usuario: string; accion: string; entidad: string; entidad_id: string; detalle: Record<string, unknown> };

export default function Actividad() {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [errores, setErrores] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setFilas(null); api<Fila[]>(`empresa/actividad?limite=200${errores ? "&solo_errores=true" : ""}`).then(setFilas).catch((e) => setError(e.message)); }, [errores]);
  return (
    <>
      <Titulo sub="Quién hizo qué en su empresa, y los errores del sistema" acciones={<Boton variante="secundario" onClick={() => setErrores(!errores)}>{errores ? "Ver toda la actividad" : "Solo errores"}</Boton>}>Actividad</Titulo>
      {error && <Aviso tono="error">{error}</Aviso>}
      {filas && !filas.length && <Vacio>{errores ? "No hay errores registrados." : "Sin actividad todavía."}</Vacio>}
      {filas && filas.length > 0 && (
        <Tarjeta><Tabla cabeceras={["Fecha", "Usuario", "Acción", "Detalle"]}>
          {filas.map((f) => (
            <tr key={f.id}>
              <td className="whitespace-nowrap px-3 py-2">{fechaHora(f.fecha)}</td><td className="px-3 py-2">{f.usuario || "—"}</td>
              <td className="px-3 py-2">{f.accion === "error.500" ? <Insignia tono="rojo">Error · ref {f.entidad_id}</Insignia> : f.accion}</td>
              <td className="max-w-xs truncate px-3 py-2 text-xs text-slate-500" title={JSON.stringify(f.detalle)}>{Object.keys(f.detalle).length ? JSON.stringify(f.detalle) : f.entidad}</td>
            </tr>
          ))}
        </Tabla></Tarjeta>
      )}
    </>
  );
}
