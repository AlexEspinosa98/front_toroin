"use client";
import { Fragment, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { descargarCSV, quincenas } from "@/lib/csv";
import { fechaCorta } from "@/lib/format";
import { hoy } from "@/lib/fechas";
import { Aviso, Boton, Campo, Insignia, Select, Tabla, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { Indicador } from "@/components/comunes";

type Obra = { id: string; nombre: string };
type Sem = { domingo: string; laborables: number; asistidos: number; justificados: number; faltas: string[]; festivos: { fecha: string; nombre: string }[]; reconocido: boolean; razon: string };
type Fila = { trabajador_id: string; nombre: string; cedula: string; cargo: string; dias_asistidos: number; domingos: number; festivos: number; ausencias_justificadas: number; ausencias_injustificadas: number; total: number; semanas: Sem[] };
type Resp = { config: { regla_dominical: string; semana: string }; filas: Fila[] };
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default function ControlPersonal() {
  const h = hoy();
  const [anio, setAnio] = useState(Number(h.slice(0, 4)));
  const [mes, setMes] = useState(Number(h.slice(5, 7)));
  const [obras, setObras] = useState<Obra[]>([]);
  const [obraId, setObraId] = useState("");
  const [datos, setDatos] = useState<Resp | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [desde, hasta] = quincenas(anio, mes).mes;

  useEffect(() => { api<Obra[]>("obras").then(setObras).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    setDatos(null);
    api<Resp>(`control-personal?desde=${desde}&hasta=${hasta}${obraId ? `&obra_id=${obraId}` : ""}`).then((r) => { setDatos(r); setError(""); }).catch((e) => setError(e.message));
  }, [desde, hasta, obraId]);

  const f = datos?.filas ?? [];
  const sum = (k: keyof Fila) => f.reduce((s, x) => s + (x[k] as number), 0);
  const exportar = () => descargarCSV(`control-personal-${anio}-${mes}.csv`, [
    ["Nombre", "Cédula", "Cargo", "Días asistidos", "Domingos", "Festivos", "Aus. justificadas", "Aus. injustificadas", "Total días"],
    ...f.map((x) => [x.nombre, x.cedula, x.cargo, x.dias_asistidos, x.domingos, x.festivos, x.ausencias_justificadas, x.ausencias_injustificadas, x.total]),
  ]);

  return (
    <>
      <Titulo sub={`Regla dominical: ${datos?.config.regla_dominical === "literal" ? "más de 5 días" : "legal (semana completa, art. 173 CST)"}`} acciones={<Boton variante="secundario" onClick={exportar} disabled={!f.length}>Exportar CSV</Boton>}>Control de personal</Titulo>
      <div className="grid max-w-3xl gap-3 sm:grid-cols-3">
        <Campo etiqueta="Mes"><Select value={mes} onChange={(e) => setMes(Number(e.target.value))}>{MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</Select></Campo>
        <Campo etiqueta="Año"><Select value={anio} onChange={(e) => setAnio(Number(e.target.value))}>{[-1, 0, 1].map((d) => <option key={d}>{Number(h.slice(0, 4)) + d}</option>)}</Select></Campo>
        <Campo etiqueta="Obra"><Select value={obraId} onChange={(e) => setObraId(e.target.value)}><option value="">Todas</option>{obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Select></Campo>
      </div>
      {error && <div className="mt-3"><Aviso tono="error">{error}</Aviso></div>}
      {datos && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Indicador etiqueta="Personas" valor={f.length} />
            <Indicador etiqueta="Días asistidos" valor={sum("dias_asistidos")} />
            <Indicador etiqueta="Domingos reconocidos" valor={sum("domingos")} />
            <Indicador etiqueta="Ausencias sin justificar" valor={sum("ausencias_injustificadas")} tono={sum("ausencias_injustificadas") ? "alerta" : "ok"} />
          </div>
          <div className="mt-4">
            {!f.length ? <Vacio>No hay personal ni asistencia en este periodo.</Vacio> : (
              <Tarjeta>
                <Tabla cabeceras={["Trabajador", "Asistidos", "Domingos", "Festivos", "Justif.", "Injustif.", "Total", ""]}>
                  {f.map((x) => (
                    <Fragment key={x.trabajador_id}>
                      <tr>
                        <td className="px-3 py-2"><div className="font-medium">{x.nombre}</div><div className="text-xs text-slate-500">{x.cargo || x.cedula}</div></td>
                        <td className="px-3 py-2">{x.dias_asistidos}</td><td className="px-3 py-2">{x.domingos}</td><td className="px-3 py-2">{x.festivos}</td>
                        <td className="px-3 py-2">{x.ausencias_justificadas}</td><td className="px-3 py-2">{x.ausencias_injustificadas ? <Insignia tono="rojo">{x.ausencias_injustificadas}</Insignia> : 0}</td>
                        <td className="px-3 py-2 font-semibold">{x.total}</td>
                        <td className="px-3 py-2 text-right"><Boton variante="fantasma" onClick={() => setAbierto(abierto === x.trabajador_id ? null : x.trabajador_id)}>{abierto === x.trabajador_id ? "Ocultar" : "Semanas"}</Boton></td>
                      </tr>
                      {abierto === x.trabajador_id && (
                        <tr><td colSpan={8} className="bg-slate-50 px-3 py-2">
                          {x.semanas.length ? x.semanas.map((s) => (
                            <div key={s.domingo} className="flex flex-wrap items-center gap-2 py-1 text-sm">
                              <span className="w-28">Domingo {fechaCorta(s.domingo)}</span>
                              <Insignia tono={s.reconocido ? "verde" : "gris"}>{s.reconocido ? "Reconocido" : "No reconocido"}</Insignia>
                              <span className="text-slate-600">{s.razon}</span>
                              {s.festivos.map((z) => <Insignia key={z.fecha} tono="azul">{z.nombre}</Insignia>)}
                              {s.faltas.length > 0 && <span className="text-xs text-red-700">Faltas: {s.faltas.map(fechaCorta).join(", ")}</span>}
                            </div>
                          )) : <span className="text-sm text-slate-500">Sin domingos en el periodo.</span>}
                        </td></tr>
                      )}
                    </Fragment>
                  ))}
                </Tabla>
              </Tarjeta>
            )}
          </div>
        </>
      )}
    </>
  );
}
