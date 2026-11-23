"use client";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Scale } from "lucide-react";
import { api } from "@/lib/client";
import { fmtCOP } from "@/lib/format";
import { Aviso, Boton, Campo, Chip, cx, Esqueleto, Input, Tabla, Tarjeta, Titulo, Vacio, useAviso } from "@/components/ui";

type P = { pais: string; anio: number; salario_minimo: number; aux_transporte: number; extra: Record<string, unknown> };

export default function Parametros() {
  const aviso = useAviso();
  const [lista, setLista] = useState<P[] | null>(null);
  const [error, setError] = useState("");
  const [f, setF] = useState({ pais: "CO", anio: new Date().getFullYear(), salario_minimo: "", aux_transporte: "" });
  const cargar = useCallback(() => api<P[]>("platform/parametros-legales").then(setLista).catch((e) => setError(e.message)), []);
  useEffect(() => { void cargar(); }, [cargar]);

  const editando = lista?.some((p) => p.pais === f.pais && p.anio === f.anio) ?? false;
  const anioActual = new Date().getFullYear();

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
        {!lista && !error && <Esqueleto className="h-48" />}
        {lista && (lista.length === 0 ? (
          <Vacio icono={<Scale className="size-6" aria-hidden />} titulo="Sin parámetros todavía" texto="Agregue el salario mínimo y el auxilio de transporte del año para que Pagos pueda calcular." />
        ) : (
          <div className="self-start">
            <Tabla cabeceras={["País", "Año", "Salario mínimo", "Auxilio de transporte", ""]}>
              {lista.map((p) => {
                const sel = p.pais === f.pais && p.anio === f.anio;
                return (
                  <tr key={`${p.pais}${p.anio}`} className={cx(sel && "bg-marca-50")}>
                    <td className="px-3 py-3 font-semibold text-tinta">{p.pais}</td>
                    <td className="px-3 py-3">{p.anio} {p.anio === anioActual && <Chip tono="ok">Vigente</Chip>}</td>
                    <td className="num px-3 py-3">{fmtCOP(p.salario_minimo)}</td>
                    <td className="num px-3 py-3">{fmtCOP(p.aux_transporte)}</td>
                    <td className="px-3 py-1.5 text-right">
                      <Boton variante="fantasma" tam="sm" icono={<Pencil className="size-4" aria-hidden />} aria-label={`Editar ${p.pais} ${p.anio}`} aria-pressed={sel}
                        onClick={() => setF({ pais: p.pais, anio: p.anio, salario_minimo: String(p.salario_minimo), aux_transporte: String(p.aux_transporte) })}>Editar</Boton>
                    </td>
                  </tr>
                );
              })}
            </Tabla>
          </div>
        ))}
        <Tarjeta titulo={editando ? "Actualizar parámetros" : "Agregar parámetros"} sub={editando ? `${f.pais} · ${f.anio}` : undefined} className="self-start">
          <form onSubmit={guardar} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="País" ayuda="2 letras"><Input required maxLength={2} value={f.pais} onChange={(e) => setF({ ...f, pais: e.target.value.toUpperCase() })} /></Campo>
              <Campo etiqueta="Año"><Input type="number" required min={2000} max={2100} value={f.anio} onChange={(e) => setF({ ...f, anio: Number(e.target.value) })} /></Campo>
            </div>
            <Campo etiqueta="Salario mínimo mensual"><Input type="number" inputMode="numeric" required min={1} value={f.salario_minimo} onChange={(e) => setF({ ...f, salario_minimo: e.target.value })} /></Campo>
            <Campo etiqueta="Auxilio de transporte"><Input type="number" inputMode="numeric" min={0} value={f.aux_transporte} onChange={(e) => setF({ ...f, aux_transporte: e.target.value })} /></Campo>
            <Boton type="submit" className="w-full">{editando ? "Actualizar" : "Guardar"}</Boton>
          </form>
        </Tarjeta>
      </div>
    </>
  );
}
