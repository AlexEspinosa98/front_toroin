"use client";
import { useParams } from "next/navigation";
import { useSession } from "@/lib/session";
import { Aviso, Tarjeta, Titulo } from "@/components/ui";

const NOMBRES: Record<string, string> = {
  contrato: "Contrato y tablero de obra", asistencia: "Asistencia", bitacora: "Bitácora y avance",
  control_personal: "Control de personal", pagos: "Pagos al personal", finanzas: "Finanzas", epp: "EPP / SST",
};

/** Módulos licenciados que aún se están portando desde el prototipo. */
export default function ModuloPendiente() {
  const { clave } = useParams<{ clave: string }>();
  const { tieneModulo } = useSession();
  const nombre = NOMBRES[clave] ?? "Módulo";
  if (!tieneModulo(clave))
    return (<><Titulo>{nombre}</Titulo><Aviso tono="alerta">Este módulo no está incluido en la licencia de su empresa. Contacte a su proveedor para activarlo.</Aviso></>);
  return (
    <>
      <Titulo>{nombre}</Titulo>
      <Tarjeta><p className="text-sm text-slate-700">Este módulo está incluido en su licencia y se está migrando desde el prototipo a la nueva plataforma. Estará disponible próximamente.</p></Tarjeta>
    </>
  );
}
