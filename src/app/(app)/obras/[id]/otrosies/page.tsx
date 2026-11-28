"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarClock, CircleAlert, FileText, FileUp, Paperclip, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { abrirArchivo, api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { leerContratoPDF } from "@/lib/pdf";
import { fechaCorta, fmtCOP } from "@/lib/format";
import { diasEntre } from "@/lib/fechas";
import type { DatosOtrosies, ItemOtrosiT, OtrosiT } from "@/lib/types";
import { Aviso, Boton, BotonIcono, Campo, Chip, Esqueleto, Input, Modal, Select, Tabla, Tarjeta, Textarea, Titulo, useAviso, useConfirmar } from "@/components/ui";
import { Indicador } from "@/components/comunes";

const MAX_PDF = 3 * 1024 * 1024;
const UMS = ["M2", "M3", "ML", "UND", "GL", "KG"];

type Fila = Omit<ItemOtrosiT, "id"> & { id?: string };
type Borrador = {
  id?: string; numero: string; fecha: string; descripcion: string; valor_adicion: number; fecha_fin_nueva: string;
  actividades: Fila[]; archivo_nombre: string; archivo: string | null; tiene_pdf: boolean;
};

const vacio = (): Borrador => ({ numero: "", fecha: new Date().toISOString().slice(0, 10), descripcion: "", valor_adicion: 0,
  fecha_fin_nueva: "", actividades: [], archivo_nombre: "", archivo: null, tiene_pdf: false });

const deOtrosi = (o: OtrosiT): Borrador => ({ id: o.id, numero: o.numero, fecha: o.fecha, descripcion: o.descripcion,
  valor_adicion: o.valor_adicion, fecha_fin_nueva: o.fecha_fin_nueva ?? "", actividades: o.actividades.map((a) => ({ ...a })),
  archivo_nombre: o.archivo_nombre, archivo: null, tiene_pdf: o.tiene_pdf });

async function aBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export default function Otrosies({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me, tieneModulo } = useSession();
  const aviso = useAviso();
  const confirmar = useConfirmar();
  const [d, setD] = useState<DatosOtrosies | null>(null);
  const [error, setError] = useState("");
  const [b, setB] = useState<Borrador | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorPdf, setErrorPdf] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const cargar = useCallback(() => { api<DatosOtrosies>(`obras/${id}/otrosies`).then(setD).catch((e) => setError(e.message)); }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  const puedeEscribir = !me.solo_lectura && me.licencia?.escritura && ["admin", "gerencia", "super_admin"].includes(me.rol) && tieneModulo("contrato");
  const setFila = (i: number, cambios: Partial<Fila>) => setB((x) => x && ({ ...x, actividades: x.actividades.map((a, k) => {
    if (k !== i) return a;
    const n = { ...a, ...cambios };
    n.valor_total = Math.round(n.cantidad * n.valor_unitario * 100) / 100;
    return n;
  }) }));
  const suma = b?.actividades.reduce((s, a) => s + a.valor_total, 0) ?? 0;

  async function leerPdf(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) return setErrorPdf("El archivo debe ser un PDF.");
    if (file.size > MAX_PDF) return setErrorPdf(`El PDF pesa ${(file.size / 1048576).toFixed(1)} MB y el máximo son 3 MB.`);
    setErrorPdf(""); setLeyendo(true);
    try {
      const [leido, b64] = await Promise.all([leerContratoPDF(file).catch(() => null), aBase64(file)]);
      const nuevas: Fila[] = (leido?.actividades ?? []).map((a) => ({
        item: a.item, grupo: a.grupo, capitulo: a.capitulo, nombre: a.nombre, ubicacion: a.ubicacion, um: a.um,
        cantidad: a.cantidad, valor_unitario: a.valor_unitario, valor_total: a.valor_total, tarifa: null, advertencias: a.advertencias,
      }));
      // El PDF se adjunta siempre; los ítems solo si se pudieron leer, y se añaden a los que ya haya.
      setB((x) => x && ({
        ...x, archivo: b64, archivo_nombre: file.name, tiene_pdf: true,
        numero: x.numero || leido?.numero || "",
        actividades: [...x.actividades, ...nuevas],
        valor_adicion: x.valor_adicion || Math.round(nuevas.reduce((s, a) => s + a.valor_total, 0) * 100) / 100,
      }));
      if (!nuevas.length) setErrorPdf("Se adjuntó el PDF, pero no se pudieron leer actividades. Agréguelas abajo a mano.");
    } catch (e) {
      setErrorPdf(`No se pudo leer el PDF: ${(e as Error).message}`);
    } finally { setLeyendo(false); }
  }

  async function guardar() {
    if (!b) return;
    setGuardando(true);
    try {
      const cuerpo = {
        numero: b.numero.trim(), fecha: b.fecha, descripcion: b.descripcion.trim(),
        valor_adicion: b.valor_adicion, fecha_fin_nueva: b.fecha_fin_nueva || null,
        actividades: b.actividades.map((a) => ({ id: a.id, item: a.item, grupo: a.grupo, capitulo: a.capitulo, nombre: a.nombre,
          ubicacion: a.ubicacion, um: a.um, cantidad: a.cantidad, valor_unitario: a.valor_unitario, tarifa: a.tarifa, advertencias: a.advertencias })),
        archivo_nombre: b.archivo_nombre, archivo: b.archivo,
      };
      const r = b.id
        ? await api<DatosOtrosies>(`obras/${id}/otrosies/${b.id}`, { method: "PUT", body: cuerpo })
        : await api<DatosOtrosies>(`obras/${id}/otrosies`, { method: "POST", body: cuerpo });
      setD(r); setB(null);
      aviso(b.id ? "Otrosí corregido." : "Otrosí agregado al contrato.");
    } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo guardar", "error"); } finally { setGuardando(false); }
  }

  async function eliminar(o: OtrosiT) {
    const ok = await confirmar({
      titulo: `¿Eliminar el otrosí ${o.numero || "s/n"}?`,
      texto: o.items ? `Se borran también sus ${o.items} ítem${o.items === 1 ? "" : "s"} y el contrato vuelve a su valor y plazo anteriores.`
        : "El contrato vuelve a su valor y plazo anteriores.",
      aceptar: "Eliminar", peligro: true,
    });
    if (!ok) return;
    try {
      setD(await api<DatosOtrosies>(`obras/${id}/otrosies/${o.id}`, { method: "DELETE" }));
      aviso("Otrosí eliminado.");
    } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo eliminar", "error"); }
  }

  const errores: string[] = [];
  if (b) {
    if (!b.fecha) errores.push("Indique la fecha del otrosí");
    if (b.actividades.some((a) => !a.nombre.trim() || !(a.cantidad > 0))) errores.push("Todos los ítems necesitan nombre y cantidad mayor a cero");
  }

  const volver = <Link href={`/obras/${id}`} className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-marca-texto hover:underline"><ArrowLeft className="size-4" aria-hidden /> {d?.obra.nombre ?? "Obra"}</Link>;
  if (error) return <>{volver}<Aviso tono="error">{error}</Aviso></>;
  if (!d) return <div aria-busy="true" aria-label="Cargando" className="space-y-4"><Esqueleto className="h-8 w-64" /><Esqueleto className="h-28" /><Esqueleto className="h-64" /></div>;
  if (!d.tiene_contrato) return <>{volver}<Titulo>Otrosíes del contrato</Titulo><Aviso tono="alerta">Cargue primero el contrato de la obra: el otrosí se cuenta sobre él.</Aviso></>;

  return (
    <>
      {volver}
      <Titulo sub={<>Adiciones, prórrogas e ítems nuevos del contrato {d.contrato?.numero || "—"}. El contrato original no se toca.</>}
        acciones={puedeEscribir ? <Boton icono={<Plus className="size-4" aria-hidden />} onClick={() => setB(vacio())}>Nuevo otrosí</Boton> : undefined}>
        Otrosíes
      </Titulo>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador etiqueta="Contrato original" valor={fmtCOP(d.valor_base)} detalle={d.fecha_fin_base ? `Terminaba ${fechaCorta(d.fecha_fin_base)}` : undefined} icono={<FileText className="size-5" aria-hidden />} />
        <Indicador etiqueta="Adiciones" valor={fmtCOP(d.adiciones)} detalle={`${d.otrosies.length} otrosí${d.otrosies.length === 1 ? "" : "es"}`} tono={d.adiciones ? "ok" : undefined} icono={<Wallet className="size-5" aria-hidden />} />
        <Indicador etiqueta="Valor vigente" valor={fmtCOP(d.valor_vigente)} detalle={d.valor_base ? `${((d.valor_vigente / d.valor_base - 1) * 100).toFixed(1)} % sobre el original` : undefined} />
        <Indicador etiqueta="Plazo vigente" valor={d.fecha_fin_vigente ? fechaCorta(d.fecha_fin_vigente) : "—"}
          detalle={d.dias_prorroga ? `${d.dias_prorroga > 0 ? "+" : ""}${d.dias_prorroga} días de prórroga` : "Sin prórrogas"}
          tono={d.dias_prorroga ? "alerta" : undefined} icono={<CalendarClock className="size-5" aria-hidden />} />
      </div>

      <Tarjeta className="mt-5" titulo="Otrosíes firmados" sub="En orden de fecha. Cada uno guarda su PDF, lo que adiciona y los ítems que trajo.">
        {d.otrosies.length === 0 ? <p className="text-sm text-suave">Este contrato no tiene otrosíes. {puedeEscribir ? "Use «Nuevo otrosí» para registrar el primero." : ""}</p> : (
          <Tabla cabeceras={["Otrosí", "Fecha", "Adición", "Prórroga", "Ítems", "PDF", ""]}>
            {d.otrosies.map((o) => (
              <tr key={o.id}>
                <td className="px-3 py-2.5">
                  <span className="font-semibold text-tinta">{o.numero ? `Otrosí ${o.numero}` : "Otrosí s/n"}</span>
                  {o.descripcion && <span className="block text-xs text-suave">{o.descripcion}</span>}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">{fechaCorta(o.fecha)}</td>
                <td className="num px-3 py-2.5 font-semibold">{fmtCOP(o.valor_adicion)}
                  {o.items > 0 && !o.cuadra && <span className="block text-xs font-medium text-alerta">Sus ítems suman {fmtCOP(o.valor_items)}</span>}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">{o.fecha_fin_nueva ? `hasta ${fechaCorta(o.fecha_fin_nueva)}` : "—"}</td>
                <td className="px-3 py-2.5">{o.items || "—"}</td>
                <td className="px-3 py-2.5">
                  {o.tiene_pdf
                    ? <button type="button" onClick={() => void abrirArchivo(`obras/${id}/otrosies/${o.id}/archivo`).catch((e) => aviso(e instanceof Error ? e.message : "No se pudo abrir", "error"))}
                        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-marca-texto hover:underline">
                        <Paperclip className="size-4" aria-hidden /> Ver PDF</button>
                    : <span className="text-suave">—</span>}
                </td>
                <td className="px-3 py-2.5">
                  {puedeEscribir && <span className="flex justify-end gap-1">
                    <BotonIcono etiqueta={`Corregir el otrosí ${o.numero || "s/n"}`} onClick={() => setB(deOtrosi(o))}><Pencil className="size-4" aria-hidden /></BotonIcono>
                    <BotonIcono peligro etiqueta={`Eliminar el otrosí ${o.numero || "s/n"}`} onClick={() => void eliminar(o)}><Trash2 className="size-4" aria-hidden /></BotonIcono>
                  </span>}
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </Tarjeta>

      <Modal abierto={b !== null} onCerrar={() => setB(null)} titulo={b?.id ? "Corregir otrosí" : "Nuevo otrosí"} sucio={!!b}
        pie={<>
          {errores.length > 0 && <p role="status" className="mr-auto flex items-center gap-1.5 text-sm font-medium text-error"><CircleAlert className="size-4 shrink-0" aria-hidden /> {errores[0]}</p>}
          <Boton variante="secundario" onClick={() => setB(null)}>Cancelar</Boton>
          <Boton onClick={guardar} cargando={guardando} disabled={errores.length > 0}>{guardando ? "Guardando…" : "Guardar otrosí"}</Boton>
        </>}>
        {b && <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Número del otrosí" ayuda="Como figura en el documento firmado."><Input data-autofocus value={b.numero} onChange={(e) => setB({ ...b, numero: e.target.value })} placeholder="ej. 1" /></Campo>
            <Campo etiqueta="Fecha del otrosí"><Input type="date" value={b.fecha} onChange={(e) => setB({ ...b, fecha: e.target.value })} /></Campo>
            <Campo etiqueta="Valor que adiciona" ayuda={suma ? `Sus ítems suman ${fmtCOP(suma)}` : "Use valor negativo si el otrosí reduce el contrato."}>
              <Input type="number" inputMode="decimal" className="num" value={b.valor_adicion || ""} onChange={(e) => setB({ ...b, valor_adicion: Number(e.target.value) })} />
            </Campo>
            <Campo etiqueta="Nueva fecha de terminación" ayuda={d.fecha_fin_base ? `El contrato original terminaba el ${fechaCorta(d.fecha_fin_base)}. Déjela vacía si no hay prórroga.` : undefined}>
              <Input type="date" value={b.fecha_fin_nueva} onChange={(e) => setB({ ...b, fecha_fin_nueva: e.target.value })} />
            </Campo>
          </div>
          <Campo etiqueta="Objeto del otrosí"><Textarea rows={2} value={b.descripcion} onChange={(e) => setB({ ...b, descripcion: e.target.value })} placeholder="ej. Adición de pañetes en la torre 2 y prórroga de 45 días" /></Campo>

          <div className="rounded-xl border border-dashed border-borde-campo/70 bg-fondo p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-tinta"><Paperclip className="size-4" aria-hidden /> PDF del otrosí</p>
            <p className="mt-1 text-sm text-suave">Se guarda con el otrosí. Si es un «Detallado por grupos» de SINCO, de una vez se leen sus ítems. Máximo 3 MB.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Boton variante="secundario" tam="sm" cargando={leyendo} icono={<FileUp className="size-4" aria-hidden />} onClick={() => input.current?.click()}>{leyendo ? "Leyendo…" : b.tiene_pdf ? "Cambiar PDF" : "Seleccionar PDF"}</Boton>
              {b.tiene_pdf && <>
                <Chip tono="info">{b.archivo_nombre || "PDF adjunto"}</Chip>
                <Boton variante="secundario" tam="sm" onClick={() => setB({ ...b, archivo: "", archivo_nombre: "", tiene_pdf: false })}>Quitar</Boton>
              </>}
            </div>
            <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" tabIndex={-1} onChange={(e) => void leerPdf(e.target.files?.[0])} />
            {errorPdf && <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm font-medium text-error"><CircleAlert className="size-4 shrink-0" aria-hidden /> {errorPdf}</p>}
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-tinta">Ítems que trae el otrosí</h3>
              <Boton variante="secundario" tam="sm" icono={<Plus className="size-4" aria-hidden />}
                onClick={() => setB({ ...b, actividades: [...b.actividades, { item: "", grupo: 0, capitulo: "", nombre: "", ubicacion: "", um: "M2", cantidad: 0, valor_unitario: 0, valor_total: 0, tarifa: null, advertencias: [] }] })}>Agregar ítem</Boton>
            </div>
            <p className="mt-1 text-sm text-suave">Se suman a las actividades de la obra y quedan marcados con este otrosí. Déjelo vacío si el otrosí solo cambia valor o plazo.</p>
            {b.actividades.length > 0 && <div className="-mx-4 mt-3 overflow-x-auto sm:mx-0"><table className="w-full min-w-[720px] text-sm">
              <thead><tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-suave">
                <th scope="col" className="px-2 py-2 font-semibold">Actividad</th><th scope="col" className="px-2 py-2 font-semibold">Ubicación</th>
                <th scope="col" className="px-2 py-2 font-semibold">Unidad</th><th scope="col" className="px-2 py-2 text-right font-semibold">Cantidad</th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">Valor unitario</th><th scope="col" className="px-2 py-2 text-right font-semibold">Total</th>
                <th scope="col"><span className="sr-only">Acciones</span></th></tr></thead>
              <tbody className="divide-y divide-borde">{b.actividades.map((a, i) => (
                <tr key={a.id ?? `n${i}`}>
                  <td className="px-2 py-2"><Input aria-label="Nombre del ítem" className="min-h-11 py-1 text-sm pointer-fine:min-h-9" value={a.nombre} onChange={(e) => setFila(i, { nombre: e.target.value })} /></td>
                  <td className="px-2 py-2"><Input aria-label="Ubicación" className="min-h-11 w-28 py-1 text-sm pointer-fine:min-h-9" value={a.ubicacion} onChange={(e) => setFila(i, { ubicacion: e.target.value })} /></td>
                  <td className="px-2 py-2"><Select aria-label="Unidad de medida" className="min-h-11 w-24 py-1 text-sm pointer-fine:min-h-9" value={a.um} onChange={(e) => setFila(i, { um: e.target.value })}>{UMS.map((u) => <option key={u}>{u}</option>)}</Select></td>
                  <td className="px-2 py-2"><Input aria-label="Cantidad" type="number" inputMode="decimal" className="num min-h-11 w-28 py-1 text-right text-sm pointer-fine:min-h-9" value={a.cantidad || ""} onChange={(e) => setFila(i, { cantidad: Number(e.target.value) })} /></td>
                  <td className="px-2 py-2"><Input aria-label="Valor unitario" type="number" inputMode="decimal" className="num min-h-11 w-32 py-1 text-right text-sm pointer-fine:min-h-9" value={a.valor_unitario || ""} onChange={(e) => setFila(i, { valor_unitario: Number(e.target.value) })} /></td>
                  <td className="num px-2 py-2 text-right font-semibold">{fmtCOP(a.valor_total)}</td>
                  <td className="px-2 py-2"><BotonIcono peligro etiqueta={`Quitar ${a.nombre || "ítem"}`} onClick={() => setB({ ...b, actividades: b.actividades.filter((_, k) => k !== i) })}><Trash2 className="size-4" aria-hidden /></BotonIcono></td>
                </tr>))}</tbody></table></div>}
            {b.actividades.length > 0 && <p className="mt-2 text-sm text-suave">{b.actividades.length} ítem{b.actividades.length === 1 ? "" : "s"} por {fmtCOP(suma)}
              {Math.abs(suma - b.valor_adicion) >= 1 && <Boton variante="secundario" tam="sm" className="ml-2" onClick={() => setB({ ...b, valor_adicion: Math.round(suma * 100) / 100 })}>Usar como valor del otrosí</Boton>}</p>}
            {b.fecha_fin_nueva && d.fecha_fin_base && <p className="mt-2 text-sm text-suave">Prórroga de {diasEntre(d.fecha_fin_base, b.fecha_fin_nueva)} días sobre el plazo original.</p>}
          </div>
        </div>}
      </Modal>
    </>
  );
}
