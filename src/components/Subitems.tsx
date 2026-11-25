"use client";
import { useEffect, useState } from "react";
import { Layers, Plus, Scale, Trash2, TriangleAlert } from "lucide-react";
import { api } from "@/lib/client";
import { fmtCOP, fmtNum, fmtPct } from "@/lib/format";
import type { ActividadT } from "@/lib/types";
import { Aviso, Boton, BotonIcono, Campo, Chip, Esqueleto, Input, Modal, useAviso } from "./ui";

type Fila = { id?: string; nombre: string; um: string; cantidad: string; equivale: string; aporta_avance: boolean; tarifa: string; ejecutado?: number };
type Datos = { item: ActividadT; subitems: ActividadT[]; repartido: number; sin_repartir: number };

const nueva = (um: string, aporta = true): Fila => ({ nombre: "", um, cantidad: "1", equivale: "", aporta_avance: aporta, tarifa: "" });
const deSubitem = (s: ActividadT): Fila => ({ id: s.id, nombre: s.nombre, um: s.um, cantidad: String(s.cantidad), equivale: s.equivale ? String(s.equivale) : "",
  aporta_avance: s.aporta_avance, tarifa: s.tarifa == null ? "" : String(s.tarifa), ejecutado: s.ejecutado });

/**
 * Parte un ítem del contrato en subítems: las porciones con que la empresa mide y paga el trabajo
 * (ej. «Apartamento 101» = 1 APTO = 76 M2 de los 500 M2 de mampostería).
 */
export function Subitems({ obraId, actividadId, puedeEditar, onCerrar, onGuardado }: {
  obraId: string; actividadId: string | null; puedeEditar: boolean; onCerrar: () => void; onGuardado: () => void;
}) {
  const aviso = useAviso();
  const [res, setRes] = useState<{ aid: string; d: Datos; filas: Fila[] } | null>(null);
  const [ed, setEd] = useState<{ aid: string; filas: Fila[] } | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!actividadId) return;
    let vivo = true;
    api<Datos>(`obras/${obraId}/actividades/${actividadId}/subitems`)
      .then((r) => { if (vivo) { setRes({ aid: actividadId, d: r, filas: r.subitems.map(deSubitem) }); setEd(null); setError(""); } })
      .catch((e) => vivo && setError(e.message));
    return () => { vivo = false; };
  }, [obraId, actividadId]);

  const d = res?.aid === actividadId ? res.d : null;
  const filas = (ed?.aid === actividadId ? ed.filas : res?.aid === actividadId ? res.filas : []) as Fila[];
  const setFilas = (f: Fila[]) => actividadId && setEd({ aid: actividadId, filas: f });
  const item = d?.item;
  const set = (i: number, c: Partial<Fila>) => setFilas(filas.map((f, k) => (k === i ? { ...f, ...c } : f)));
  const conAvance = filas.filter((f) => f.aporta_avance);
  const repartido = conAvance.reduce((s, f) => s + (Number(f.equivale) || 0), 0);
  const falta = item ? item.cantidad - repartido : 0;
  const pasado = falta < -1e-6;

  /** Reparte lo que falta en partes iguales entre los subítems que dan avance. */
  function parejo() {
    if (!item || !conAvance.length) return;
    const cada = Math.round((item.cantidad / conAvance.length) * 100) / 100;
    let resto = item.cantidad;
    let vistos = 0;
    setFilas(filas.map((f) => {
      if (!f.aporta_avance) return f;
      vistos += 1;
      const v = vistos === conAvance.length ? Math.round(resto * 100) / 100 : cada;
      resto -= v;
      return { ...f, equivale: String(v) };
    }));
  }

  async function guardar() {
    if (!item) return;
    setGuardando(true);
    try {
      const cuerpo = filas.map((f) => ({ id: f.id, nombre: f.nombre.trim(), um: f.um.trim() || "UND", cantidad: Number(f.cantidad) || 0,
        equivale: f.aporta_avance ? Number(f.equivale) || 0 : 0, aporta_avance: f.aporta_avance, tarifa: f.tarifa === "" ? null : Number(f.tarifa) }));
      await api(`obras/${obraId}/actividades/${item.id}/subitems`, { method: "PUT", body: cuerpo });
      aviso(cuerpo.length ? "Subítems guardados" : "El ítem vuelve a medirse completo");
      onGuardado();
      onCerrar();
    } catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); }
    finally { setGuardando(false); }
  }

  const incompleto = filas.some((f) => !f.nombre.trim() || !(Number(f.cantidad) > 0) || (f.aporta_avance && !(Number(f.equivale) > 0)));

  return (
    <Modal abierto={!!actividadId} onCerrar={onCerrar} titulo={item ? `Subítems de ${item.nombre}` : "Subítems"}
      pie={puedeEditar ? <><Boton type="button" variante="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton type="button" cargando={guardando} disabled={pasado || incompleto} onClick={guardar}>Guardar</Boton></> : <Boton type="button" variante="secundario" onClick={onCerrar}>Cerrar</Boton>}>
      {error && <Aviso tono="error">{error}</Aviso>}
      {!d && !error && <Esqueleto className="h-40" />}
      {item && (
        <div className="space-y-4">
          <p className="text-sm text-suave">
            El contrato mide este ítem en <strong className="text-tinta">{fmtNum(item.cantidad)} {item.um}</strong> a {fmtCOP(item.valor_unitario)} por {item.um}.
            Pártalo en las porciones con que usted mide y paga el trabajo, y diga a cuántos {item.um} equivale cada una.
          </p>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-borde bg-fondo p-3 text-sm">
            <Chip tono={pasado ? "error" : repartido ? "info" : "neutro"}>Repartido {fmtNum(repartido)} {item.um}</Chip>
            <Chip tono={pasado ? "error" : falta > 0 ? "alerta" : "ok"}>{pasado ? `Se pasó por ${fmtNum(-falta)} ${item.um}` : falta > 0 ? `Falta por repartir ${fmtNum(falta)} ${item.um}` : "Repartido completo"}</Chip>
            {puedeEditar && conAvance.length > 0 && <Boton type="button" tam="sm" variante="secundario" icono={<Scale className="size-4" aria-hidden />} onClick={parejo}>Repartir parejo</Boton>}
          </div>
          {pasado && <Aviso tono="error">Los subítems suman más de lo contratado. Baje alguna equivalencia antes de guardar.</Aviso>}

          {filas.length === 0 && <p className="text-sm text-suave">Sin subítems: el avance se registra directo sobre el ítem, en {item.um}.</p>}

          <ul className="space-y-3">
            {filas.map((f, i) => (
              <li key={f.id ?? `n${i}`} className="rounded-xl border border-borde bg-tarjeta p-3">
                <div className="flex items-start gap-2">
                  <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_6rem_7rem]">
                    <Campo etiqueta="Nombre"><Input value={f.nombre} disabled={!puedeEditar} placeholder="Apartamento 101" onChange={(e) => set(i, { nombre: e.target.value })} /></Campo>
                    <Campo etiqueta="Unidad"><Input value={f.um} maxLength={12} disabled={!puedeEditar} onChange={(e) => set(i, { um: e.target.value })} /></Campo>
                    <Campo etiqueta="Cuántos"><Input type="number" min={0} step="any" inputMode="decimal" className="num" value={f.cantidad} disabled={!puedeEditar} onChange={(e) => set(i, { cantidad: e.target.value })} /></Campo>
                  </div>
                  {puedeEditar && <BotonIcono peligro etiqueta={`Quitar ${f.nombre || "subítem"}`} onClick={() => setFilas(filas.filter((_, k) => k !== i))}><Trash2 className="size-4" aria-hidden /></BotonIcono>}
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {f.aporta_avance ? (
                    <Campo etiqueta={`Equivale a (${item.um} del ítem)`} ayuda={Number(f.equivale) > 0 && item.cantidad ? `${fmtPct(Number(f.equivale) / item.cantidad)} del ítem` : "Cuánto del contrato se completa al terminarlo"}>
                      <Input type="number" min={0} step="any" inputMode="decimal" className="num" value={f.equivale} disabled={!puedeEditar} onChange={(e) => set(i, { equivale: e.target.value })} />
                    </Campo>
                  ) : (
                    <Campo etiqueta="Equivale a" ayuda="Este subítem no da avance: solo carga su costo al ítem"><Input value="—" disabled /></Campo>
                  )}
                  <Campo etiqueta={`Tarifa por ${f.um || "unidad"}`} ayuda={Number(f.tarifa) > 0 ? `${fmtCOP(Number(f.tarifa))} a quien lo ejecute` : "Lo que se le paga al trabajador por unidad"}>
                    <Input type="number" min={0} inputMode="numeric" className="num" value={f.tarifa} disabled={!puedeEditar} onChange={(e) => set(i, { tarifa: e.target.value })} />
                  </Campo>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
                    <input type="checkbox" className="size-5" checked={f.aporta_avance} disabled={!puedeEditar} onChange={(e) => set(i, { aporta_avance: e.target.checked, equivale: e.target.checked ? f.equivale : "" })} />
                    Da avance al ítem
                  </label>
                  {!!f.ejecutado && <Chip tono="ok">Ejecutado {fmtNum(f.ejecutado)} {f.um}</Chip>}
                  {!!f.ejecutado && !puedeEditar && <Chip tono="neutro">No se puede quitar con avance</Chip>}
                </div>
              </li>
            ))}
          </ul>

          {puedeEditar && (
            <div className="flex flex-wrap gap-2">
              <Boton type="button" variante="secundario" icono={<Plus className="size-4" aria-hidden />} onClick={() => setFilas([...filas, nueva(item.um)])}>Agregar subítem</Boton>
              <Boton type="button" variante="fantasma" icono={<Layers className="size-4" aria-hidden />} onClick={() => setFilas([...filas, nueva("UND", false)])}>Agregar costo de apoyo</Boton>
            </div>
          )}
          {incompleto && puedeEditar && <p className="flex items-center gap-1.5 text-sm text-suave"><TriangleAlert className="size-4 shrink-0" aria-hidden /> Cada subítem necesita nombre, cuántos hay y, si da avance, su equivalencia.</p>}
        </div>
      )}
    </Modal>
  );
}
