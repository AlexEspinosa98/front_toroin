"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { fechaCorta, fmtCOP, fmtMillones, fmtPct } from "@/lib/format";
import { hoy } from "@/lib/fechas";
import { Aviso, Boton, Campo, Input, Select, Tabla, Tarjeta, Titulo, Vacio, useAviso } from "@/components/ui";
import { Indicador } from "@/components/comunes";

type Obra = { id: string; nombre: string };
type Res = { ingresos_proyectados: number; facturado: number; por_facturar: number; gastos: number; gasto_proyectado: number; utilidad_actual: number; utilidad_proyectada: number; margen_proyectado: number; rete_garantia_retenida: number; obra_ejecutada: number; avance_fisico: number; metodo: string };
type Fin = { obra: Obra; tiene_contrato: boolean; resumen: Res; facturas: { id: string; numero: string; fecha: string; concepto: string; valor: number }[]; gastos: { id: string; fecha: string; categoria: string; descripcion: string; valor: number }[]; meses: { mes: string; facturado: number; gastos: number }[]; categorias: string[] };

export default function Finanzas() {
  const { me } = useSession();
  const aviso = useAviso();
  const [obras, setObras] = useState<Obra[]>([]);
  const [obraId, setObraId] = useState("");
  const [d, setD] = useState<Fin | null>(null);
  const [error, setError] = useState("");
  const [fac, setFac] = useState({ numero: "", fecha: hoy(), concepto: "", valor: "" });
  const [gas, setGas] = useState({ fecha: hoy(), categoria: "Otros", descripcion: "", valor: "" });
  const [ing, setIng] = useState("");
  const puede = !me.solo_lectura && me.licencia?.escritura && ["admin", "gerencia", "super_admin"].includes(me.rol);

  useEffect(() => { api<Obra[]>("obras").then((o) => { setObras(o); setObraId((x) => x || o[0]?.id || ""); }).catch((e) => setError(e.message)); }, []);
  const cargar = useCallback(() => {
    if (!obraId) return;
    api<Fin>(`obras/${obraId}/finanzas`).then((r) => { setD(r); setIng(String(r.resumen.ingresos_proyectados || "")); setError(""); }).catch((e) => setError(e.message));
  }, [obraId]);
  useEffect(() => { setD(null); cargar(); }, [cargar]);

  async function enviar(ruta: string, body: unknown, method = "POST", ok = "Guardado") {
    try { const r = await api<Fin>(ruta, { method, body }); setD(r); setIng(String(r.resumen.ingresos_proyectados || "")); aviso(ok); return true; }
    catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); return false; }
  }
  const r = d?.resumen;
  const max = Math.max(1, ...(d?.meses ?? []).flatMap((m) => [m.facturado, m.gastos]));

  return (
    <>
      <Titulo sub="Ingresos, facturación, gastos y margen proyectado por obra">Finanzas</Titulo>
      <div className="max-w-md"><Campo etiqueta="Obra"><Select value={obraId} onChange={(e) => setObraId(e.target.value)}>{obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Select></Campo></div>
      {error && <div className="mt-3"><Aviso tono="error">{error}</Aviso></div>}
      {!obras.length && !error && <div className="mt-4"><Vacio>Primero cree una obra.</Vacio></div>}
      {d && r && (
        <>
          {!d.tiene_contrato && <div className="mt-3"><Aviso tono="alerta">Esta obra no tiene contrato cargado; el avance y los ingresos se toman de lo que digite abajo.</Aviso></div>}
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador etiqueta="Ingresos proyectados" valor={fmtMillones(r.ingresos_proyectados)} />
            <Indicador etiqueta="Facturado" valor={fmtMillones(r.facturado)} detalle={`Por facturar: ${fmtMillones(r.por_facturar)}`} />
            <Indicador etiqueta="Gastos a la fecha" valor={fmtMillones(r.gastos)} detalle={`Proyectado: ${fmtMillones(r.gasto_proyectado)}`} />
            <Indicador etiqueta="Utilidad proyectada" valor={fmtMillones(r.utilidad_proyectada)} detalle={`Margen ${fmtPct(r.margen_proyectado, 1)}`} tono={r.utilidad_proyectada < 0 ? "error" : "ok"} />
          </div>
          <p className="mt-2 text-xs text-slate-500">{r.metodo}. Retegarantía retenida estimada: {fmtCOP(r.rete_garantia_retenida)}. Utilidad actual (facturado − gastos): {fmtCOP(r.utilidad_actual)}.</p>
          {puede && (
            <div className="mt-4 flex max-w-md items-end gap-2">
              <Campo etiqueta="Ingresos proyectados (opcional)" ayuda="Si lo deja vacío se usa el valor del contrato"><Input type="number" min={0} value={ing} onChange={(e) => setIng(e.target.value)} /></Campo>
              <Boton variante="secundario" onClick={() => enviar(`obras/${obraId}/ingresos`, { ingresos_proyectados: ing === "" ? null : Number(ing) }, "PUT")}>Guardar</Boton>
            </div>
          )}
          {d.meses.length > 0 && (
            <div className="mt-6"><Tarjeta titulo="Facturado vs. gastos por mes">
              <div className="flex items-end gap-4 overflow-x-auto pb-1">
                {d.meses.map((m) => (
                  <div key={m.mes} className="flex min-w-14 flex-col items-center gap-1">
                    <div className="flex h-32 items-end gap-1">
                      <div title={`Facturado ${fmtCOP(m.facturado)}`} className="w-4 rounded-t bg-emerald-500" style={{ height: `${(m.facturado / max) * 100}%` }} />
                      <div title={`Gastos ${fmtCOP(m.gastos)}`} className="w-4 rounded-t bg-amber-500" style={{ height: `${(m.gastos / max) * 100}%` }} />
                    </div>
                    <span className="text-xs text-slate-500">{m.mes}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500"><span className="text-emerald-600">■</span> Facturado · <span className="text-amber-600">■</span> Gastos</p>
            </Tarjeta></div>
          )}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Tarjeta titulo="Facturas">
              {puede && (
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <Input placeholder="N.º" value={fac.numero} onChange={(e) => setFac({ ...fac, numero: e.target.value })} />
                  <Input type="date" value={fac.fecha} onChange={(e) => setFac({ ...fac, fecha: e.target.value })} />
                  <Input placeholder="Concepto" value={fac.concepto} onChange={(e) => setFac({ ...fac, concepto: e.target.value })} />
                  <Input type="number" min={1} placeholder="Valor" value={fac.valor} onChange={(e) => setFac({ ...fac, valor: e.target.value })} />
                  <Boton className="col-span-2" disabled={!Number(fac.valor)} onClick={async () => { if (await enviar(`obras/${obraId}/facturas`, { ...fac, valor: Number(fac.valor) }, "POST", "Factura registrada")) setFac({ ...fac, numero: "", concepto: "", valor: "" }); }}>Agregar factura</Boton>
                </div>
              )}
              {!d.facturas.length ? <Vacio>Sin facturas.</Vacio> : (
                <Tabla cabeceras={["Fecha", "N.º / concepto", "Valor", ""]}>
                  {d.facturas.map((x) => <tr key={x.id}><td className="px-3 py-2">{fechaCorta(x.fecha)}</td><td className="px-3 py-2">{x.numero} {x.concepto}</td><td className="px-3 py-2">{fmtCOP(x.valor)}</td>
                    <td className="px-3 py-2 text-right">{puede && <Boton variante="fantasma" onClick={() => confirm("¿Eliminar la factura?") && enviar(`facturas/${x.id}`, undefined, "DELETE", "Eliminada")}>Quitar</Boton>}</td></tr>)}
                </Tabla>
              )}
            </Tarjeta>
            <Tarjeta titulo="Gastos">
              {puede && (
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <Select value={gas.categoria} onChange={(e) => setGas({ ...gas, categoria: e.target.value })}>{d.categorias.map((c) => <option key={c}>{c}</option>)}</Select>
                  <Input type="date" value={gas.fecha} onChange={(e) => setGas({ ...gas, fecha: e.target.value })} />
                  <Input placeholder="Descripción" value={gas.descripcion} onChange={(e) => setGas({ ...gas, descripcion: e.target.value })} />
                  <Input type="number" min={1} placeholder="Valor" value={gas.valor} onChange={(e) => setGas({ ...gas, valor: e.target.value })} />
                  <Boton className="col-span-2" disabled={!Number(gas.valor)} onClick={async () => { if (await enviar(`obras/${obraId}/gastos`, { ...gas, valor: Number(gas.valor) }, "POST", "Gasto registrado")) setGas({ ...gas, descripcion: "", valor: "" }); }}>Agregar gasto</Boton>
                </div>
              )}
              {!d.gastos.length ? <Vacio>Sin gastos.</Vacio> : (
                <Tabla cabeceras={["Fecha", "Categoría", "Valor", ""]}>
                  {d.gastos.map((x) => <tr key={x.id}><td className="px-3 py-2">{fechaCorta(x.fecha)}</td><td className="px-3 py-2">{x.categoria}<div className="text-xs text-slate-500">{x.descripcion}</div></td><td className="px-3 py-2">{fmtCOP(x.valor)}</td>
                    <td className="px-3 py-2 text-right">{puede && <Boton variante="fantasma" onClick={() => confirm("¿Eliminar el gasto?") && enviar(`gastos/${x.id}`, undefined, "DELETE", "Eliminado")}>Quitar</Boton>}</td></tr>)}
                </Tabla>
              )}
            </Tarjeta>
          </div>
        </>
      )}
    </>
  );
}
