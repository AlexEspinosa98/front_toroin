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
