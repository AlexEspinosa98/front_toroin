"use client";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { CampoColor } from "@/components/CampoColor";
import { ImagenInput } from "@/components/ImagenInput";
import { VistaPreviaMarca } from "@/components/VistaPreviaMarca";
import { Aviso, Boton, Campo, Esqueleto, Input, Tarjeta, Titulo, useAviso } from "@/components/ui";
import type { Marca } from "@/lib/types";

export default function MarcaPagina() {
  const { me, recargar } = useSession();
  const aviso = useAviso();
  const [m, setM] = useState<Marca | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { api<Marca>("empresa/marca").then(setM).catch((e) => setError(e.message)); }, []);

  const puede = !me.solo_lectura && me.licencia?.escritura && ["admin", "super_admin"].includes(me.rol);

  if (!m)
    return (
      <>
        <Titulo sub="Así verán la aplicación todos los usuarios de su empresa.">Marca</Titulo>
        {error ? <Aviso tono="error">{error}</Aviso> : <div className="grid gap-4 lg:grid-cols-[1fr_20rem]"><Esqueleto className="h-96" /><Esqueleto className="h-60" /></div>}
      </>
    );
  const set = <K extends keyof Marca>(k: K, v: Marca[K]) => setM({ ...m, [k]: v });

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      await api("empresa/marca", { method: "PUT", body: { nombre_app: m!.nombre_app, color_primario: m!.color_primario, color_secundario: m!.color_secundario, logo_claro: m!.logo_claro, logo_oscuro: m!.logo_oscuro, icono: m!.icono, pie: m!.pie } });
      await recargar(); aviso("Marca actualizada");
    } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo guardar", "error"); }
    finally { setGuardando(false); }
  }

  return (
    <>
      <Titulo sub="Así verán la aplicación todos los usuarios de su empresa.">Marca</Titulo>
      {!puede && <div className="mb-4"><Aviso>Solo el administrador de la empresa puede cambiar la marca.</Aviso></div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <form onSubmit={guardar}><fieldset disabled={!puede} className="contents">
          <Tarjeta className="space-y-5">
            <Campo etiqueta="Nombre de la aplicación" ayuda="Se muestra en el encabezado. Vacío = nombre de la empresa."><Input value={m.nombre_app} onChange={(e) => set("nombre_app", e.target.value)} placeholder={m.nombre} /></Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoColor etiqueta="Color principal" ayuda="Barra lateral, botones y títulos" valor={m.color_primario} onChange={(v) => set("color_primario", v)} />
              <CampoColor etiqueta="Color de acento" ayuda="Detalles, indicadores y gráficas" valor={m.color_secundario} onChange={(v) => set("color_secundario", v)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <ImagenInput etiqueta="Logo (fondo de color)" valor={m.logo_claro} onChange={(v) => set("logo_claro", v)} fondoOscuro />
              <ImagenInput etiqueta="Logo (fondo claro)" valor={m.logo_oscuro} onChange={(v) => set("logo_oscuro", v)} />
              <ImagenInput etiqueta="Ícono" valor={m.icono} onChange={(v) => set("icono", v)} maxLado={128} />
            </div>
            <Campo etiqueta="Texto de pie de página" ayuda="Aparece al final de la pantalla de ingreso."><Input value={m.pie} maxLength={300} onChange={(e) => set("pie", e.target.value)} /></Campo>
            {puede && <Boton type="submit" cargando={guardando} icono={guardando ? undefined : <Save className="size-4" aria-hidden />}>{guardando ? "Guardando…" : "Guardar cambios"}</Boton>}
          </Tarjeta>
        </fieldset></form>
        <VistaPreviaMarca nombre={m.nombre_app || m.nombre} primario={m.color_primario} secundario={m.color_secundario} logo={m.logo_claro} pie={m.pie} />
      </div>
    </>
  );
}
