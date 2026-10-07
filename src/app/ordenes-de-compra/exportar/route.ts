import { getSesion, veOrdenesDeCompra } from '@/lib/sesion';
import { ordenDePeriodo, resumenOrdenes } from '@/lib/formulacion';
import { PERIODOS, esPeriodo } from '@/lib/periodos';

type Celda = string | number;

/**
 * Las órdenes de compra en CSV para abrir en Excel. Con `?periodo=N`, la
 * orden de ese periodo, ítem por ítem; sin periodo, el resumen de las tres
 * por departamento.
 *
 * Punto y coma como separador y BOM de UTF-8: es lo que espera Excel en
 * español para separar columnas y mostrar bien las tildes. Los montos van
 * sin puntos de miles para que Excel los lea como números.
 */
export async function GET(request: Request) {
  const sesion = await getSesion();
  if (!sesion || !veOrdenesDeCompra(sesion) || !sesion.anioFormulacion) {
    return new Response('No tienes acceso a las órdenes de compra.', { status: 403 });
  }

  const { id: anioId, anio } = sesion.anioFormulacion;
  const valor = new URL(request.url).searchParams.get('periodo');

  let filas: Celda[][];
  let archivo: string;

  if (valor !== null) {
    const n = Number(valor);
    if (!esPeriodo(n)) return new Response('Ese periodo no existe: usa 1, 2 o 3.', { status: 400 });

    const orden = await ordenDePeriodo(sesion.colegio.id, anioId, n);
    filas = [
      ['Departamento', 'Centro de costo', 'Programa', 'Ítem', 'Cantidad', 'Precio unitario', 'Total', 'Cuenta contable', 'Fuera del catálogo'],
      ...orden.departamentos.flatMap((d) => d.items.map((i) => [
        d.departamento, d.centroCosto ?? '', i.programa, i.descripcion, i.cantidad, i.precioUnitario, i.subtotal,
        i.cuenta ?? '', i.fueraCatalogo ? 'Sí' : 'No',
      ])),
      ['Total', '', '', '', '', '', orden.total, '', ''],
    ];
    archivo = `orden-de-compra-${anio}-periodo-${n}.csv`;
  } else {
    const resumen = await resumenOrdenes(sesion.colegio.id, anioId);
    filas = [
      ['Departamento', 'Centro de costo', ...PERIODOS.map((p) => `${p.nombre} (${p.meses})`), 'Total'],
      ...resumen.map((f) => [f.departamento, f.centroCosto ?? '', ...f.periodos, f.total]),
      [
        'Total', '',
        ...PERIODOS.map((_, i) => resumen.reduce((s, f) => s + f.periodos[i], 0)),
        resumen.reduce((s, f) => s + f.total, 0),
      ],
    ];
    archivo = `ordenes-de-compra-${anio}-resumen.csv`;
  }

  const cuerpo = '﻿' + filas.map((fila) => fila.map(celda).join(';')).join('\r\n') + '\r\n';

  return new Response(cuerpo, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${archivo}"`,
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * Un valor de la planilla. Los textos los escriben personas (un ítem agregado
 * a mano, el nombre de un programa): si empiezan con =, +, - o @, Excel los
 * tomaría como fórmula, así que van precedidos de un apóstrofo.
 */
function celda(v: Celda): string {
  let t = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
