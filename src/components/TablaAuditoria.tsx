import { fechaHora } from "@/lib/format";
import type { Auditoria } from "@/lib/types";
import { Tabla } from "./ui";

export function TablaAuditoria({ filas }: { filas: Auditoria[] }) {
  return (
    <Tabla cabeceras={["Fecha", "Usuario", "Acción", "Detalle"]}>
      {filas.map((x) => (
        <tr key={x.id}>
          <td className="px-3 py-2.5 whitespace-nowrap">{fechaHora(x.fecha)}</td><td className="px-3 py-2.5">{x.usuario || "—"}</td>
          <td className="px-3 py-2.5 font-medium">{x.accion}</td>
          <td className="px-3 py-2.5 text-xs text-slate-600">{Object.keys(x.detalle ?? {}).length ? JSON.stringify(x.detalle) : ""}</td>
        </tr>
      ))}
    </Tabla>
  );
}
