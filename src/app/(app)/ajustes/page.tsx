"use client";
import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, Save, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { fechaCorta, fmtCOP } from "@/lib/format";
import { hoy, nombreDia } from "@/lib/fechas";
import { Aviso, Boton, BotonIcono, Campo, Esqueleto, Grupo, Input, Segmentado, Select, Tarjeta, Titulo, useAviso } from "@/components/ui";

type Cfg = { semana: "LS" | "LV"; regla_dominical: "legal" | "literal"; modalidad_pago: "jornal" | "destajo"; jornal_base: number; factor_prestacional: number; festivos_extra: string[]; smmlv: number; aux_transporte: number; jornal_minimo: number };
type Fest = { fecha: string; nombre: string };
const reglas = (c: Cfg) => JSON.stringify([c.semana, c.regla_dominical, c.modalidad_pago, c.jornal_base, c.factor_prestacional]);

export default function Ajustes() {
  const { me } = useSession();
  const aviso = useAviso();
  const [base, setBase] = useState<Cfg | null>(null); // lo guardado en el servidor
  const [c, setC] = useState<Cfg | null>(null); // borrador de las reglas
  const [fest, setFest] = useState<Fest[]>([]);
  const [anio, setAnio] = useState(Number(hoy().slice(0, 4)));
  const [nuevo, setNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const puede = !me.solo_lectura && me.licencia?.escritura && ["admin", "gerencia", "super_admin"].includes(me.rol);

  useEffect(() => { api<Cfg>("config").then((r) => { setBase(r); setC(r); }).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    let vivo = true;
    api<Fest[]>(`festivos?anio=${anio}`).then((f) => vivo && setFest(f)).catch(() => vivo && setFest([]));
    return () => { vivo = false; };
  }, [anio, base?.festivos_extra]);
  const sucio = useMemo(() => !!base && !!c && reglas(base) !== reglas(c), [base, c]);

  if (!base || !c) return <>{error ? <Aviso tono="error">{error}</Aviso> : <div className="space-y-3"><Esqueleto className="h-9 w-48" /><Esqueleto className="h-72" /></div>}</>;
  const set = <K extends keyof Cfg>(k: K, v: Cfg[K]) => setC({ ...c, [k]: v });
  const errJornal = !(c.jornal_base > 0) ? "Ingrese un valor mayor a cero" : c.jornal_base < base.jornal_minimo ? `Está por debajo del mínimo legal (${fmtCOP(base.jornal_minimo)})` : undefined;

  async function guardar(x: Cfg) {
    setGuardando(true);
    try { const r = await api<Cfg>("config", { method: "PUT", body: x }); setBase(r); return r; }
    catch (e) { aviso(e instanceof Error ? e.message : "Error", "error"); return null; }
    finally { setGuardando(false); }
  }
  async function guardarReglas() {
    if (!(c!.jornal_base > 0)) return;
    // Los festivos extra se guardan aparte: aquí no se tocan
    const r = await guardar({ ...c!, festivos_extra: base!.festivos_extra });
    if (r) { setC(r); aviso("Ajustes guardados"); }
  }
  async function festivosExtra(lista: string[], ok: string) {
    const r = await guardar({ ...base!, festivos_extra: lista });
    if (r) { setC((x) => x && { ...x, festivos_extra: r.festivos_extra }); aviso(ok); }
  }

  return (
    <>
      <Titulo sub="Reglas de nómina y calendario de la empresa">Ajustes</Titulo>
      {!puede && <div className="mb-4"><Aviso>Solo administración y gerencia pueden cambiar estos ajustes. Aquí puede consultarlos.</Aviso></div>}
      <div className="grid gap-5 lg:grid-cols-2">
        <Tarjeta titulo="Reglas de pago" sub="Se aplican a Pagos al personal y a Control de personal">
          <form onSubmit={(e) => { e.preventDefault(); void guardarReglas(); }} className="space-y-4" noValidate>
            <Grupo etiqueta="Modalidad de pago" ayuda={c.modalidad_pago === "destajo" ? "Se paga por lo que cada persona ejecuta × la tarifa de la actividad." : "Se paga por día trabajado × el jornal."}>
              <Segmentado etiqueta="Modalidad de pago" valor={c.modalidad_pago} onChange={(v) => set("modalidad_pago", v)} deshabilitado={!puede}
                opciones={[{ valor: "jornal", texto: "Por jornal" }, { valor: "destajo", texto: "A destajo" }]} />
            </Grupo>
            <Grupo etiqueta="Semana laboral">
              <Segmentado etiqueta="Semana laboral" valor={c.semana} onChange={(v) => set("semana", v)} deshabilitado={!puede}
                opciones={[{ valor: "LS", texto: "Lunes a sábado" }, { valor: "LV", texto: "Lunes a viernes" }]} />
            </Grupo>
            <Grupo etiqueta="Regla del domingo" ayuda={c.regla_dominical === "legal" ? "Legal: se reconoce con la semana completa trabajada (art. 173 CST)." : "Literal: se reconoce si asistió más de 5 días."}>
              <Segmentado etiqueta="Regla para reconocer el domingo" valor={c.regla_dominical} onChange={(v) => set("regla_dominical", v)} deshabilitado={!puede}
                opciones={[{ valor: "legal", texto: "Legal (CST 173)" }, { valor: "literal", texto: "Más de 5 días" }]} />
            </Grupo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Jornal base (COP)" error={errJornal && sucio ? errJornal : undefined} ayuda={!errJornal || !sucio ? `Se usa si la persona no tiene jornal propio. Mínimo legal diario: ${fmtCOP(base.jornal_minimo)}` : undefined}>
                <Input type="number" inputMode="numeric" min={1} className="num" disabled={!puede} value={c.jornal_base} onChange={(e) => set("jornal_base", Number(e.target.value))} />
              </Campo>
              <Campo etiqueta="Factor prestacional" ayuda="Multiplica el costo de mano de obra por actividad (1 = sin prestaciones; ~1,5 con prestaciones).">
                <Input type="number" inputMode="decimal" step="0.01" min={1} max={3} className="num" disabled={!puede} value={c.factor_prestacional} onChange={(e) => set("factor_prestacional", Number(e.target.value))} />
              </Campo>
            </div>
            <p className="text-xs text-suave">Parámetros legales vigentes: SMMLV {fmtCOP(base.smmlv)} · auxilio de transporte {fmtCOP(base.aux_transporte)} (los administra la plataforma).</p>
            {puede && (
              <div className="flex flex-wrap items-center gap-3">
                <Boton type="submit" icono={<Save className="size-4" aria-hidden />} cargando={guardando} disabled={!sucio}>Guardar ajustes</Boton>
                {sucio && <>
                  <Boton type="button" variante="fantasma" onClick={() => setC({ ...c, ...JSON.parse(JSON.stringify(base)), festivos_extra: c.festivos_extra })}>Descartar cambios</Boton>
                  <span className="text-sm font-medium text-alerta">Hay cambios sin guardar</span>
                </>}
              </div>
            )}
          </form>
        </Tarjeta>

        <Tarjeta titulo="Días no laborables adicionales" sub="Se tratan como festivos en asistencia, control de personal y pagos">
          {puede && (
            <div className="mb-3 flex items-end gap-2">
              <Campo className="flex-1" etiqueta="Fecha"><Input type="date" value={nuevo} onChange={(e) => setNuevo(e.target.value)} /></Campo>
              <Boton variante="secundario" icono={<CalendarPlus className="size-4" aria-hidden />} disabled={!nuevo || base.festivos_extra.includes(nuevo) || guardando}
                onClick={() => { void festivosExtra([...base.festivos_extra, nuevo].sort(), "Día agregado"); setNuevo(""); }}>Agregar</Boton>
            </div>
          )}
          {!base.festivos_extra.length ? <p className="text-sm text-suave">Ninguno. Agregue aquí un día de cierre o un puente propio de la empresa.</p> : (
            <ul className="divide-y divide-borde">
              {base.festivos_extra.map((f) => (
                <li key={f} className="flex items-center justify-between gap-2 py-1 text-sm">
                  <span className="num">{nombreDia(f).slice(0, 3)} {fechaCorta(f)}</span>
                  {puede && <BotonIcono peligro etiqueta={`Quitar ${fechaCorta(f)}`} onClick={() => festivosExtra(base.festivos_extra.filter((x) => x !== f), "Día quitado")}><Trash2 className="size-4" aria-hidden /></BotonIcono>}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>

      <Tarjeta className="mt-5" titulo={`Festivos de Colombia ${anio}`} sub="Calculados automáticamente (Ley Emiliani y Semana Santa)"
        acciones={<Select aria-label="Año" className="w-28" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>{[-1, 0, 1, 2].map((d) => <option key={d}>{Number(hoy().slice(0, 4)) + d}</option>)}</Select>}>
        <ul className="grid gap-x-6 sm:grid-cols-2">
          {fest.map((f) => (
            <li key={f.fecha} className="flex justify-between gap-2 border-b border-borde py-1.5 text-sm"><span>{f.nombre}</span><span className="num shrink-0 text-suave">{nombreDia(f.fecha).slice(0, 3)} {fechaCorta(f.fecha).slice(0, 6)}</span></li>
          ))}
        </ul>
      </Tarjeta>
    </>
  );
}
