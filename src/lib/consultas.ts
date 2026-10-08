import { and, asc, desc, eq, inArray, type SQL } from 'drizzle-orm';
import { db, vwSaldoDepartamento, notificacion } from '@/db';

/**
 * SUM() sobre bigint devuelve numeric, y drizzle-kit tipa numeric como
 * `string | number` porque en el caso general puede exceder el número
 * seguro de JS. Nuestros montos no: el parser de src/db/index.ts ya los
 * devuelve como number en tiempo de ejecución, y este helper lo deja dicho
 * también en los tipos. Sobrevive a cada `npm run db:pull`, que es
 * justamente por lo que va acá y no en schema.ts.
 */
export const num = (v: string | number | null | undefined): number =>
  typeof v === 'number' ? v : Number(v ?? 0);

export type SaldoDepartamento = {
  departamentoId: number;
  departamento: string;
  centroCosto: string | null;
  aprobado: number;
  modificaciones: number;
  vigente: number;
  comprometido: number;
  ejecutado: number;
  disponible: number;
  enPendiente: number;
  pendientes: number;
  gastoReal: number;
  desviacion: number;
};

/**
 * El saldo de la ejecución por departamento, siempre a precio presupuesto.
 * Sale de vw_saldo_departamento: nunca de una columna guardada.
 */
export async function saldosEjecucion(
  colegioId: number, anioId: number, departamentoIds?: number[],
): Promise<SaldoDepartamento[]> {
  const v = vwSaldoDepartamento;
  const filtros: SQL[] = [eq(v.colegioId, colegioId), eq(v.anioId, anioId)];
  if (departamentoIds) {
    if (departamentoIds.length === 0) return [];
    filtros.push(inArray(v.departamentoId, departamentoIds));
  }

  const filas = await db.select().from(v).where(and(...filtros)).orderBy(asc(v.departamentoId));

  return filas.map((f) => ({
    departamentoId: f.departamentoId ?? 0,
    departamento: f.departamento ?? '',
    centroCosto: f.centroCosto,
    aprobado: num(f.aprobado),
    modificaciones: num(f.modificaciones),
    vigente: num(f.vigente),
    comprometido: num(f.comprometido),
    ejecutado: num(f.ejecutado),
    disponible: num(f.disponible),
    enPendiente: num(f.enPendiente),
    pendientes: num(f.pendientes),
    gastoReal: num(f.gastoReal),
    desviacion: num(f.desviacion),
  }));
}

export type Totales = Omit<SaldoDepartamento, 'departamentoId' | 'departamento' | 'centroCosto'>;

export function totalizar(filas: SaldoDepartamento[]): Totales {
  const cero: Totales = {
    aprobado: 0, modificaciones: 0, vigente: 0, comprometido: 0, ejecutado: 0,
    disponible: 0, enPendiente: 0, pendientes: 0, gastoReal: 0, desviacion: 0,
  };
  return filas.reduce<Totales>((t, f) => {
    const suma = { ...t };
    for (const k of Object.keys(cero) as (keyof Totales)[]) suma[k] = t[k] + f[k];
    return suma;
  }, cero);
}

export async function notificacionesRecientes(usuarioId: number, limite = 6) {
  return db
    .select({
      id: notificacion.id,
      titulo: notificacion.titulo,
      mensaje: notificacion.mensaje,
      enlace: notificacion.enlace,
      leida: notificacion.leida,
      creadaEn: notificacion.creadaEn,
    })
    .from(notificacion)
    .where(eq(notificacion.usuarioId, usuarioId))
    .orderBy(desc(notificacion.creadaEn), desc(notificacion.id))
    .limit(limite);
}
