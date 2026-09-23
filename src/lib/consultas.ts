import { and, asc, desc, eq, inArray, type SQL } from 'drizzle-orm';
import {
  db, vwSaldoAsignatura, vwSaldoDepartamento,
  ordenCompra, asignatura, departamento, usuario, proveedor,
} from '@/db';
import type { Alcance } from './sesion';

export type SaldoAsignatura = {
  asignaturaId: number;
  asignatura: string;
  departamentoId: number;
  departamento: string;
  asignado: number;
  comprometido: number;
  ejecutado: number;
  disponible: number;
};

/**
 * SUM() sobre bigint devuelve numeric, y drizzle-kit tipa numeric como
 * `string | number` porque en el caso general puede exceder el número
 * seguro de JS. Nuestros montos no: el parser de src/db/index.ts ya los
 * devuelve como number en tiempo de ejecución, y este helper lo deja
 * dicho también en los tipos. Sobrevive a cada `npm run db:pull`, que
 * es justamente por lo que va acá y no en schema.ts.
 */
const num = (v: string | number | null | undefined): number =>
  typeof v === 'number' ? v : Number(v ?? 0);

export type Totales = {
  asignado: number;
  comprometido: number;
  ejecutado: number;
  disponible: number;
};

/**
 * Los cuatro números salen de vw_saldo_asignatura, no de una columna
 * guardada. Un saldo almacenado se desincroniza tarde o temprano y después
 * nadie sabe cuál es el bueno.
 */
export async function saldosPorAsignatura(alcance: Alcance, anioId: number): Promise<SaldoAsignatura[]> {
  const v = vwSaldoAsignatura;
  const filtros: SQL[] = [eq(v.anioId, anioId)];

  if (alcance.tipo === 'asignaturas') {
    if (alcance.asignaturaIds.length === 0) return [];
    filtros.push(inArray(v.asignaturaId, alcance.asignaturaIds));
  } else if (alcance.tipo === 'departamento') {
    filtros.push(eq(v.departamentoId, alcance.departamentoId));
  }

  const filas = await db
    .select({
      asignaturaId: v.asignaturaId,
      asignatura: v.asignatura,
      departamentoId: v.departamentoId,
      departamento: v.departamento,
      asignado: v.asignado,
      comprometido: v.comprometido,
      ejecutado: v.ejecutado,
      disponible: v.disponible,
    })
    .from(v)
    .where(and(...filtros))
    .orderBy(asc(v.departamentoId), asc(v.asignatura));

  return filas.map((f) => ({
    asignaturaId: f.asignaturaId ?? 0,
    asignatura: f.asignatura ?? '',
    departamentoId: f.departamentoId ?? 0,
    departamento: f.departamento ?? '',
    asignado: num(f.asignado),
    comprometido: num(f.comprometido),
    ejecutado: num(f.ejecutado),
    disponible: num(f.disponible),
  }));
}

export async function saldosPorDepartamento(anioId: number) {
  const v = vwSaldoDepartamento;
  const filas = await db
    .select({
      departamentoId: v.departamentoId,
      departamento: v.departamento,
      nivel: v.nivel,
      asignado: v.asignado,
      comprometido: v.comprometido,
      ejecutado: v.ejecutado,
      disponible: v.disponible,
    })
    .from(v)
    .where(eq(v.anioId, anioId))
    .orderBy(asc(v.departamentoId));

  return filas.map((f) => ({
    departamentoId: f.departamentoId ?? 0,
    departamento: f.departamento ?? '',
    nivel: f.nivel ?? 'basica',
    asignado: num(f.asignado),
    comprometido: num(f.comprometido),
    ejecutado: num(f.ejecutado),
    disponible: num(f.disponible),
  }));
}

export function totalizar(filas: { asignado: number; comprometido: number; ejecutado: number; disponible: number }[]): Totales {
  return filas.reduce<Totales>(
    (t, f) => ({
      asignado: t.asignado + f.asignado,
      comprometido: t.comprometido + f.comprometido,
      ejecutado: t.ejecutado + f.ejecutado,
      disponible: t.disponible + f.disponible,
    }),
    { asignado: 0, comprometido: 0, ejecutado: 0, disponible: 0 },
  );
}

export async function ultimasOrdenes(alcance: Alcance, anioId: number, limite = 12) {
  const filtros: SQL[] = [eq(ordenCompra.anioId, anioId)];

  if (alcance.tipo === 'asignaturas') {
    if (alcance.asignaturaIds.length === 0) return [];
    filtros.push(inArray(ordenCompra.asignaturaId, alcance.asignaturaIds));
  } else if (alcance.tipo === 'departamento') {
    filtros.push(eq(asignatura.departamentoId, alcance.departamentoId));
  }

  return db
    .select({
      id: ordenCompra.id,
      folio: ordenCompra.folio,
      fechaSolicitud: ordenCompra.fechaSolicitud,
      montoTotal: ordenCompra.montoTotal,
      estado: ordenCompra.estado,
      justificacion: ordenCompra.justificacion,
      asignatura: asignatura.nombre,
      departamento: departamento.nombre,
      solicitante: usuario.nombre,
      proveedor: proveedor.razonSocial,
    })
    .from(ordenCompra)
    .innerJoin(asignatura, eq(asignatura.id, ordenCompra.asignaturaId))
    .innerJoin(departamento, eq(departamento.id, asignatura.departamentoId))
    .innerJoin(usuario, eq(usuario.id, ordenCompra.solicitanteId))
    .leftJoin(proveedor, eq(proveedor.id, ordenCompra.proveedorId))
    .where(and(...filtros))
    .orderBy(desc(ordenCompra.fechaSolicitud), desc(ordenCompra.id))
    .limit(limite);
}
