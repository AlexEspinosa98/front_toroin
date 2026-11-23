"use client";
import { useEffect, useState } from "react";
import { PiggyBank, Plus, Trash2, Wallet, TrendingUp, Gauge, Info } from "lucide-react";
import { api } from "@/lib/client";
import { useObras } from "@/lib/obras";
import { useSession } from "@/lib/session";
import { fmtCOP, fmtMillones, fmtPct } from "@/lib/format";
import { Aviso, Boton, BotonIcono, Chip, Esqueleto, Input, Select, Tabla, Tarjeta, Titulo, Vacio, useAviso, type Tono } from "@/components/ui";
import { BarraAvance, Indicador, SelectorObra } from "@/components/comunes";

type Obra = { id: string; nombre: string };
type Cat = { categoria: string; presupuestado: number; real: number; desviacion: number; consumido: number | null };
type Item = { id?: string; categoria: string; concepto: string; valor: number; actividad_id: string };
type Datos = {
  obra: Obra; tiene_contrato: boolean; items: Item[]; actividades: { id: string; nombre: string }[]; categorias_pres: string[]; categorias: Cat[];
  por_actividad: { actividad_id: string; actividad: string; presupuestado: number; real: number; desviacion: number; consumido: number | null }[];
  resumen: { presupuesto: number; real: number; desviacion: number; consumido: number | null; avance_fisico: number; valor_ganado: number; cpi: number | null; estimado_final: number; desviacion_proyectada: number; confiable: boolean; semaforo: string };
};
const SEM: Record<string, [Tono, string]> = { "al-dia": ["ok", "En control"], atencion: ["alerta", "Atención"], sobrecosto: ["error", "Sobrecosto"], "sin-presupuesto": ["neutro", "Sin presupuesto"] };

function Barra({ valor }: { valor: number | null }) {
  if (valor == null) return <span className="text-xs text-suave">—</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="w-24"><BarraAvance valor={Math.min(valor, 1)} etiqueta={`Consumido ${fmtPct(valor)}`} tono={valor > 1 ? "error" : valor > 0.85 ? "alerta" : "ok"} /></div>
      <span className="num text-xs text-suave">{fmtPct(valor)}</span>
    </div>
  );
}

export default function Presupuesto() {
  const { me } = useSession();
  const aviso = useAviso();
  const { obras, cargando, obraId, setObraId, error: errObras } = useObras();
  const [res, setRes] = useState<{ obraId: string; d: Datos } | null>(null);
  const [ed, setEd] = useState<{ obraId: string; items: Item[] } | null>(null);
  const d = res?.obraId === obraId ? res.d : null;
  const edit = ed?.obraId === obraId ? ed.items : null;
  const setEdit = (items: Item[] | null) => setEd(items && { obraId, items });
  const [error, setError] = useState("");
  const puede = !me.solo_lectura && me.licencia?.escritura;

  useEffect(() => {
    if (!obraId) return;
    let vivo = true;
    api<Datos>(`obras/${obraId}/presupuesto`).then((r) => { if (vivo) { setRes({ obraId, d: r }); setError(""); } }).catch((e) => vivo && setError(e.message));
    return () => { vivo = false; };
  }, [obraId]);

  async function guardar() {
    if (!edit) return;
    try { const r = await api<Datos>(`obras/${obraId}/presupuesto`, { method: "PUT", body: { items: edit.map(({ categoria, concepto, valor, actividad_id }) => ({ categoria, concepto, valor: Number(valor) || 0, actividad_id: categoria === "Mano de obra" ? actividad_id : "" })) } });
      setRes({ obraId, d: r }); setEdit(null); aviso("Presupuesto guardado"); } catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); }
  }
  const setItem = (i: number, c: Partial<Item>) => edit && setEdit(edit.map((x, k) => (k === i ? { ...x, ...c } : x)));
  const r = d?.resumen;
  const sem = r ? SEM[r.semaforo] ?? SEM["sin-presupuesto"] : null;

  return (
    <>
      <Titulo sub="Lo presupuestado frente a lo que realmente se ha gastado" acciones={puede && d && !edit && <Boton icono={<PiggyBank className="size-4" aria-hidden />} onClick={() => setEdit(d.items.map((i) => ({ ...i })))}>Editar presupuesto</Boton>}>Presupuesto vs. real</Titulo>
      <SelectorObra className="mb-5 max-w-sm" obras={obras} valor={obraId} onChange={setObraId} />
      {(error || errObras) && <Aviso tono="error">{error || errObras}</Aviso>}
      {!cargando && !obras.length && !errObras && <Vacio icono={<PiggyBank className="size-6" aria-hidden />} titulo="Primero cree una obra" texto="El presupuesto se lleva obra por obra." />}
      {obraId && !d && !error && <div className="space-y-3"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Esqueleto key={i} className="h-28" />)}</div><Esqueleto className="h-64" /></div>}

      {d && r && !edit && (
        <>
          {!d.tiene_contrato && <div className="mb-4"><Aviso tono="alerta">La obra no tiene contrato: no hay avance físico para evaluar el costo.</Aviso></div>}
          {!r.presupuesto && <div className="mb-4"><Aviso>Aún no hay presupuesto. Pulse «Editar presupuesto» para cargarlo por categoría; la mano de obra puede ligarse a cada actividad.</Aviso></div>}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador etiqueta="Presupuesto" valor={fmtMillones(r.presupuesto)} icono={<Wallet className="size-5" aria-hidden />} />
            <Indicador etiqueta="Gastado real" valor={fmtMillones(r.real)} detalle={r.consumido != null ? `${fmtPct(r.consumido)} del presupuesto` : undefined} tono={r.consumido != null && r.consumido > 1 ? "error" : undefined} icono={<TrendingUp className="size-5" aria-hidden />} />
            <Indicador etiqueta="Estimado al terminar" valor={fmtMillones(r.estimado_final)} detalle={r.presupuesto ? `${r.desviacion_proyectada > 0 ? "+" : ""}${fmtMillones(r.desviacion_proyectada)} vs. presupuesto` : undefined} tono={r.desviacion_proyectada > 0 ? "alerta" : "ok"} icono={<PiggyBank className="size-5" aria-hidden />} />
            <Indicador etiqueta="Índice de costo" valor={r.cpi != null ? r.cpi.toFixed(2) : "—"} detalle={sem ? sem[1] : undefined} tono={r.semaforo === "sobrecosto" ? "error" : r.semaforo === "atencion" ? "alerta" : "ok"} icono={<Gauge className="size-5" aria-hidden />} />
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-suave"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Avance físico {fmtPct(r.avance_fisico, 1)} → costo esperado a la fecha {fmtCOP(r.valor_ganado)}. Índice de costo = costo esperado ÷ gastado: sobre 1 se gasta menos de lo que avanza la obra.{!r.confiable && " Con menos de 10 % de avance la proyección aún no es confiable."}</p>
          <div className="mt-5"><Tarjeta titulo="Por categoría" acciones={sem && <Chip tono={sem[0]}>{sem[1]}</Chip>}>
            <Tabla cabeceras={["Categoría", "Presupuestado", "Real", "Desviación", "Consumido"]}>
              {d.categorias.map((c) => (
                <tr key={c.categoria}><td className="px-3 py-2.5 font-semibold">{c.categoria}</td><td className="num px-3 py-2.5">{fmtCOP(c.presupuestado)}</td><td className="num px-3 py-2.5">{fmtCOP(c.real)}</td>
                  <td className={`num px-3 py-2.5 ${c.desviacion > 0 ? "text-error" : "text-ok"}`}>{c.presupuestado || c.real ? `${c.desviacion > 0 ? "+" : ""}${fmtCOP(c.desviacion)}` : "—"}</td><td className="px-3 py-2.5"><Barra valor={c.consumido} /></td></tr>
              ))}
            </Tabla>
            <p className="mt-2 text-xs text-suave">La mano de obra real sale de la bitácora y del jornal o la tarifa de destajo; lo demás, de los gastos registrados en Finanzas y de las compras recibidas.</p>
          </Tarjeta></div>
          {d.por_actividad.length > 0 && (
            <div className="mt-5"><Tarjeta titulo="Mano de obra por actividad">
              <Tabla cabeceras={["Actividad", "Presupuestado", "Real", "Desviación", "Consumido"]}>
                {d.por_actividad.map((a) => (
                  <tr key={a.actividad_id}><td className="num px-3 py-2.5">{a.actividad}</td><td className="num px-3 py-2.5">{fmtCOP(a.presupuestado)}</td><td className="num px-3 py-2.5">{fmtCOP(a.real)}</td>
                    <td className={`num px-3 py-2.5 ${a.desviacion > 0 ? "text-error" : "text-ok"}`}>{a.desviacion > 0 ? "+" : ""}{fmtCOP(a.desviacion)}</td><td className="px-3 py-2.5"><Barra valor={a.consumido} /></td></tr>
                ))}
              </Tabla>
            </Tarjeta></div>
          )}
        </>
      )}

      {d && edit && (
        <div className="mt-5"><Tarjeta titulo="Editar presupuesto" acciones={<span className="num text-sm font-semibold">Total {fmtCOP(edit.reduce((s, i) => s + (Number(i.valor) || 0), 0))}</span>}>
          <div className="space-y-3">
            {edit.map((it, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-borde bg-tarjeta p-3 sm:grid-cols-[11rem_1fr_9rem_auto]">
                <Select aria-label="Categoría" value={it.categoria} onChange={(e) => setItem(i, { categoria: e.target.value, actividad_id: "" })}>{d.categorias_pres.map((c) => <option key={c}>{c}</option>)}</Select>
                <div className="grid gap-2">
                  <Input aria-label="Concepto" placeholder="Concepto" value={it.concepto} onChange={(e) => setItem(i, { concepto: e.target.value })} />
                  {it.categoria === "Mano de obra" && <Select aria-label="Actividad" value={it.actividad_id} onChange={(e) => setItem(i, { actividad_id: e.target.value })}><option value="">Sin actividad (general)</option>{d.actividades.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</Select>}
                </div>
                <Input aria-label="Valor" type="number" min={0} placeholder="Valor" value={it.valor || ""} onChange={(e) => setItem(i, { valor: Number(e.target.value) })} />
                <BotonIcono peligro etiqueta="Quitar renglón" onClick={() => setEdit(edit.filter((_, k) => k !== i))}><Trash2 className="size-4" aria-hidden /></BotonIcono>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Boton variante="secundario" icono={<Plus className="size-4" aria-hidden />} onClick={() => setEdit([...edit, { categoria: "Materiales e insumos", concepto: "", valor: 0, actividad_id: "" }])}>Agregar renglón</Boton>
              <Boton variante="secundario" onClick={() => setEdit([...edit, ...d.actividades.filter((a) => !edit.some((x) => x.actividad_id === a.id)).map((a) => ({ categoria: "Mano de obra", concepto: "", valor: 0, actividad_id: a.id }))])}>Mano de obra por cada actividad</Boton>
            </div>
            <div className="flex justify-end gap-2"><Boton variante="secundario" onClick={() => setEdit(null)}>Cancelar</Boton><Boton onClick={guardar}>Guardar presupuesto</Boton></div>
          </div>
        </Tarjeta></div>
      )}
    </>
  );
}
