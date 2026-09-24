/**
 * Estados del presupuesto y sus nombres para la interfaz. Módulo sin acceso a
 * la base: lo pueden importar también los componentes que corren en el
 * navegador.
 */
export type EstadoPresupuesto = 'borrador' | 'enviado' | 'devuelto' | 'aprobado';

export const NOMBRE_ESTADO: Record<EstadoPresupuesto | 'sin_iniciar', string> = {
  sin_iniciar: 'Sin iniciar',
  borrador: 'En preparación',
  enviado: 'En revisión',
  devuelto: 'Devuelto',
  aprobado: 'Aprobado',
};

/** Solo el jefe edita, y solo en estos estados (la base lo exige igual). */
export const esEditable = (estado: EstadoPresupuesto | null) =>
  estado === null || estado === 'borrador' || estado === 'devuelto';
