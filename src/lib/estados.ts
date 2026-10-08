/**
 * Estados del presupuesto y de los pedidos, con sus nombres para la
 * interfaz. Módulo sin acceso a la base: lo pueden importar también los
 * componentes que corren en el navegador.
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

/**
 * Un pedido del jefe:
 *   emitida              cupo en el disponible: es una orden de compra, por comprar
 *   pendiente_direccion  no cupo: espera que Dirección extienda el presupuesto
 *   denegada             Dirección no lo extendió
 *   comprada             el equipo de compra lo compró; falta que el jefe confirme que llegó
 *   recibida             llegó
 *   anulada              el jefe lo anuló antes de que se comprara
 */
export type EstadoPedido =
  | 'borrador' | 'pendiente_direccion' | 'emitida' | 'denegada' | 'comprada' | 'recibida' | 'anulada';

export const NOMBRE_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  borrador: 'Borrador',
  pendiente_direccion: 'Esperando a Dirección',
  emitida: 'Por comprar',
  denegada: 'Denegado',
  comprada: 'Comprado',
  recibida: 'Recibido',
  anulada: 'Anulado',
};

/** Los pedidos que todavía piden algo a alguien: a Dirección, al equipo de compra o al jefe. */
export const enCurso = (estado: EstadoPedido) =>
  estado === 'pendiente_direccion' || estado === 'emitida' || estado === 'comprada';
