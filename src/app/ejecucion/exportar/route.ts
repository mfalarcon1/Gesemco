import { getSesion, veEjecucionColegio } from '@/lib/sesion';
import { saldosEjecucion, totalizar } from '@/lib/consultas';
import { mesesColegio, pedidos } from '@/lib/ejecucion';
import { NOMBRE_ESTADO_PEDIDO } from '@/lib/estados';
import { diaEnChile, MESES } from '@/lib/formato';
import { respuestaCsv, type Celda } from '@/lib/csv';

/**
 * La ejecución en CSV para Excel, en tres planillas:
 *   ?tipo=resumen   una fila por departamento, con su saldo y lo pagado
 *   ?tipo=meses     departamento × mes: lo planificado y lo pedido
 *   ?tipo=detalle   cada pedido, con su cuenta contable, lo presupuestado y lo pagado
 */
export async function GET(request: Request) {
  const sesion = await getSesion();
  if (!sesion || !veEjecucionColegio(sesion) || !sesion.anioEjecucion) {
    return new Response('No tienes acceso a la ejecución del colegio.', { status: 403 });
  }

  const { id: anioId, anio } = sesion.anioEjecucion;
  const tipo = new URL(request.url).searchParams.get('tipo') ?? 'resumen';

  if (tipo === 'resumen') {
    const saldos = await saldosEjecucion(sesion.colegio.id, anioId);
    const t = totalizar(saldos);
    const filas: Celda[][] = [
      ['Departamento', 'Centro de costo', 'Aprobado', 'Extensiones', 'Vigente', 'Por comprar', 'Comprado',
        'Disponible', 'Esperando a Dirección', 'Gasto real', 'Desviación'],
      ...saldos.map((s) => [
        s.departamento, s.centroCosto ?? '', s.aprobado, s.modificaciones, s.vigente, s.comprometido, s.ejecutado,
        s.disponible, s.enPendiente, s.gastoReal, s.desviacion,
      ]),
      ['Total', '', t.aprobado, t.modificaciones, t.vigente, t.comprometido, t.ejecutado, t.disponible, t.enPendiente,
        t.gastoReal, t.desviacion],
    ];
    return respuestaCsv(filas, `ejecucion-${anio}-resumen.csv`);
  }

  if (tipo === 'meses') {
    const lista = await mesesColegio(sesion.colegio.id, anioId);
    const filas: Celda[][] = [
      ['Departamento', 'Centro de costo', 'Mes', 'Planificado', 'Pedido', 'Diferencia'],
      ...lista.flatMap((d) => d.meses.map((m, i) => [
        d.departamento, d.centroCosto ?? '', MESES[i][0].toUpperCase() + MESES[i].slice(1),
        m.planificado, m.pedido, m.pedido - m.planificado,
      ])),
    ];
    return respuestaCsv(filas, `ejecucion-${anio}-mes-a-mes.csv`);
  }

  if (tipo === 'detalle') {
    const lista = await pedidos({ colegioId: sesion.colegio.id, anioId, orden: 'urgente' });
    const filas: Celda[][] = [
      ['Pedido', 'Departamento', 'Centro de costo', 'Pedido el', 'Para el', 'Ítems', 'Fuera del presupuesto',
        'Cuenta contable', 'Estado', 'Presupuestado', 'Pagado', 'Diferencia', 'Proveedor', 'Documento',
        'Fecha de compra', 'Recibido el', 'Extensión de Dirección'],
      ...lista.map((p) => [
        p.folio, p.departamento, p.centroCosto ?? '', diaEnChile(p.pedidoEn), p.necesariaPara, p.detalle,
        p.noPlanificado ? 'Sí' : 'No', p.cuenta ?? '', NOMBRE_ESTADO_PEDIDO[p.estado], p.monto, p.pagado, p.diferencia,
        p.proveedor, p.documento, p.fechaCompra, p.fechaRecepcion, p.extension,
      ]),
    ];
    return respuestaCsv(filas, `ejecucion-${anio}-detalle.csv`);
  }

  return new Response('Esa planilla no existe: usa tipo=resumen, meses o detalle.', { status: 400 });
}
