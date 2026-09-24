import { getSesion, veProyeccion } from '@/lib/sesion';
import { proyeccionColegio } from '@/lib/formulacion';
import { MESES } from '@/lib/formato';

/**
 * La proyección mensual en CSV para abrir en Excel. Con punto y coma como
 * separador y BOM de UTF-8, que es lo que espera Excel en español para
 * separar columnas y mostrar bien las tildes. Los montos van sin puntos de
 * miles para que Excel los lea como números.
 */
export async function GET() {
  const sesion = await getSesion();
  if (!sesion || !veProyeccion(sesion) || !sesion.anioFormulacion) {
    return new Response('No tienes acceso a la proyección mensual.', { status: 403 });
  }

  const { id: anioId, anio } = sesion.anioFormulacion;
  const filas = await proyeccionColegio(sesion.colegio.id, anioId);

  const campo = (v: string | number) => {
    const t = String(v);
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };

  const encabezado = ['Departamento', 'Centro de costo', ...MESES.map((m) => m[0].toUpperCase() + m.slice(1)), 'Sin mes', 'Total'];
  const lineas = [
    encabezado,
    ...filas.map((f) => [f.departamento, f.centroCosto ?? '', ...f.meses, f.sinMes, f.total]),
    [
      'Total',
      '',
      ...Array.from({ length: 12 }, (_, i) => filas.reduce((s, f) => s + f.meses[i], 0)),
      filas.reduce((s, f) => s + f.sinMes, 0),
      filas.reduce((s, f) => s + f.total, 0),
    ],
  ].map((fila) => fila.map(campo).join(';'));

  const cuerpo = '\uFEFF' + lineas.join('\r\n') + '\r\n';

  return new Response(cuerpo, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="proyeccion-mensual-${anio}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
