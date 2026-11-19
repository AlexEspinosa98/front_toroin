"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { ImagenInput } from "@/components/ImagenInput";
import { VistaPreviaMarca } from "@/components/VistaPreviaMarca";
import { Aviso, Boton, Campo, Input, Tarjeta, Titulo, useAviso } from "@/components/ui";
import type { Marca } from "@/lib/types";

export default function MarcaPagina() {
  const { me, recargar } = useSession();
  const aviso = useAviso();
  const [m, setM] = useState<Marca | null>(null);
  useEffect(() => { api<Marca>("empresa/marca").then(setM).catch(() => {}); }, []);
  if (!m) return null;
  const puede = !me.solo_lectura && me.licencia?.escritura && ["admin", "super_admin"].includes(me.rol);
  const set = <K extends keyof Marca>(k: K, v: Marca[K]) => setM({ ...m, [k]: v });

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("empresa/marca", { method: "PUT", body: { nombre_app: m!.nombre_app, color_primario: m!.color_primario, color_secundario: m!.color_secundario, logo_claro: m!.logo_claro, logo_oscuro: m!.logo_oscuro, icono: m!.icono, pie: m!.pie } });
      await recargar(); aviso("Marca actualizada");
    } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo guardar", "error"); }
  }

  return (
    <>
      <Titulo sub="Así verán la aplicación todos los usuarios de su empresa.">Marca</Titulo>
      {!puede && <Aviso>Solo el administrador de la empresa puede cambiar la marca.</Aviso>}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <form onSubmit={guardar}><fieldset disabled={!puede} className="contents">
          <Tarjeta className="space-y-4">
            <Campo etiqueta="Nombre de la aplicación"><Input value={m.nombre_app} onChange={(e) => set("nombre_app", e.target.value)} placeholder={m.nombre} /></Campo>
            <div className="grid grid-cols-2 gap-4">
              <Campo etiqueta="Color principal"><Input type="color" className="!p-1" value={m.color_primario} onChange={(e) => set("color_primario", e.target.value)} /></Campo>
              <Campo etiqueta="Color de acento"><Input type="color" className="!p-1" value={m.color_secundario} onChange={(e) => set("color_secundario", e.target.value)} /></Campo>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <ImagenInput etiqueta="Logo (fondo de color)" valor={m.logo_claro} onChange={(v) => set("logo_claro", v)} fondoOscuro />
              <ImagenInput etiqueta="Logo (fondo claro)" valor={m.logo_oscuro} onChange={(v) => set("logo_oscuro", v)} />
              <ImagenInput etiqueta="Ícono" valor={m.icono} onChange={(v) => set("icono", v)} maxLado={128} />
            </div>
            <Campo etiqueta="Texto de pie de página"><Input value={m.pie} maxLength={300} onChange={(e) => set("pie", e.target.value)} /></Campo>
            {puede && <Boton type="submit">Guardar cambios</Boton>}
          </Tarjeta>
        </fieldset></form>
        <VistaPreviaMarca nombre={m.nombre_app || m.nombre} primario={m.color_primario} secundario={m.color_secundario} logo={m.logo_claro} pie={m.pie} />
      </div>
    </>
  );
}
