import { getSesion, veProyeccion } from '@/lib/sesion';
import { proyeccionColegio } from '@/lib/formulacion';
import { MESES } from '@/lib/formato';
import { respuestaCsv } from '@/lib/csv';

/**
 * La proyección mensual en CSV: una fila por departamento aprobado, con su
 * centro de costo, los doce meses y el total.
 */
export async function GET() {
  const sesion = await getSesion();
  if (!sesion || !veProyeccion(sesion) || !sesion.anioFormulacion) {
    return new Response('No tienes acceso a la proyección mensual.', { status: 403 });
  }

  const { id: anioId, anio } = sesion.anioFormulacion;
  const filas = await proyeccionColegio(sesion.colegio.id, anioId);

  return respuestaCsv([
    ['Departamento', 'Centro de costo', ...MESES.map((m) => m[0].toUpperCase() + m.slice(1)), 'Total'],
    ...filas.map((f) => [f.departamento, f.centroCosto ?? '', ...f.meses, f.total]),
    [
      'Total', '',
      ...Array.from({ length: 12 }, (_, i) => filas.reduce((s, f) => s + f.meses[i], 0)),
      filas.reduce((s, f) => s + f.total, 0),
    ],
  ], `proyeccion-mensual-${anio}.csv`);
}
