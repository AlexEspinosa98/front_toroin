export type Marca = {
  slug: string; nombre: string; nombre_app: string; color_primario: string; color_secundario: string;
  logo_claro: string | null; logo_oscuro: string | null; icono: string | null; pie: string;
};
export type EstadoLic = "prueba" | "activa" | "por_vencer" | "gracia" | "vencida" | "suspendida" | "cancelada" | "sin_licencia";
export type Me = {
  id: string; nombre: string; correo: string; rol: string; debe_cambiar_password: boolean;
  suplantando: boolean; solo_lectura: boolean; ambito: "plataforma" | "empresa";
  empresa: Marca | null;
  licencia: { estado: EstadoLic; mensaje: string; fin: string | null; dias_restantes: number | null; escritura: boolean; limites: Record<string, number | null> } | null;
  modulos: string[];
};
export type ResumenEmpresa = {
  id: string; slug: string; nombre: string; nit: string; pais: string; estado_cuenta: string;
  licencia_estado: EstadoLic; tipo: string | null; plan: string | null; fin: string | null; dias_restantes: number | null;
  modulos: string[]; logo_claro: string | null; color_primario: string; creado: string;
};
export type ModuloCatalogo = { clave: string; nombre: string; descripcion: string; requiere: string[]; nucleo: boolean; disponible: boolean; subfunciones: string[] };
export type Plan = { id: string; clave: string; nombre: string; descripcion: string; modulos: string[]; limites: Record<string, number | null>; precio_ref: number; activo: boolean };
export type LicenciaOut = {
  id: string; numero: number; plan: string | null; plan_clave: string | null; tipo: string; inicio: string; fin: string | null;
  gracia_dias: number; suspendida: boolean; cancelada: boolean; limites: Record<string, number | null>; notas: string; creado: string;
};
export type ModuloEmpresa = ModuloCatalogo & { en_plan: boolean; control: { activo: boolean; inicio: string | null; fin: string | null } | null; activo: boolean };
export type DetalleEmpresa = {
  id: string; slug: string; nombre: string; nit: string; pais: string; moneda: string; zona_horaria: string; estado_cuenta: string;
  notas_internas: string; creado: string;
  marca: Omit<Marca, "slug" | "nombre">;
  licencia: Partial<LicenciaOut> & { estado?: EstadoLic; mensaje?: string; dias_restantes?: number | null; limites_efectivos?: Record<string, number | null> };
  historial: LicenciaOut[]; modulos: ModuloEmpresa[];
  uso: { usuarios: number; obras: number; trabajadores: number };
  usuarios: { id: string; nombre: string; correo: string; rol: string; activo: boolean; ultimo_acceso: string | null }[];
};
export type Auditoria = { id: string; fecha: string; usuario: string; accion: string; entidad: string; entidad_id: string; detalle: Record<string, unknown>; empresa_id: string | null; ip: string };

// ---- Contrato y bitácora ----
export type Semaforo = "al-dia" | "atencion" | "atrasada" | "sin-contrato";
export type ResumenObraT = { semaforo: Semaforo; valor_contrato: number; valor_ejecutado: number; avance_fisico: number; avance_tiempo: number; dias_restantes: number; indice: number };
export type ActividadT = {
  id: string; item: string; grupo: number; capitulo: string; nombre: string; ubicacion: string; um: string; cantidad: number;
  valor_unitario: number; valor_total: number; tarifa: number | null; advertencias: string[]; ejecutado: number; pendiente: number;
  /** Subítems: el ítem del contrato partido en las unidades con que la empresa le paga al trabajador. */
  padre_id: string; equivale: number; aporta_avance: boolean; subitems: number; registrable: boolean;
  /** Otrosí que trajo el ítem; vacío si viene del contrato original. */
  otrosi_id: string; otrosi: string;
  /** Solo en subítems */
  padre?: string; um_item?: string; aporte?: number; ingreso?: number;
};
export type ContratoT = { numero: string; contratante: string; nit_contratante: string; contratista: string; proyecto: string; descripcion: string; tipo: string; fecha_inicio: string; fecha_fin: string; fecha_fin_base: string | null; valor_total: number; valor_base: number; valor_antes_aiu: number; aiu: number; pct_rete_garantia: number; rete_garantia: number; valor_neto: number; forma_pago: string; pagos: { fecha: string; valor: number; concepto: string }[]; advertencias: string[]; archivo: string };
export type DatosObra = { obra: { id: string; nombre: string; ciudad: string; ingresos_proyectados: number | null }; contrato: ContratoT | null; actividades: ActividadT[]; resumen: ResumenObraT };
/** Otrosí: adición de valor, prórroga de plazo e ítems nuevos del contrato. */
export type ItemOtrosiT = { id: string; item: string; grupo: number; capitulo: string; nombre: string; ubicacion: string; um: string; cantidad: number; valor_unitario: number; valor_total: number; tarifa: number | null; advertencias: string[] };
export type OtrosiT = {
  id: string; numero: string; fecha: string; descripcion: string; valor_adicion: number; fecha_fin_nueva: string | null;
  archivo_nombre: string; archivo_bytes: number; tiene_pdf: boolean; creado: string; creado_por: string;
  items: number; valor_items: number; cuadra: boolean; actividades: ItemOtrosiT[];
};
export type DatosOtrosies = {
  obra: { id: string; nombre: string }; tiene_contrato: boolean;
  contrato: { numero: string; contratante: string; fecha_inicio: string } | null;
  valor_base: number; adiciones: number; valor_vigente: number;
  fecha_fin_base: string | null; fecha_fin_vigente: string | null; dias_prorroga: number; otrosies: OtrosiT[];
};

/** Cortes de pago congelados y préstamos del trabajador. */
export type PrestamoT = {
  id: string; trabajador_id: string; trabajador: string; fecha: string; concepto: string;
  valor: number; cuota: number; saldo: number; activo: boolean; notas: string; pagado: boolean; creado: string; creado_por: string;
};
export type SemanaCorteT = { domingo: string; laborables: number; asistidos: number; reconocido: boolean; razon: string };
export type TrabajoCorteT = { fecha: string; actividad: string; ubicacion: string; um: string; parte: number; tarifa: number; valor: number; pagado: boolean };
export type DetalleCorteT = {
  jornal: number; dias_jornal: number; dias_destajo: number; basico: number; basico_jornal: number; descansos: number;
  promedio_diario: number; ajuste_minimo: number; sin_tarifa: number; semanas: SemanaCorteT[];
  ausencias_justificadas: number; ausencias_injustificadas: number; trabajos: TrabajoCorteT[];
};
export type FilaCorteT = {
  id: string; trabajador_id: string; nombre: string; cedula: string; cargo: string; modalidad: string;
  dias_asistidos: number; dias_descanso: number; devengado: number; auxilio: number; salud: number; pension: number;
  prestamo: number; otras: number; neto: number; nota: string; detalle: DetalleCorteT;
};
export type TotalesCorteT = { devengado: number; auxilio: number; salud: number; pension: number; prestamo: number; otras: number; neto: number; personas: number };
export type CorteT = {
  id: string; obra_id: string; obra: string; desde: string; hasta: string; dias: number;
  estado: "abierto" | "cerrado"; notas: string; totales: TotalesCorteT; creado: string; creado_por: string;
  cerrado_en: string | null; cerrado_por: string; filas?: FilaCorteT[]; avisos?: string[];
};

export type RegistroT = { id: string; obra_id: string; fecha: string; actividad_id: string; cantidad: number; personas: number; trabajadores: string[]; por_trabajador: Record<string, number>; horas_atraso: number; motivo_atraso: string | null; acciones: string; observaciones: string; fotos: string[]; creado: string };

export type Alerta = { tipo: string; severidad: "alta" | "media" | "baja"; titulo: string; detalle: string; href: string };
