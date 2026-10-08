/**
 * Planillas CSV para abrir en Excel. Punto y coma como separador y BOM de
 * UTF-8: es lo que espera Excel en español para separar columnas y mostrar
 * bien las tildes. Los montos van sin puntos de miles para que Excel los
 * lea como números.
 */
export type Celda = string | number | null;

/**
 * Un valor de la planilla. Los textos los escriben personas (un ítem
 * agregado a mano, el nombre de un proveedor): si empiezan con =, +, - o @,
 * Excel los tomaría como fórmula, así que van precedidos de un apóstrofo.
 */
export function celda(v: Celda): string {
  if (v === null) return '';
  let t = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function respuestaCsv(filas: Celda[][], archivo: string): Response {
  const cuerpo = '﻿' + filas.map((fila) => fila.map(celda).join(';')).join('\r\n') + '\r\n';
  return new Response(cuerpo, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${archivo}"`,
      'Cache-Control': 'no-store',
    },
  });
}
