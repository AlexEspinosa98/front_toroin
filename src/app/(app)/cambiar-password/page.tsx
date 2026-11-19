"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { Aviso, Boton, Campo, Input, Tarjeta, Titulo, useAviso } from "@/components/ui";

export default function CambiarPassword() {
  const { me, recargar } = useSession();
  const router = useRouter();
  const aviso = useAviso();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repite, setRepite] = useState("");
  const [error, setError] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (nueva.length < 8) return setError("La nueva contraseña debe tener al menos 8 caracteres");
    if (nueva !== repite) return setError("Las contraseñas nuevas no coinciden");
    try {
      await api("auth/cambiar-password", { method: "POST", body: { actual, nueva } });
      aviso("Contraseña actualizada");
      await recargar();
      router.replace("/");
    } catch (x) { setError(x instanceof Error ? x.message : "No se pudo cambiar"); }
  }

  return (
    <div className="mx-auto max-w-md">
      <Titulo sub={me.debe_cambiar_password ? "Por seguridad debe cambiar la contraseña temporal antes de continuar." : undefined}>Cambiar contraseña</Titulo>
      <Tarjeta>
        <form onSubmit={enviar} className="space-y-4">
          <Campo etiqueta="Contraseña actual"><Input type="password" required value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" /></Campo>
          <Campo etiqueta="Nueva contraseña" ayuda="Mínimo 8 caracteres"><Input type="password" required value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" /></Campo>
          <Campo etiqueta="Repetir nueva contraseña"><Input type="password" required value={repite} onChange={(e) => setRepite(e.target.value)} autoComplete="new-password" /></Campo>
          {error && <Aviso tono="error">{error}</Aviso>}
          <Boton type="submit" className="w-full">Guardar</Boton>
        </form>
      </Tarjeta>
    </div>
  );
}
