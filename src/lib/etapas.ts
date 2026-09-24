import type { Paso } from '@/components/pasos';
import { fecha } from './formato';
import type { ResumenPresupuesto } from './formulacion';

/** Cuántos ítems de un presupuesto ya tienen todos sus meses. */
export type Avance = { listos: number; total: number };

/**
 * Las tres etapas de un presupuesto, con el estado de cada una en palabras.
 * Se muestran igual en el inicio del jefe y en su presupuesto, para que
 * siempre sepa dónde va y qué sigue.
 */
export function pasosDe(r: ResumenPresupuesto, avance: Avance): Paso[] {
  const e = r.estado;
  const mesesListos = avance.total > 0 && avance.listos === avance.total;

  const armar: Paso = e === 'enviado' || e === 'aprobado'
    ? { titulo: 'Armar el presupuesto', detalle: 'Listo', estado: 'hecho' }
    : {
      titulo: 'Armar el presupuesto',
      detalle: e === 'devuelto' ? 'Ahora: ajustar lo que pidió Dirección' : 'Ahora: programas y lo que necesita cada uno',
      estado: 'actual',
    };

  const revision: Paso = e === 'aprobado'
    ? { titulo: 'Revisión de Dirección', detalle: `Aprobado el ${fecha(r.resueltoEn)}`, estado: 'hecho' }
    : e === 'enviado'
      ? { titulo: 'Revisión de Dirección', detalle: `En revisión desde el ${fecha(r.enviadoEn)}`, estado: 'actual' }
      : { titulo: 'Revisión de Dirección', detalle: 'Después: se aprueba o se devuelve', estado: 'pendiente' };

  const meses: Paso = e !== 'aprobado'
    ? { titulo: 'Meses de cada compra', detalle: 'Después: cuándo se necesita cada cosa', estado: 'pendiente' }
    : mesesListos
      ? { titulo: 'Meses de cada compra', detalle: 'Listo: todo tiene sus meses', estado: 'hecho' }
      : { titulo: 'Meses de cada compra', detalle: `Ahora: ${avance.listos} de ${avance.total} ítems listos`, estado: 'actual' };

  return [armar, revision, meses];
}
