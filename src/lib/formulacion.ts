import { and, asc, eq, inArray } from 'drizzle-orm';
import {
  db, vwPresupuestoDepartamento, vwProyeccionPeriodo, vwOrdenPeriodo,
  programa, lineaPresupuesto, cuentaContable,
} from '@/db';
import { num } from './consultas';
import type { EstadoPresupuesto } from './estados';
import { PERIODOS, esPeriodo, type NumeroPeriodo } from './periodos';

export { NOMBRE_ESTADO, esEditable, type EstadoPresupuesto } from './estados';

export type ResumenPresupuesto = {
  departamentoId: number;
  departamento: string;
  centroCosto: string | null;
  anioId: number;
  anio: number;
  formulacionHasta: string | null;
  presupuestoId: number | null;
  estado: EstadoPresupuesto | null;
  /** Último envío del jefe: a Dirección o, después de reparos, a contabilidad. */
  enviadoEn: string | null;
  resueltoDireccionEn: string | null;
  comentarioDireccion: string | null;
  resueltoContabilidadEn: string | null;
  comentarioContabilidad: string | null;
  /** Solo en revisión de contabilidad: desde cuándo lo tiene. */
  enContabilidadDesde: string | null;
  programas: number;
  lineas: number;
  formulado: number;
  fueraCatalogo: number;
  montoAprobado: number | null;
  modificaciones: number;
  vigente: number;
};

const v = vwPresupuestoDepartamento;

function aResumen(f: typeof v.$inferSelect): ResumenPresupuesto {
  return {
    departamentoId: f.departamentoId ?? 0,
    departamento: f.departamento ?? '',
    centroCosto: f.centroCosto,
    anioId: f.anioId ?? 0,
    anio: f.anio ?? 0,
    formulacionHasta: f.formulacionHasta,
    presupuestoId: f.presupuestoId,
    estado: f.estado,
    enviadoEn: f.enviadoEn,
    resueltoDireccionEn: f.resueltoDireccionEn,
    comentarioDireccion: f.comentarioDireccion,
    resueltoContabilidadEn: f.resueltoContabilidadEn,
    comentarioContabilidad: f.comentarioContabilidad,
    enContabilidadDesde: f.enContabilidadDesde,
    programas: num(f.programas),
    lineas: num(f.lineas),
    formulado: num(f.formulado),
    fueraCatalogo: num(f.fueraCatalogo),
    montoAprobado: f.montoAprobado === null ? null : num(f.montoAprobado),
    modificaciones: num(f.modificaciones),
    vigente: num(f.vigente),
  };
}

/** Estado de la formulación de todos los departamentos del colegio en un año. */
export async function resumenFormulacion(colegioId: number, anioId: number): Promise<ResumenPresupuesto[]> {
  const filas = await db.select().from(v)
    .where(and(eq(v.colegioId, colegioId), eq(v.anioId, anioId)))
    .orderBy(asc(v.departamentoId));
  return filas.map(aResumen);
}

export async function resumenDepartamento(departamentoId: number, anioId: number): Promise<ResumenPresupuesto | null> {
  const [f] = await db.select().from(v)
    .where(and(eq(v.departamentoId, departamentoId), eq(v.anioId, anioId)));
  return f ? aResumen(f) : null;
}

export type Linea = {
  id: number;
  articuloId: number | null;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  fueraCatalogo: boolean;
  origenPrecio: string | null;
  cuenta: string | null;
};

export type ProgramaConLineas = {
  id: number;
  periodo: NumeroPeriodo;
  nombre: string;
  descripcion: string | null;
  total: number;
  lineas: Linea[];
};

/** Los programas del presupuesto con sus ítems, ordenados por periodo. */
export async function programasConLineas(presupuestoId: number): Promise<ProgramaConLineas[]> {
  const programas = await db
    .select({ id: programa.id, periodo: programa.periodo, nombre: programa.nombre, descripcion: programa.descripcion })
    .from(programa)
    .where(eq(programa.presupuestoId, presupuestoId))
    .orderBy(asc(programa.periodo), asc(programa.creadoEn), asc(programa.id));

  if (programas.length === 0) return [];

  const lineas = await db
    .select({
      id: lineaPresupuesto.id,
      programaId: lineaPresupuesto.programaId,
      articuloId: lineaPresupuesto.articuloId,
      descripcion: lineaPresupuesto.descripcion,
      cantidad: lineaPresupuesto.cantidad,
      precioUnitario: lineaPresupuesto.precioUnitario,
      subtotal: lineaPresupuesto.subtotal,
      fueraCatalogo: lineaPresupuesto.fueraCatalogo,
      origenPrecio: lineaPresupuesto.origenPrecio,
      cuentaCodigo: cuentaContable.codigo,
      cuentaNombre: cuentaContable.nombre,
    })
    .from(lineaPresupuesto)
    .leftJoin(cuentaContable, eq(cuentaContable.id, lineaPresupuesto.cuentaContableId))
    .where(inArray(lineaPresupuesto.programaId, programas.map((p) => p.id)))
    .orderBy(asc(lineaPresupuesto.creadoEn), asc(lineaPresupuesto.id));

  return programas.map((p) => {
    const propias: Linea[] = lineas
      .filter((l) => l.programaId === p.id)
      .map((l) => ({
        id: l.id,
        articuloId: l.articuloId,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
        subtotal: num(l.subtotal),
        fueraCatalogo: Boolean(l.fueraCatalogo),
        origenPrecio: l.origenPrecio,
        cuenta: l.cuentaCodigo ? `${l.cuentaCodigo} ${l.cuentaNombre}` : null,
      }));
    return {
      ...p,
      periodo: esPeriodo(p.periodo) ? p.periodo : 1,
      total: propias.reduce((s, l) => s + l.subtotal, 0),
      lineas: propias,
    };
  });
}

/** Monto de cada periodo; el índice 0 es el periodo 1. */
export type PorPeriodo = [number, number, number];

export function sumarPorPeriodo(programas: ProgramaConLineas[]): PorPeriodo {
  const suma: PorPeriodo = [0, 0, 0];
  for (const p of programas) suma[p.periodo - 1] += p.total;
  return suma;
}

/** Lo que pide un presupuesto en cada periodo, en cualquier estado. */
export async function montosPorPeriodo(presupuestoId: number): Promise<PorPeriodo> {
  const filas = await db
    .select({ periodo: vwProyeccionPeriodo.periodo, monto: vwProyeccionPeriodo.monto })
    .from(vwProyeccionPeriodo)
    .where(eq(vwProyeccionPeriodo.presupuestoId, presupuestoId));
  const suma: PorPeriodo = [0, 0, 0];
  for (const f of filas) if (esPeriodo(f.periodo)) suma[f.periodo - 1] += num(f.monto);
  return suma;
}

export type FilaPeriodos = {
  departamentoId: number;
  departamento: string;
  centroCosto: string | null;
  periodos: PorPeriodo;
  total: number;
};

/**
 * Cuánto pide en cada periodo cada departamento aprobado por contabilidad:
 * el resumen de las tres órdenes de compra. Lo no aprobado no entra, porque
 * todavía puede cambiar entero.
 */
export async function resumenOrdenes(colegioId: number, anioId: number): Promise<FilaPeriodos[]> {
  const aprobados = (await resumenFormulacion(colegioId, anioId)).filter((r) => r.estado === 'aprobado');
  if (aprobados.length === 0) return [];

  const filas = await db
    .select({ presupuestoId: vwProyeccionPeriodo.presupuestoId, periodo: vwProyeccionPeriodo.periodo, monto: vwProyeccionPeriodo.monto })
    .from(vwProyeccionPeriodo)
    .where(inArray(vwProyeccionPeriodo.presupuestoId, aprobados.map((a) => a.presupuestoId!)));

  return aprobados.map((a) => {
    const periodos: PorPeriodo = [0, 0, 0];
    for (const f of filas) {
      if (f.presupuestoId === a.presupuestoId && esPeriodo(f.periodo)) periodos[f.periodo - 1] += num(f.monto);
    }
    return {
      departamentoId: a.departamentoId,
      departamento: a.departamento,
      centroCosto: a.centroCosto,
      periodos,
      total: periodos[0] + periodos[1] + periodos[2],
    };
  });
}

export type ItemOrden = {
  lineaId: number;
  programa: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  fueraCatalogo: boolean;
  cuenta: string | null;
};

export type DepartamentoEnOrden = {
  departamentoId: number;
  departamento: string;
  centroCosto: string | null;
  total: number;
  items: ItemOrden[];
};

export type OrdenDeCompra = { periodo: NumeroPeriodo; total: number; items: number; departamentos: DepartamentoEnOrden[] };

/**
 * La orden de compra de un periodo: los ítems de todos los presupuestos
 * aprobados, del colegio completo y separados por departamento.
 */
export async function ordenDePeriodo(colegioId: number, anioId: number, periodo: NumeroPeriodo): Promise<OrdenDeCompra> {
  const o = vwOrdenPeriodo;
  const filas = await db.select().from(o)
    .where(and(eq(o.colegioId, colegioId), eq(o.anioId, anioId), eq(o.periodo, periodo)))
    .orderBy(asc(o.departamentoId), asc(o.programaId), asc(o.lineaId));

  const departamentos: DepartamentoEnOrden[] = [];
  for (const f of filas) {
    let d = departamentos.find((x) => x.departamentoId === f.departamentoId);
    if (!d) {
      d = { departamentoId: f.departamentoId ?? 0, departamento: f.departamento ?? '', centroCosto: f.centroCosto, total: 0, items: [] };
      departamentos.push(d);
    }
    const subtotal = num(f.subtotal);
    d.total += subtotal;
    d.items.push({
      lineaId: f.lineaId ?? 0,
      programa: f.programa ?? '',
      descripcion: f.descripcion ?? '',
      cantidad: f.cantidad ?? 0,
      precioUnitario: f.precioUnitario ?? 0,
      subtotal,
      fueraCatalogo: Boolean(f.fueraCatalogo),
      cuenta: f.cuentaCodigo ? `${f.cuentaCodigo} ${f.cuentaNombre}` : null,
    });
  }

  return {
    periodo,
    total: departamentos.reduce((s, d) => s + d.total, 0),
    items: filas.length,
    departamentos,
  };
}

/** Las tres órdenes del año, una por periodo. */
export async function ordenesDelAnio(colegioId: number, anioId: number): Promise<OrdenDeCompra[]> {
  return Promise.all(PERIODOS.map((p) => ordenDePeriodo(colegioId, anioId, p.numero)));
}

export async function cuentasContables() {
  return db
    .select({ id: cuentaContable.id, codigo: cuentaContable.codigo, nombre: cuentaContable.nombre })
    .from(cuentaContable)
    .where(eq(cuentaContable.activa, true))
    .orderBy(asc(cuentaContable.codigo));
}
