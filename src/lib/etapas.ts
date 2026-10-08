import type { Paso } from '@/components/pasos';
import { fecha } from './formato';
import type { ResumenPresupuesto } from './formulacion';

/**
 * Las tres etapas de un presupuesto, con el estado de cada una en palabras.
 * Se muestran igual en el inicio del jefe y en su presupuesto, para que
 * siempre sepa dónde va y qué sigue.
 */
export function pasosDe(r: ResumenPresupuesto): Paso[] {
  const e = r.estado;
  const aprobadoPorDireccion = e === 'revision_contabilidad' || e === 'con_reparos' || e === 'aprobado';

  const armar: Paso = e === 'enviado' || e === 'revision_contabilidad' || e === 'aprobado'
    ? { titulo: 'Armar el presupuesto', detalle: 'Listo', estado: 'hecho' }
    : {
      titulo: 'Armar el presupuesto',
      detalle: e === 'devuelto' ? 'Ahora: ajustar lo que pidió Dirección'
        : e === 'con_reparos' ? 'Ahora: corregir los reparos de contabilidad'
          : 'Ahora: programas, ítems y sus meses',
      estado: 'actual',
    };

  const direccion: Paso = aprobadoPorDireccion
    ? { titulo: 'Revisión de Dirección', detalle: `Aprobado el ${fecha(r.resueltoDireccionEn)}`, estado: 'hecho' }
    : e === 'enviado'
      ? { titulo: 'Revisión de Dirección', detalle: `En revisión desde el ${fecha(r.enviadoEn)}`, estado: 'actual' }
      : { titulo: 'Revisión de Dirección', detalle: 'Después: se aprueba o se devuelve', estado: 'pendiente' };

  const contabilidad: Paso = e === 'aprobado'
    ? { titulo: 'Revisión de contabilidad', detalle: `Aprobado el ${fecha(r.resueltoContabilidadEn)}`, estado: 'hecho' }
    : e === 'revision_contabilidad'
      ? { titulo: 'Revisión de contabilidad', detalle: `En revisión desde el ${fecha(r.enContabilidadDesde)}`, estado: 'actual' }
      : e === 'con_reparos'
        ? { titulo: 'Revisión de contabilidad', detalle: 'Después: vuelve directo a contabilidad', estado: 'pendiente' }
        : { titulo: 'Revisión de contabilidad', detalle: 'Después: se aprueba o se envían reparos', estado: 'pendiente' };

  return [armar, direccion, contabilidad];
}

/**
 * Lo último que pasó con el presupuesto, en una frase, para las listas de
 * Dirección y contabilidad. Los comentarios se conservan al reenviar: si un
 * presupuesto en revisión de Dirección tiene comentario de Dirección, fue
 * devuelto y reenviado; si uno en revisión de contabilidad tiene comentario
 * de contabilidad, volvió después de reparos (una vez que Dirección lo
 * aprueba, ya no regresa a ella).
 */
export function ultimaNovedad(r: ResumenPresupuesto): string {
  switch (r.estado) {
    case null: return 'Todavía no empieza';
    case 'borrador':
      return r.lineasSinMes > 0
        ? `En preparación · ${r.lineasSinMes === 1 ? 'a 1 ítem le faltan' : `a ${r.lineasSinMes} ítems les faltan`} meses`
        : 'En preparación';
    case 'enviado':
      return `${r.comentarioDireccion ? 'Reenviado' : 'Enviado'} a Dirección el ${fecha(r.enviadoEn)}`;
    case 'devuelto': return `Devuelto por Dirección el ${fecha(r.resueltoDireccionEn)}`;
    case 'revision_contabilidad':
      return r.comentarioContabilidad
        ? `Reenviado con los reparos corregidos el ${fecha(r.enviadoEn)}`
        : `Aprobado por Dirección el ${fecha(r.resueltoDireccionEn)}`;
    case 'con_reparos': return `Reparos enviados el ${fecha(r.resueltoContabilidadEn)}`;
    case 'aprobado': return `Aprobado por contabilidad el ${fecha(r.resueltoContabilidadEn)}`;
  }
}

/** Si el presupuesto espera algo de esta persona: Dirección o contabilidad. */
export function esperaRevision(r: ResumenPresupuesto, roles: { direccion: boolean; contabilidad: boolean }): boolean {
  return (roles.direccion && r.estado === 'enviado') || (roles.contabilidad && r.estado === 'revision_contabilidad');
}
