"use client";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { contratoVacio, type ActividadLeida, type ContratoLeido } from "@/lib/contratoParser";
import { leerContratoPDF } from "@/lib/pdf";
import { fechaCorta, fmtCOP, fmtNum } from "@/lib/format";
import type { DatosObra } from "@/lib/types";
import { Aviso, Boton, Campo, Input, Select, Tarjeta, Titulo, useAviso } from "@/components/ui";
import { Indicador } from "@/components/comunes";

export default function CargarContrato({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const aviso = useAviso();
  const [obra, setObra] = useState<DatosObra | null>(null);
  const [c, setC] = useState<(ContratoLeido & { ingresos_proyectados?: number | null }) | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<DatosObra>(`obras/${id}/contrato`).then((d) => {
      setObra(d);
      if (d.contrato) setC({ ...contratoVacio(), ...d.contrato, actividades: d.actividades.map((a) => ({ ...a })), ingresos_proyectados: d.obra.ingresos_proyectados });
    }).catch((e) => setError(e.message));
  }, [id]);

  async function leer(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) return setError("El archivo debe ser un PDF.");
    setError(""); setLeyendo(true);
    try {
      const r = await leerContratoPDF(file);
      if (r.actividades.length === 0) setError('No se encontraron actividades. Verifique que sea un contrato SINCO "Detallado por grupos" o ingréselas manualmente.');
      setC(r);
    } catch (e) { setError(`No se pudo leer el PDF: ${(e as Error).message}`); } finally { setLeyendo(false); }
  }
  const setAct = (i: number, cambios: Partial<ActividadLeida>) => setC((x) => x && ({ ...x, actividades: x.actividades.map((a, k) => { if (k !== i) return a; const n = { ...a, ...cambios }; n.valor_total = Math.round(n.cantidad * n.valor_unitario * 100) / 100; return n; }) }));

  const suma = c?.actividades.reduce((s, a) => s + a.valor_total, 0) ?? 0;
  const errores: string[] = [];
  if (c) {
    if (!c.fecha_inicio || !c.fecha_fin) errores.push("Indique las fechas de inicio y terminación");
    else if (c.fecha_fin <= c.fecha_inicio) errores.push("La fecha de terminación debe ser posterior al inicio");
    if (c.actividades.length === 0) errores.push("Agregue al menos una actividad");
    if (c.actividades.some((a) => !a.nombre.trim() || !(a.cantidad > 0))) errores.push("Todas las actividades necesitan nombre y cantidad mayor a cero");
  }
  async function guardar() {
    if (!c || errores.length) return;
    setGuardando(true);
    try {
      await api(`obras/${id}/contrato`, { method: "PUT", body: { ...c, valor_total: c.valor_total || suma, ingresos_proyectados: c.ingresos_proyectados ?? null } });
      aviso("Contrato guardado. Las actividades ya están disponibles en la bitácora.");
      router.push(`/obras/${id}`);
    } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo guardar", "error"); } finally { setGuardando(false); }
  }
  const campo = (k: keyof ContratoLeido, etiqueta: string, tipo = "text") => (
    <Campo etiqueta={etiqueta}><Input type={tipo} value={String(c?.[k] ?? "")} onChange={(e) => setC((x) => x && { ...x, [k]: e.target.value })} /></Campo>);

  return (
    <>
      <Link href={`/obras/${id}`} className="mb-3 inline-flex min-h-11 items-center text-sm font-semibold text-marca hover:underline">← {obra?.obra.nombre ?? "Obra"}</Link>
      <Titulo sub="Se extraen actividades, unidades, cantidades y plazo. Siempre se revisa antes de guardar.">Contrato de la obra</Titulo>
      <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-white px-6 py-8 text-center"
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void leer(e.dataTransfer.files[0]); }}>
        <p className="font-bold">{c ? "Cargar otro PDF" : "Arrastre aquí el PDF del contrato"}</p>
        <p className="text-sm text-slate-500">Formato SINCO ERP «Contrato detallado por grupos». El archivo se lee en su equipo y no se sube.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Boton disabled={leyendo} onClick={() => input.current?.click()}>{leyendo ? "Leyendo contrato…" : "Seleccionar PDF"}</Boton>
          {!c && <Boton variante="secundario" onClick={() => setC(contratoVacio())}>Ingresar manualmente</Boton>}
        </div>
        <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" tabIndex={-1} onChange={(e) => leer(e.target.files?.[0])} />
        {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
      </div>

      {c && <>
        {c.advertencias.length > 0 && <div className="mt-5 space-y-2">{c.advertencias.map((a) => <Aviso key={a} tono="alerta">{a}</Aviso>)}</div>}
        {obra && obra.actividades.some((a) => a.ejecutado > 0) && <div className="mt-3"><Aviso tono="error">Esta obra ya tiene avance en la bitácora. No puede quitar actividades con avance registrado; use un otrosí en lugar de reemplazar el contrato.</Aviso></div>}
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador etiqueta="Valor del contrato" valor={fmtCOP(c.valor_total || suma)} detalle={c.valor_antes_aiu ? `Antes de AIU ${fmtCOP(c.valor_antes_aiu)}` : undefined} />
          <Indicador etiqueta="Actividades" valor={c.actividades.length} detalle={`Suma ${fmtCOP(suma)}`} />
          <Indicador etiqueta="Plazo" valor={c.fecha_inicio && c.fecha_fin ? `${Math.round((+new Date(c.fecha_fin) - +new Date(c.fecha_inicio)) / 864e5)} días` : "—"} detalle={`${fechaCorta(c.fecha_inicio)} – ${fechaCorta(c.fecha_fin)}`} />
          <Indicador etiqueta="Retención en garantía" valor={c.rete_garantia ? fmtCOP(c.rete_garantia) : "—"} detalle={c.pct_rete_garantia ? `${c.pct_rete_garantia} % · Neto ${fmtCOP(c.valor_neto)}` : undefined} />
        </div>
        <Tarjeta className="mt-5" titulo="Datos generales">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campo("numero", "Número de contrato")}{campo("contratante", "Contratante")}{campo("proyecto", "Proyecto")}
            {campo("fecha_inicio", "Fecha de inicio", "date")}{campo("fecha_fin", "Fecha de terminación", "date")}
            <Campo etiqueta="Valor total del contrato" ayuda={`${fmtCOP(c.valor_total || suma)} · ingresos proyectados de la obra`}><Input type="number" min={0} value={c.valor_total || ""} onChange={(e) => setC((x) => x && { ...x, valor_total: Number(e.target.value) })} /></Campo>
          </div>
          {c.descripcion && <p className="mt-3 text-sm text-slate-500">{c.descripcion}</p>}
        </Tarjeta>
        <Tarjeta className="mt-5" titulo="Actividades del contrato" acciones={<Boton variante="secundario" className="!min-h-9" onClick={() => setC((x) => x && { ...x, actividades: [...x.actividades, { item: "", grupo: x.actividades.length + 1, capitulo: "", nombre: "", ubicacion: "", um: "M2", cantidad: 0, valor_unitario: 0, valor_total: 0, advertencias: [] }] })}>Agregar</Boton>}>
          <p className="mb-2 text-xs text-slate-500">Revise unidades y cantidades. Las filas marcadas tienen diferencias en el PDF.</p>
          <div className="-mx-4 overflow-x-auto sm:mx-0"><table className="w-full min-w-[860px] text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-2 py-2">Ítem</th><th className="px-2 py-2">Actividad</th><th className="px-2 py-2">Ubicación</th><th className="px-2 py-2">Unidad</th><th className="px-2 py-2 text-right">Cantidad</th><th className="px-2 py-2 text-right">Valor unitario</th><th className="px-2 py-2 text-right">Total</th><th /></tr></thead>
            <tbody className="divide-y divide-slate-100">{c.actividades.map((a, i) => (
              <tr key={a.id ?? `n${i}`} className={a.advertencias.length ? "bg-amber-50" : ""}>
                <td className="px-2 py-2 text-slate-500">{a.item || "—"}</td>
                <td className="px-2 py-2"><Input aria-label="Nombre de la actividad" value={a.nombre} onChange={(e) => setAct(i, { nombre: e.target.value })} />{a.advertencias.map((w) => <span key={w} className="mt-1 block text-xs font-medium text-amber-700">{w}</span>)}</td>
                <td className="px-2 py-2"><Input aria-label="Ubicación" className="w-28" value={a.ubicacion} onChange={(e) => setAct(i, { ubicacion: e.target.value })} /></td>
                <td className="px-2 py-2"><Select aria-label="Unidad de medida" className="w-24" value={a.um} onChange={(e) => setAct(i, { um: e.target.value, advertencias: [] })}>{["M2", "M3", "ML", "UND", "GL", "KG"].map((u) => <option key={u}>{u}</option>)}</Select></td>
                <td className="px-2 py-2"><Input aria-label="Cantidad" type="number" className="w-28 text-right" value={a.cantidad || ""} onChange={(e) => setAct(i, { cantidad: Number(e.target.value) })} /></td>
                <td className="px-2 py-2"><Input aria-label="Valor unitario" type="number" className="w-32 text-right" value={a.valor_unitario || ""} onChange={(e) => setAct(i, { valor_unitario: Number(e.target.value) })} /></td>
                <td className="px-2 py-2 text-right font-semibold">{fmtCOP(a.valor_total)}</td>
                <td className="px-2 py-2"><button type="button" aria-label={`Eliminar ${a.nombre || "actividad"}`} className="text-red-700" onClick={() => setC((x) => x && { ...x, actividades: x.actividades.filter((_, k) => k !== i) })}>Quitar</button></td></tr>))}</tbody></table></div>
          {c.pagos.length > 0 && <div className="mt-4"><h3 className="text-sm font-bold">Programación de pagos del contrato</h3>
            <ul className="mt-1 flex flex-wrap gap-2 text-xs">{c.pagos.map((p, k) => <li key={k} className="rounded-full bg-slate-100 px-3 py-1">{fechaCorta(p.fecha)} · {fmtNum(p.valor / 1e6, 1)} M · {p.concepto}</li>)}</ul></div>}
        </Tarjeta>
        <div className="sticky bottom-3 z-10 mt-5 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between">
          {errores.length ? <p className="text-sm font-medium text-red-700">{errores[0]}</p> : <p className="text-sm text-slate-500">Revisado: {c.actividades.length} actividades por {fmtCOP(suma)}</p>}
          <Boton onClick={guardar} disabled={errores.length > 0 || guardando}>{guardando ? "Guardando…" : "Guardar contrato"}</Boton>
        </div>
      </>}
    </>
  );
}
