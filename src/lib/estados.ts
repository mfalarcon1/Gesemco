/**
 * Estados del presupuesto y sus nombres para la interfaz. Módulo sin acceso a
 * la base: lo pueden importar también los componentes que corren en el
 * navegador.
 *
 *   borrador → enviado (Dirección) → revision_contabilidad → aprobado
 *   Dirección puede devolverlo; contabilidad, enviar reparos. Con reparos,
 *   el jefe corrige y lo reenvía directo a contabilidad.
 */
export type EstadoPresupuesto =
  | 'borrador' | 'enviado' | 'devuelto' | 'revision_contabilidad' | 'con_reparos' | 'aprobado';

export const NOMBRE_ESTADO: Record<EstadoPresupuesto | 'sin_iniciar', string> = {
  sin_iniciar: 'Sin iniciar',
  borrador: 'En preparación',
  enviado: 'En revisión de Dirección',
  devuelto: 'Devuelto por Dirección',
  revision_contabilidad: 'En revisión de contabilidad',
  con_reparos: 'Con reparos',
  aprobado: 'Aprobado',
};

/** Solo el jefe edita, y solo en estos estados (la base lo exige igual). */
export const esEditable = (estado: EstadoPresupuesto | null) =>
  estado === null || estado === 'borrador' || estado === 'devuelto' || estado === 'con_reparos';
