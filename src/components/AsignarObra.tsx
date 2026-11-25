"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { hoy } from "@/lib/fechas";
import { fmtCOP } from "@/lib/format";
import type { ObraBasica } from "@/lib/obras";
import { Boton, Campo, Input, Modal, Segmentado, Select, useAviso } from "./ui";

export type Modalidad = "" | "jornal" | "destajo";
export type Asignacion = { id: string; trabajador_id: string; obra_id: string; fecha_ingreso: string; fecha_retiro: string | null; modalidad: Modalidad; jornal: number | null };

export const TEXTO_PAGO: Record<Modalidad, string> = { "": "Como la empresa", jornal: "Por jornal", destajo: "Por ejecutado" };

/** Cómo se le paga en esta obra: por día trabajado o por cantidad ejecutada. */
export function FormaDePago({ modalidad, jornal, onCambio, porDefecto }: {
  modalidad: Modalidad; jornal: string; onCambio: (m: Modalidad, j: string) => void; porDefecto?: string;
}) {
  return (
    <>
      <Campo etiqueta="Forma de pago en esta obra"
        ayuda={modalidad === "destajo" ? "Se le paga por lo que ejecute, según la tarifa de cada subítem."
          : modalidad === "jornal" ? "Se le paga por día trabajado."
          : `Se usa la de la empresa${porDefecto ? ` (${porDefecto})` : ""}.`}>
        <Segmentado<Modalidad> ancho etiqueta="Forma de pago" valor={modalidad} onChange={(m) => onCambio(m, m === "destajo" ? "" : jornal)}
          opciones={[{ valor: "", texto: "Como la empresa" }, { valor: "jornal", texto: "Por jornal" }, { valor: "destajo", texto: "Por ejecutado" }]} />
      </Campo>
      {modalidad === "jornal" && (
        <Campo etiqueta="Jornal en esta obra (opcional)" ayuda={Number(jornal) > 0 ? fmtCOP(Number(jornal)) : "Vacío = el jornal del trabajador"}>
          <Input type="number" min={0} inputMode="numeric" className="num" value={jornal} onChange={(e) => onCambio(modalidad, e.target.value)} />
        </Campo>
      )}
    </>
  );
}

/** Asignar a una obra sin salir de la lista de Personal. */
export function AsignarObra({ trabajador, obras, asignadas, porDefecto, onCerrar, onHecho }: {
  trabajador: { id: string; nombre: string } | null;
  obras: Pick<ObraBasica, "id" | "nombre">[];
  asignadas: string[];
  porDefecto?: string;
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const aviso = useAviso();
  const libres = obras.filter((o) => !asignadas.includes(o.id));
  const [f, setF] = useState({ obra_id: "", fecha: hoy(), modalidad: "" as Modalidad, jornal: "" });
  const [intento, setIntento] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setIntento(true);
    if (!trabajador || !f.obra_id) return;
    try {
      await api("asignaciones", { method: "POST", body: { trabajador_id: trabajador.id, obra_id: f.obra_id, fecha_ingreso: f.fecha,
        modalidad: f.modalidad, jornal: f.jornal === "" ? null : Number(f.jornal) } });
      aviso(`${trabajador.nombre} quedó asignado a ${obras.find((o) => o.id === f.obra_id)?.nombre ?? "la obra"}`);
      setF({ obra_id: "", fecha: hoy(), modalidad: "", jornal: "" });
      setIntento(false);
      onHecho();
      onCerrar();
    } catch (x) { aviso(x instanceof Error ? x.message : "Error", "error"); }
  }

  return (
    <Modal abierto={!!trabajador} onCerrar={onCerrar} sucio={!!f.obra_id} titulo={trabajador ? `Asignar a ${trabajador.nombre}` : ""}
      pie={<><Boton type="button" variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton type="submit" form="form-asignar" disabled={!libres.length}>Asignar</Boton></>}>
      <form id="form-asignar" onSubmit={guardar} className="space-y-4" noValidate>
        <Campo etiqueta="Obra" error={intento && !f.obra_id ? "Elija la obra" : undefined}>
          <Select data-autofocus value={f.obra_id} onChange={(e) => setF({ ...f, obra_id: e.target.value })}>
            <option value="">Seleccione…</option>
            {libres.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </Select>
        </Campo>
        {!libres.length && <p className="text-sm text-suave">Ya está asignado a todas las obras.</p>}
        <Campo etiqueta="Desde"><Input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Campo>
        <FormaDePago modalidad={f.modalidad} jornal={f.jornal} porDefecto={porDefecto} onCambio={(modalidad, jornal) => setF({ ...f, modalidad, jornal })} />
      </form>
    </Modal>
  );
}
