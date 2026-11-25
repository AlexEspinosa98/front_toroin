"use client";
import { ArrowLeft, CircleAlert, FileText, FileUp, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { contratoVacio, type ActividadLeida, type ContratoLeido } from "@/lib/contratoParser";
import { soloItems } from "@/lib/actividades";
import { leerContratoPDF } from "@/lib/pdf";
import { fechaCorta, fmtCOP, fmtNum } from "@/lib/format";
import type { DatosObra } from "@/lib/types";
import { Aviso, Boton, BotonIcono, Campo, Chip, Input, Select, Tarjeta, Titulo, useAviso } from "@/components/ui";
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
  const [arrastrando, setArrastrando] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<DatosObra>(`obras/${id}/contrato`).then((d) => {
      setObra(d);
      // Solo los ítems del contrato: los subítems de la empresa se manejan aparte, desde el tablero de la obra
      if (d.contrato) setC({ ...contratoVacio(), ...d.contrato, actividades: soloItems(d.actividades).map((a) => ({ ...a })), ingresos_proyectados: d.obra.ingresos_proyectados });
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
      <Link href={`/obras/${id}`} className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-marca-texto hover:underline"><ArrowLeft className="size-4" aria-hidden /> {obra?.obra.nombre ?? "Obra"}</Link>
      <Titulo sub="Se extraen actividades, unidades, cantidades y plazo. Siempre se revisa antes de guardar.">Contrato de la obra</Titulo>
      <div className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors duration-150 ${arrastrando ? "border-marca bg-marca-50" : "border-borde-campo/60 bg-white"}`}
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }} onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastrando(false); void leer(e.dataTransfer.files[0]); }}>
        <span className="rounded-full bg-marca-50 p-3 text-marca-texto"><FileUp className="size-6" aria-hidden /></span>
        <p className="font-bold text-tinta">{c ? "Cargar otro PDF" : "Arrastre aquí el PDF del contrato"}</p>
        <p className="text-sm text-suave">Formato SINCO ERP «Contrato detallado por grupos». El archivo se lee en su equipo y no se sube.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Boton cargando={leyendo} icono={<FileUp className="size-4" aria-hidden />} onClick={() => input.current?.click()}>{leyendo ? "Leyendo contrato…" : "Seleccionar PDF"}</Boton>
          {!c && <Boton variante="secundario" onClick={() => setC(contratoVacio())}>Ingresar manualmente</Boton>}
        </div>
        <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" tabIndex={-1} onChange={(e) => leer(e.target.files?.[0])} />
        {error && <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-error"><CircleAlert className="size-4 shrink-0" aria-hidden /> {error}</p>}
      </div>

      {c && <>
        {c.advertencias.length > 0 && <div className="mt-5 space-y-2">{c.advertencias.map((a) => <Aviso key={a} tono="alerta">{a}</Aviso>)}</div>}
        {obra && obra.actividades.some((a) => a.ejecutado > 0) && <div className="mt-3"><Aviso tono="error">Esta obra ya tiene avance en la bitácora. No puede quitar actividades con avance registrado; use un otrosí en lugar de reemplazar el contrato.</Aviso></div>}
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador etiqueta="Valor del contrato" valor={fmtCOP(c.valor_total || suma)} detalle={c.valor_antes_aiu ? `Antes de AIU ${fmtCOP(c.valor_antes_aiu)}` : undefined} icono={<FileText className="size-5" aria-hidden />} />
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
          {c.descripcion && <p className="mt-3 text-sm text-suave">{c.descripcion}</p>}
        </Tarjeta>
        <Tarjeta className="mt-5" titulo="Actividades del contrato" sub="Revise unidades y cantidades. Las filas marcadas tienen diferencias en el PDF." acciones={<Boton variante="secundario" tam="sm" icono={<Plus className="size-4" aria-hidden />} onClick={() => setC((x) => x && { ...x, actividades: [...x.actividades, { item: "", grupo: x.actividades.length + 1, capitulo: "", nombre: "", ubicacion: "", um: "M2", cantidad: 0, valor_unitario: 0, valor_total: 0, advertencias: [] }] })}>Agregar</Boton>}>
          <div className="-mx-4 overflow-x-auto sm:mx-0"><table className="w-full min-w-[860px] text-sm">
            <thead><tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-suave"><th scope="col" className="px-2 py-2 font-semibold">Ítem</th><th scope="col" className="px-2 py-2 font-semibold">Actividad</th><th scope="col" className="px-2 py-2 font-semibold">Ubicación</th><th scope="col" className="px-2 py-2 font-semibold">Unidad</th><th scope="col" className="px-2 py-2 text-right font-semibold">Cantidad</th><th scope="col" className="px-2 py-2 text-right font-semibold">Valor unitario</th><th scope="col" className="px-2 py-2 text-right font-semibold">Total</th><th scope="col"><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody className="divide-y divide-borde">{c.actividades.map((a, i) => (
              <tr key={a.id ?? `n${i}`} className={a.advertencias.length ? "bg-alerta-50/70" : ""}>
                <td className="px-2 py-2 text-suave">{a.item || "—"}</td>
                <td className="px-2 py-2"><Input aria-label="Nombre de la actividad" className="min-h-11 py-1 text-sm pointer-fine:min-h-9" value={a.nombre} onChange={(e) => setAct(i, { nombre: e.target.value })} />{a.advertencias.map((w) => <span key={w} className="mt-1 block text-xs font-medium text-alerta">{w}</span>)}</td>
                <td className="px-2 py-2"><Input aria-label="Ubicación" className="min-h-11 w-28 py-1 text-sm pointer-fine:min-h-9" value={a.ubicacion} onChange={(e) => setAct(i, { ubicacion: e.target.value })} /></td>
                <td className="px-2 py-2"><Select aria-label="Unidad de medida" className="min-h-11 w-24 py-1 text-sm pointer-fine:min-h-9" value={a.um} onChange={(e) => setAct(i, { um: e.target.value, advertencias: [] })}>{["M2", "M3", "ML", "UND", "GL", "KG"].map((u) => <option key={u}>{u}</option>)}</Select></td>
                <td className="px-2 py-2"><Input aria-label="Cantidad" type="number" inputMode="decimal" className="num min-h-11 w-28 py-1 text-right text-sm pointer-fine:min-h-9" value={a.cantidad || ""} onChange={(e) => setAct(i, { cantidad: Number(e.target.value) })} /></td>
                <td className="px-2 py-2"><Input aria-label="Valor unitario" type="number" inputMode="decimal" className="num min-h-11 w-32 py-1 text-right text-sm pointer-fine:min-h-9" value={a.valor_unitario || ""} onChange={(e) => setAct(i, { valor_unitario: Number(e.target.value) })} /></td>
                <td className="num px-2 py-2 text-right font-semibold">{fmtCOP(a.valor_total)}</td>
                <td className="px-2 py-2"><BotonIcono peligro etiqueta={`Eliminar ${a.nombre || "actividad"}`} onClick={() => setC((x) => x && { ...x, actividades: x.actividades.filter((_, k) => k !== i) })}><Trash2 className="size-4" aria-hidden /></BotonIcono></td></tr>))}</tbody></table></div>
          {c.pagos.length > 0 && <div className="mt-4"><h3 className="text-sm font-bold text-tinta">Programación de pagos del contrato</h3>
            <ul className="mt-1 flex flex-wrap gap-2">{c.pagos.map((p, k) => <li key={k}><Chip tono="info">{fechaCorta(p.fecha)} · {fmtNum(p.valor / 1e6, 1)} M · {p.concepto}</Chip></li>)}</ul></div>}
        </Tarjeta>
        <div className="sobre-nav sticky z-10 backdrop-blur mt-5 flex flex-col gap-2 rounded-xl border border-borde bg-white/95 p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between">
          {errores.length ? <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-error"><CircleAlert className="size-4 shrink-0" aria-hidden /> {errores[0]}</p> : <p className="text-sm text-suave">Revisado: {c.actividades.length} actividades por {fmtCOP(suma)}</p>}
          <Boton tam="lg" onClick={guardar} cargando={guardando} disabled={errores.length > 0}>{guardando ? "Guardando…" : "Guardar contrato"}</Boton>
        </div>
      </>}
    </>
  );
}
