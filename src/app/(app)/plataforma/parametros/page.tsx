"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Aviso, Boton, Campo, Input, Tabla, Tarjeta, Titulo, Vacio, useAviso } from "@/components/ui";

type P = { pais: string; anio: number; salario_minimo: number; aux_transporte: number; extra: Record<string, unknown> };
const cop = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 0 });

export default function Parametros() {
  const aviso = useAviso();
  const [lista, setLista] = useState<P[] | null>(null);
  const [error, setError] = useState("");
  const [f, setF] = useState({ pais: "CO", anio: new Date().getFullYear(), salario_minimo: "", aux_transporte: "" });
  const cargar = useCallback(() => api<P[]>("platform/parametros-legales").then(setLista).catch((e) => setError(e.message)), []);
  useEffect(() => { void cargar(); }, [cargar]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    try { await api("platform/parametros-legales", { method: "PUT", body: { pais: f.pais, anio: f.anio, salario_minimo: Number(f.salario_minimo), aux_transporte: Number(f.aux_transporte || 0) } }); aviso("Parámetros guardados"); void cargar(); }
    catch (x) { aviso(x instanceof Error ? x.message : "No se pudo guardar", "error"); }
  }
  return (
    <>
      <Titulo sub="Constantes legales por país y año que usarán los módulos de pagos y personal. Cámbielas aquí cuando se actualicen; no requieren tocar el código.">Parámetros legales</Titulo>
      {error && <Aviso tono="error">{error}</Aviso>}
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        {lista && (lista.length === 0 ? <Vacio>Sin parámetros.</Vacio> : (
          <Tabla cabeceras={["País", "Año", "Salario mínimo", "Auxilio de transporte"]}>
            {lista.map((p) => (<tr key={`${p.pais}${p.anio}`} className="cursor-pointer hover:bg-slate-50" onClick={() => setF({ pais: p.pais, anio: p.anio, salario_minimo: String(p.salario_minimo), aux_transporte: String(p.aux_transporte) })}>
              <td className="px-3 py-3 font-medium">{p.pais}</td><td className="px-3 py-3">{p.anio}</td><td className="px-3 py-3">$ {cop(p.salario_minimo)}</td><td className="px-3 py-3">$ {cop(p.aux_transporte)}</td></tr>))}
          </Tabla>))}
        <Tarjeta titulo="Agregar o actualizar"><form onSubmit={guardar} className="space-y-4">
          <div className="grid grid-cols-2 gap-3"><Campo etiqueta="País"><Input required maxLength={2} value={f.pais} onChange={(e) => setF({ ...f, pais: e.target.value.toUpperCase() })} /></Campo>
            <Campo etiqueta="Año"><Input type="number" required min={2000} max={2100} value={f.anio} onChange={(e) => setF({ ...f, anio: Number(e.target.value) })} /></Campo></div>
          <Campo etiqueta="Salario mínimo mensual"><Input type="number" required min={1} value={f.salario_minimo} onChange={(e) => setF({ ...f, salario_minimo: e.target.value })} /></Campo>
          <Campo etiqueta="Auxilio de transporte"><Input type="number" min={0} value={f.aux_transporte} onChange={(e) => setF({ ...f, aux_transporte: e.target.value })} /></Campo>
          <Boton type="submit" className="w-full">Guardar</Boton></form></Tarjeta>
      </div>
    </>
  );
}
