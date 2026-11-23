"use client";
import { useParams } from "next/navigation";
import { Hammer, LockKeyhole } from "lucide-react";
import { useSession } from "@/lib/session";
import { Titulo, Vacio } from "@/components/ui";

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
    return (
      <>
        <Titulo>{nombre}</Titulo>
        <Vacio icono={<LockKeyhole className="size-6" aria-hidden />} titulo="Módulo no incluido en su licencia"
          texto="Contacte a su proveedor para activarlo. Mientras tanto puede seguir usando el resto de la aplicación." />
      </>
    );
  return (
    <>
      <Titulo>{nombre}</Titulo>
      <Vacio icono={<Hammer className="size-6" aria-hidden />} titulo="Muy pronto"
        texto="Este módulo está incluido en su licencia y se está migrando desde el prototipo a la nueva plataforma. Estará disponible próximamente." />
    </>
  );
}
