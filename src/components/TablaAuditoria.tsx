import { fechaHora } from "@/lib/format";
import type { Auditoria } from "@/lib/types";
import { Tabla } from "./ui";

export function TablaAuditoria({ filas }: { filas: Auditoria[] }) {
  return (
    <Tabla cabeceras={["Fecha", "Usuario", "Acción", "Detalle"]}>
      {filas.map((x) => (
        <tr key={x.id}>
          <td className="whitespace-nowrap px-3 py-2.5">{fechaHora(x.fecha)}</td>
          <td className="px-3 py-2.5">{x.usuario || "—"}</td>
          <td className="px-3 py-2.5 font-medium text-tinta">{x.accion}</td>
          <td className="max-w-xs truncate px-3 py-2.5 text-xs text-suave" title={Object.keys(x.detalle ?? {}).length ? JSON.stringify(x.detalle) : undefined}>{Object.keys(x.detalle ?? {}).length ? JSON.stringify(x.detalle) : ""}</td>
        </tr>
      ))}
    </Tabla>
  );
}
