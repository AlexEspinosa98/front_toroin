"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, ChevronRight, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { fechaCorta, fmtMillones, fmtPct } from "@/lib/format";
import type { ResumenObraT } from "@/lib/types";
import { Aviso, Boton, BotonIcono, Campo, Chip, Esqueleto, Input, Modal, Select, Titulo, Vacio, useAviso, useConfirmar } from "@/components/ui";
import { BarraAvance, ChipSemaforo } from "@/components/comunes";

type Obra = { id: string; nombre: string; ciudad: string; estado: string };
type Resumen = { resumen: ResumenObraT; contrato: { numero: string; fecha_fin: string } | null };

export default function Obras() {
  const { me, tieneModulo } = useSession();
  const aviso = useAviso();
  const confirmar = useConfirmar();
  const [obras, setObras] = useState<Obra[] | null>(null);
  const [res, setRes] = useState<Record<string, Resumen>>({});
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<Partial<Obra> | null>(null);
  const puedeEscribir = !me.solo_lectura && me.licencia?.escritura && ["admin", "gerencia", "super_admin"].includes(me.rol);
  const conContrato = tieneModulo("contrato");

  const cargar = useCallback(() => api<Obra[]>("obras").then(setObras).catch((e) => setError(e.message)), []);
  useEffect(() => { if (tieneModulo("obras")) void cargar(); }, [cargar, tieneModulo]);
  // Con el módulo de contrato se enriquecen las tarjetas con el avance de cada obra
  useEffect(() => {
    if (!conContrato) return;
    api<(Resumen & { obra: { id: string } })[]>("contratos").then((f) => setRes(Object.fromEntries(f.map((x) => [x.obra.id, x])))).catch(() => {});
  }, [conContrato, obras]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    try {
      const body = { nombre: edit.nombre ?? "", ciudad: edit.ciudad ?? "", estado: edit.estado ?? "activa" };
      if (edit.id) await api(`obras/${edit.id}`, { method: "PUT", body }); else await api("obras", { method: "POST", body });
      setEdit(null); aviso("Obra guardada"); void cargar();
    } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo guardar", "error"); }
  }
  async function borrar(o: Obra) {
    if (!(await confirmar({ titulo: `¿Eliminar «${o.nombre}»?`, texto: "Esta acción no se puede deshacer.", aceptar: "Eliminar", peligro: true }))) return;
    try { await api(`obras/${o.id}`, { method: "DELETE" }); aviso("Obra eliminada"); void cargar(); } catch (x) { aviso(x instanceof Error ? x.message : "No se pudo eliminar", "error"); }
  }

  return (
    <>
      <Titulo sub="Cada obra inicia cargando su contrato" acciones={puedeEscribir && <Boton icono={<Plus className="size-4" aria-hidden />} onClick={() => setEdit({ estado: "activa" })}>Nueva obra</Boton>}>Obras</Titulo>
      {error && <Aviso tono="error">{error}</Aviso>}
      {!obras && !error && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Esqueleto className="h-44" /><Esqueleto className="h-44" /><Esqueleto className="hidden h-44 xl:block" /></div>}
      {obras && (obras.length === 0 ? (
        <Vacio icono={<Building2 className="size-6" aria-hidden />} titulo="Aún no hay obras registradas" texto="Cree la primera obra y cargue su contrato para empezar a medir el avance."
          accion={puedeEscribir ? <Boton icono={<Plus className="size-4" aria-hidden />} onClick={() => setEdit({ estado: "activa" })}>Nueva obra</Boton> : undefined} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {obras.map((o) => {
            const r = res[o.id];
            const tablero = tieneModulo("contrato");
            return (
              <article key={o.id} className="flex flex-col rounded-xl border border-borde bg-tarjeta p-4 transition-colors duration-150 hover:border-marca/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="rounded-lg bg-marca-50 p-2 text-marca-texto"><Building2 className="size-5" aria-hidden /></span>
                    <div className="min-w-0">
                      <h2 className="break-words font-bold leading-snug text-tinta">{o.nombre}</h2>
                      <p className="flex items-center gap-1 text-sm text-suave"><MapPin className="size-3.5 shrink-0" aria-hidden />{o.ciudad || "Sin ciudad"}</p>
                    </div>
                  </div>
                  {r ? <span className="shrink-0"><ChipSemaforo s={r.resumen.semaforo} /></span> : <Chip tono={o.estado === "activa" ? "ok" : o.estado === "pausada" ? "alerta" : "neutro"}>{o.estado}</Chip>}
                </div>
                {r?.contrato ? (
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-2"><span className="text-suave">Contrato {r.contrato.numero || "—"}</span><span className="num font-semibold">{fmtMillones(r.resumen.valor_contrato)}</span></div>
                    <BarraAvance valor={r.resumen.avance_fisico} meta={r.resumen.avance_tiempo} etiqueta={`Avance de ${o.nombre}`}
                      tono={r.resumen.semaforo === "atrasada" ? "error" : r.resumen.semaforo === "atencion" ? "alerta" : "ok"} />
                    <div className="flex flex-wrap justify-between gap-x-3 text-suave"><span className="num whitespace-nowrap">Físico {fmtPct(r.resumen.avance_fisico)} · Tiempo {fmtPct(r.resumen.avance_tiempo)}</span><span className="whitespace-nowrap">Fin {fechaCorta(r.contrato.fecha_fin)}</span></div>
                  </div>
                ) : tablero && r ? <p className="mt-4 text-sm text-suave">Sin contrato cargado.</p> : null}
                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                  {tablero ? (
                    <Link href={`/obras/${o.id}`} className="group inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-marca-texto">
                      {r && !r.contrato ? "Cargar contrato" : "Ver tablero"} <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  ) : <span />}
                  {puedeEscribir && (
                    <span className="flex">
                      <BotonIcono etiqueta={`Editar ${o.nombre}`} onClick={() => setEdit(o)}><Pencil className="size-4" aria-hidden /></BotonIcono>
                      <BotonIcono etiqueta={`Eliminar ${o.nombre}`} peligro onClick={() => borrar(o)}><Trash2 className="size-4" aria-hidden /></BotonIcono>
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ))}
      <Modal abierto={!!edit} titulo={edit?.id ? "Editar obra" : "Nueva obra"} onCerrar={() => setEdit(null)}
        pie={<><Boton type="button" variante="secundario" onClick={() => setEdit(null)}>Cancelar</Boton><Boton type="submit" form="form-obra">Guardar</Boton></>}>
        <form id="form-obra" onSubmit={guardar} className="space-y-4">
          <Campo etiqueta="Nombre"><Input data-autofocus required minLength={2} value={edit?.nombre ?? ""} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></Campo>
          <Campo etiqueta="Ciudad"><Input value={edit?.ciudad ?? ""} onChange={(e) => setEdit({ ...edit, ciudad: e.target.value })} /></Campo>
          <Campo etiqueta="Estado">
            <Select value={edit?.estado ?? "activa"} onChange={(e) => setEdit({ ...edit, estado: e.target.value })}>
              <option value="activa">Activa</option><option value="pausada">Pausada</option><option value="terminada">Terminada</option>
            </Select>
          </Campo>
        </form>
      </Modal>
    </>
  );
}
