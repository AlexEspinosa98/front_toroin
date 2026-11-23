"use client";
import { useEffect, useState } from "react";
import { Activity, CircleAlert } from "lucide-react";
import { api } from "@/lib/client";
import { fechaHora } from "@/lib/format";
import { Aviso, Chip, Esqueleto, Segmentado, Tabla, Titulo, Vacio } from "@/components/ui";

type Fila = { id: string; fecha: string; usuario: string; accion: string; entidad: string; entidad_id: string; detalle: Record<string, unknown> };
type Filtro = "todo" | "errores";

export default function Actividad() {
  const [filtro, setFiltro] = useState<Filtro>("todo");
  const [res, setRes] = useState<{ filtro: Filtro; filas: Fila[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let vivo = true;
    api<Fila[]>(`empresa/actividad?limite=200${filtro === "errores" ? "&solo_errores=true" : ""}`)
      .then((filas) => { if (vivo) { setRes({ filtro, filas }); setError(""); } })
      .catch((e) => vivo && setError(e.message));
    return () => { vivo = false; };
  }, [filtro]);
  const filas = res?.filtro === filtro ? res.filas : null;

  return (
    <>
      <Titulo sub="Quién hizo qué en su empresa, y los errores del sistema"
        acciones={<Segmentado etiqueta="Qué mostrar" valor={filtro} onChange={setFiltro} opciones={[{ valor: "todo", texto: "Toda la actividad" }, { valor: "errores", texto: "Solo errores" }]} />}>Actividad</Titulo>
      {error && <Aviso tono="error">{error}</Aviso>}
      {!filas && !error && <Esqueleto className="h-72" />}
      {filas && !filas.length && (
        <Vacio icono={<Activity className="size-6" aria-hidden />} titulo={filtro === "errores" ? "No hay errores registrados" : "Sin actividad todavía"}
          texto={filtro === "errores" ? "Cuando algo falle en el sistema, aparecerá aquí con una referencia para soporte." : "Aquí verá los cambios que haga su equipo."} />
      )}
      {filas && filas.length > 0 && (
        <Tabla cabeceras={["Fecha", "Usuario", "Acción", "Detalle"]}>
          {filas.map((f) => (
            <tr key={f.id}>
              <td className="whitespace-nowrap px-3 py-2.5">{fechaHora(f.fecha)}</td>
              <td className="px-3 py-2.5">{f.usuario || "—"}</td>
              <td className="px-3 py-2.5">
                {f.accion === "error.500"
                  ? <Chip tono="error" icono={<CircleAlert className="size-3.5" aria-hidden />}>Error · ref {f.entidad_id}</Chip>
                  : <span className="font-medium text-tinta">{f.accion}</span>}
              </td>
              <td className="max-w-xs truncate px-3 py-2.5 text-xs text-suave" title={JSON.stringify(f.detalle)}>{Object.keys(f.detalle).length ? JSON.stringify(f.detalle) : f.entidad}</td>
            </tr>
          ))}
        </Tabla>
      )}
    </>
  );
}
