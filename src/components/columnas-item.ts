/**
 * Columnas de la lista de ítems de un programa, compartidas por el encabezado
 * de la lista (componente de servidor) y cada fila (componente de cliente).
 * En celular la fila es una tarjeta; desde md, una grilla alineada.
 *
 * - editable: el jefe arma su presupuesto (última columna: Editar y Quitar).
 * - meses: presupuesto aprobado (última columna: los meses de cada ítem).
 * - lectura: nadie edita y todavía no hay meses.
 */
export type ModoItem = 'editable' | 'meses' | 'lectura';

export const COLUMNAS_ITEM: Record<ModoItem, string> = {
  editable: 'md:grid-cols-[minmax(0,1fr)_6rem_8rem_8.5rem_12rem]',
  meses: 'md:grid-cols-[minmax(0,1fr)_6rem_8rem_8.5rem_15rem]',
  lectura: 'md:grid-cols-[minmax(0,1fr)_6rem_8rem_8.5rem]',
};
