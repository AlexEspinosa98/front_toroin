"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { fmtCOP, fmtMillones, fmtPct } from "@/lib/format";
import { Aviso, Boton, Input, Insignia, Select, Tabla, Tarjeta, Titulo, Vacio, useAviso, Campo } from "@/components/ui";
import { Indicador } from "@/components/comunes";

type Obra = { id: string; nombre: string };
type Cat = { categoria: string; presupuestado: number; real: number; desviacion: number; consumido: number | null };
type Item = { id?: string; categoria: string; concepto: string; valor: number; actividad_id: string };
type Datos = {
  obra: Obra; tiene_contrato: boolean; items: Item[]; actividades: { id: string; nombre: string }[]; categorias_pres: string[]; categorias: Cat[];
  por_actividad: { actividad_id: string; actividad: string; presupuestado: number; real: number; desviacion: number; consumido: number | null }[];
  resumen: { presupuesto: number; real: number; desviacion: number; consumido: number | null; avance_fisico: number; valor_ganado: number; cpi: number | null; estimado_final: number; desviacion_proyectada: number; confiable: boolean; semaforo: string };
};
const SEM = { "al-dia": ["verde", "En control"], atencion: ["ambar", "Atención"], sobrecosto: ["rojo", "Sobrecosto"], "sin-presupuesto": ["gris", "Sin presupuesto"] } as const;

function Barra({ valor }: { valor: number | null }) {
  if (valor == null) return <span className="text-xs text-slate-400">—</span>;
  const pct = Math.min(valor, 1.5) / 1.5 * 100;
  return (
    <div className="flex items-center gap-2"><div className="h-2 w-24 overflow-hidden rounded bg-slate-200"><div className={`h-full ${valor > 1 ? "bg-red-500" : valor > 0.85 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} /></div><span className="text-xs">{fmtPct(valor)}</span></div>
  );
}

export default function Presupuesto() {
  const { me } = useSession();
  const aviso = useAviso();
  const [obras, setObras] = useState<Obra[]>([]);
  const [obraId, setObraId] = useState("");
  const [d, setD] = useState<Datos | null>(null);
  const [edit, setEdit] = useState<Item[] | null>(null);
  const [error, setError] = useState("");
  const puede = !me.solo_lectura && me.licencia?.escritura;

  useEffect(() => { api<Obra[]>("obras").then((o) => { setObras(o); setObraId((x) => x || o[0]?.id || ""); }).catch((e) => setError(e.message)); }, []);
  const cargar = useCallback(() => { if (obraId) api<Datos>(`obras/${obraId}/presupuesto`).then((r) => { setD(r); setError(""); }).catch((e) => setError(e.message)); }, [obraId]);
  useEffect(() => { setD(null); setEdit(null); cargar(); }, [cargar]);

  async function guardar() {
    if (!edit) return;
    try { const r = await api<Datos>(`obras/${obraId}/presupuesto`, { method: "PUT", body: { items: edit.map(({ categoria, concepto, valor, actividad_id }) => ({ categoria, concepto, valor: Number(valor) || 0, actividad_id: categoria === "Mano de obra" ? actividad_id : "" })) } });
      setD(r); setEdit(null); aviso("Presupuesto guardado"); } catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); }
  }
  const setItem = (i: number, c: Partial<Item>) => setEdit((e) => e!.map((x, k) => (k === i ? { ...x, ...c } : x)));
  const r = d?.resumen;
  const sem = r ? SEM[r.semaforo as keyof typeof SEM] ?? SEM["sin-presupuesto"] : null;

  return (
    <>
      <Titulo sub="Lo presupuestado frente a lo que realmente se ha gastado" acciones={puede && d && !edit && <Boton onClick={() => setEdit(d.items.map((i) => ({ ...i })))}>Editar presupuesto</Boton>}>Presupuesto vs. real</Titulo>
      <div className="max-w-md"><Campo etiqueta="Obra"><Select value={obraId} onChange={(e) => setObraId(e.target.value)}>{obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Select></Campo></div>
      {error && <div className="mt-3"><Aviso tono="error">{error}</Aviso></div>}
      {!obras.length && !error && <div className="mt-4"><Vacio>Primero cree una obra.</Vacio></div>}

      {d && r && !edit && (
        <>
          {!d.tiene_contrato && <div className="mt-3"><Aviso tono="alerta">La obra no tiene contrato: no hay avance físico para evaluar el costo.</Aviso></div>}
          {!r.presupuesto && <div className="mt-3"><Aviso>Aún no hay presupuesto. Pulse «Editar presupuesto» para cargarlo por categoría; la mano de obra puede ligarse a cada actividad.</Aviso></div>}
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador etiqueta="Presupuesto" valor={fmtMillones(r.presupuesto)} />
            <Indicador etiqueta="Gastado real" valor={fmtMillones(r.real)} detalle={r.consumido != null ? `${fmtPct(r.consumido)} del presupuesto` : undefined} tono={r.consumido != null && r.consumido > 1 ? "error" : undefined} />
            <Indicador etiqueta="Estimado al terminar" valor={fmtMillones(r.estimado_final)} detalle={r.presupuesto ? `${r.desviacion_proyectada > 0 ? "+" : ""}${fmtMillones(r.desviacion_proyectada)} vs. presupuesto` : undefined} tono={r.desviacion_proyectada > 0 ? "alerta" : "ok"} />
            <Indicador etiqueta="Índice de costo" valor={r.cpi != null ? r.cpi.toFixed(2) : "—"} detalle={sem ? sem[1] : undefined} tono={r.semaforo === "sobrecosto" ? "error" : r.semaforo === "atencion" ? "alerta" : "ok"} />
          </div>
          <p className="mt-2 text-xs text-slate-500">Avance físico {fmtPct(r.avance_fisico, 1)} → costo esperado a la fecha {fmtCOP(r.valor_ganado)}. Índice de costo = costo esperado ÷ gastado: sobre 1 se gasta menos de lo que avanza la obra.{!r.confiable && " Con menos de 10 % de avance la proyección aún no es confiable."}</p>
          <div className="mt-5"><Tarjeta titulo="Por categoría" acciones={sem && <Insignia tono={sem[0]}>{sem[1]}</Insignia>}>
            <Tabla cabeceras={["Categoría", "Presupuestado", "Real", "Desviación", "Consumido"]}>
              {d.categorias.map((c) => (
                <tr key={c.categoria}><td className="px-3 py-2 font-medium">{c.categoria}</td><td className="px-3 py-2">{fmtCOP(c.presupuestado)}</td><td className="px-3 py-2">{fmtCOP(c.real)}</td>
                  <td className={`px-3 py-2 ${c.desviacion > 0 ? "text-red-700" : "text-emerald-700"}`}>{c.presupuestado || c.real ? `${c.desviacion > 0 ? "+" : ""}${fmtCOP(c.desviacion)}` : "—"}</td><td className="px-3 py-2"><Barra valor={c.consumido} /></td></tr>
              ))}
            </Tabla>
            <p className="mt-2 text-xs text-slate-500">La mano de obra real sale de la bitácora y del jornal o la tarifa de destajo; lo demás, de los gastos registrados en Finanzas y de las compras recibidas.</p>
          </Tarjeta></div>
          {d.por_actividad.length > 0 && (
            <div className="mt-5"><Tarjeta titulo="Mano de obra por actividad">
              <Tabla cabeceras={["Actividad", "Presupuestado", "Real", "Desviación", "Consumido"]}>
                {d.por_actividad.map((a) => (
                  <tr key={a.actividad_id}><td className="px-3 py-2">{a.actividad}</td><td className="px-3 py-2">{fmtCOP(a.presupuestado)}</td><td className="px-3 py-2">{fmtCOP(a.real)}</td>
                    <td className={`px-3 py-2 ${a.desviacion > 0 ? "text-red-700" : "text-emerald-700"}`}>{a.desviacion > 0 ? "+" : ""}{fmtCOP(a.desviacion)}</td><td className="px-3 py-2"><Barra valor={a.consumido} /></td></tr>
                ))}
              </Tabla>
            </Tarjeta></div>
          )}
        </>
      )}

      {d && edit && (
        <div className="mt-5"><Tarjeta titulo="Editar presupuesto" acciones={<span className="text-sm text-slate-600">Total {fmtCOP(edit.reduce((s, i) => s + (Number(i.valor) || 0), 0))}</span>}>
          <div className="space-y-3">
            {edit.map((it, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[11rem_1fr_9rem_auto]">
                <Select aria-label="Categoría" value={it.categoria} onChange={(e) => setItem(i, { categoria: e.target.value, actividad_id: "" })}>{d.categorias_pres.map((c) => <option key={c}>{c}</option>)}</Select>
                <div className="grid gap-2">
                  <Input aria-label="Concepto" placeholder="Concepto" value={it.concepto} onChange={(e) => setItem(i, { concepto: e.target.value })} />
                  {it.categoria === "Mano de obra" && <Select aria-label="Actividad" value={it.actividad_id} onChange={(e) => setItem(i, { actividad_id: e.target.value })}><option value="">Sin actividad (general)</option>{d.actividades.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</Select>}
                </div>
                <Input aria-label="Valor" type="number" min={0} placeholder="Valor" value={it.valor || ""} onChange={(e) => setItem(i, { valor: Number(e.target.value) })} />
                <Boton variante="fantasma" onClick={() => setEdit(edit.filter((_, k) => k !== i))}>Quitar</Boton>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Boton variante="secundario" onClick={() => setEdit([...edit, { categoria: "Materiales e insumos", concepto: "", valor: 0, actividad_id: "" }])}>+ Agregar renglón</Boton>
              <Boton variante="secundario" onClick={() => setEdit([...edit, ...d.actividades.filter((a) => !edit.some((x) => x.actividad_id === a.id)).map((a) => ({ categoria: "Mano de obra", concepto: "", valor: 0, actividad_id: a.id }))])}>+ Mano de obra por cada actividad</Boton>
            </div>
            <div className="flex justify-end gap-2"><Boton variante="secundario" onClick={() => setEdit(null)}>Cancelar</Boton><Boton onClick={guardar}>Guardar presupuesto</Boton></div>
          </div>
        </Tarjeta></div>
      )}
    </>
  );
}
