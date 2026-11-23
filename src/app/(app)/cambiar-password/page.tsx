"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, Eye, EyeOff, KeyRound } from "lucide-react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { Aviso, Boton, Campo, cx, Input, Tarjeta, Titulo, useAviso } from "@/components/ui";

function CampoClave({ etiqueta, valor, onChange, nueva }: { etiqueta: string; valor: string; onChange: (v: string) => void; nueva?: boolean }) {
  const [ver, setVer] = useState(false);
  return (
    <Campo etiqueta={etiqueta}>
      <span className="relative block">
        <Input type={ver ? "text" : "password"} required value={valor} onChange={(e) => onChange(e.target.value)} autoComplete={nueva ? "new-password" : "current-password"} className="pr-12" />
        <button type="button" onClick={() => setVer((v) => !v)} aria-label={`${ver ? "Ocultar" : "Mostrar"} ${etiqueta.toLowerCase()}`} aria-pressed={ver}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-suave hover:text-tinta">
          {ver ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      </span>
    </Campo>
  );
}

function Requisito({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <li className={cx("flex items-center gap-2 text-sm", ok ? "font-medium text-ok" : "text-suave")}>
      {ok ? <Check className="size-4" aria-hidden /> : <Circle className="size-4" aria-hidden />}
      {texto}<span className="sr-only">{ok ? " (cumplido)" : " (pendiente)"}</span>
    </li>
  );
}

export default function CambiarPassword() {
  const { me, recargar } = useSession();
  const router = useRouter();
  const aviso = useAviso();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repite, setRepite] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const largo = nueva.length >= 8;
  const coincide = repite.length > 0 && nueva === repite;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!largo) return setError("La nueva contraseña debe tener al menos 8 caracteres");
    if (nueva !== repite) return setError("Las contraseñas nuevas no coinciden");
    setCargando(true);
    try {
      await api("auth/cambiar-password", { method: "POST", body: { actual, nueva } });
      aviso("Contraseña actualizada");
      await recargar();
      router.replace("/");
    } catch (x) { setError(x instanceof Error ? x.message : "No se pudo cambiar"); setCargando(false); }
  }

  return (
    <div className="mx-auto max-w-md">
      <Titulo sub={me.debe_cambiar_password ? "Por seguridad debe cambiar la contraseña temporal antes de continuar." : undefined}>Cambiar contraseña</Titulo>
      <Tarjeta>
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-marca-50 text-marca-texto"><KeyRound className="size-5" aria-hidden /></span>
          <p className="min-w-0 break-words text-sm text-suave">Cuenta: <strong className="text-tinta">{me.correo}</strong></p>
        </div>
        <form onSubmit={enviar} className="space-y-4">
          <CampoClave etiqueta="Contraseña actual" valor={actual} onChange={setActual} />
          <CampoClave etiqueta="Nueva contraseña" valor={nueva} onChange={setNueva} nueva />
          <CampoClave etiqueta="Repetir nueva contraseña" valor={repite} onChange={setRepite} nueva />
          <ul className="space-y-1" aria-label="Requisitos de la contraseña">
            <Requisito ok={largo} texto="Al menos 8 caracteres" />
            <Requisito ok={coincide} texto="Las dos contraseñas nuevas coinciden" />
          </ul>
          {error && <Aviso tono="error">{error}</Aviso>}
          <Boton type="submit" tam="lg" cargando={cargando} className="w-full">{cargando ? "Guardando…" : "Guardar contraseña"}</Boton>
        </form>
      </Tarjeta>
    </div>
  );
}
