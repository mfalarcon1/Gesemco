import { and, asc, eq, inArray } from 'drizzle-orm';
import {
  db, vwPresupuestoDepartamento, vwMesDepartamento, vwCalendarizacionLinea,
  programa, lineaPresupuesto, lineaCalendario, cuentaContable,
} from '@/db';
import { num } from './consultas';
import type { EstadoPresupuesto } from './estados';

export { NOMBRE_ESTADO, esEditable, type EstadoPresupuesto } from './estados';

export type ResumenPresupuesto = {
  departamentoId: number;
  departamento: string;
  centroCosto: string | null;
  anioId: number;
  anio: number;
  formulacionHasta: string | null;
  aprobacionHasta: string | null;
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
  /** Ítems a los que les faltan meses: con alguno no se puede enviar. */
  lineasSinMes: number;
  montoSinMes: number;
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
    aprobacionHasta: f.aprobacionHasta,
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
    lineasSinMes: num(f.lineasSinMes),
    montoSinMes: num(f.montoSinMes),
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

/** Cuántas unidades de una línea se usarán en un mes (1 = enero). */
export type MesLinea = { mes: number; cantidad: number };

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
  meses: MesLinea[];
  cantidadSinMes: number;
};

export type ProgramaConLineas = {
  id: number;
  nombre: string;
  descripcion: string | null;
  total: number;
  lineas: Linea[];
};

/** Los programas del presupuesto con sus ítems y los meses de cada uno. */
export async function programasConLineas(presupuestoId: number): Promise<ProgramaConLineas[]> {
  const programas = await db
    .select({ id: programa.id, nombre: programa.nombre, descripcion: programa.descripcion })
    .from(programa)
    .where(eq(programa.presupuestoId, presupuestoId))
    .orderBy(asc(programa.creadoEn), asc(programa.id));

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
      cantidadSinMes: vwCalendarizacionLinea.cantidadSinMes,
    })
    .from(lineaPresupuesto)
    .leftJoin(cuentaContable, eq(cuentaContable.id, lineaPresupuesto.cuentaContableId))
    .leftJoin(vwCalendarizacionLinea, eq(vwCalendarizacionLinea.lineaId, lineaPresupuesto.id))
    .where(inArray(lineaPresupuesto.programaId, programas.map((p) => p.id)))
    .orderBy(asc(lineaPresupuesto.creadoEn), asc(lineaPresupuesto.id));

  const meses = lineas.length === 0 ? [] : await db
    .select({ lineaId: lineaCalendario.lineaId, mes: lineaCalendario.mes, cantidad: lineaCalendario.cantidad })
    .from(lineaCalendario)
    .where(inArray(lineaCalendario.lineaId, lineas.map((l) => l.id)))
    .orderBy(asc(lineaCalendario.mes));

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
        meses: meses.filter((m) => m.lineaId === l.id).map((m) => ({ mes: m.mes, cantidad: m.cantidad })),
        cantidadSinMes: l.cantidadSinMes === null ? l.cantidad : num(l.cantidadSinMes),
      }));
    return {
      ...p,
      total: propias.reduce((s, l) => s + l.subtotal, 0),
      lineas: propias,
    };
  });
}

/** Lo planificado y lo pedido en un mes. */
export type Mes = { planificado: number; pedido: number };

/** Los doce meses de un presupuesto (índice 0 = enero). */
export async function mesesDePresupuesto(presupuestoId: number): Promise<Mes[]> {
  const filas = await db
    .select({ mes: vwMesDepartamento.mes, planificado: vwMesDepartamento.planificado, pedido: vwMesDepartamento.pedido })
    .from(vwMesDepartamento)
    .where(eq(vwMesDepartamento.presupuestoId, presupuestoId));

  const meses: Mes[] = Array.from({ length: 12 }, () => ({ planificado: 0, pedido: 0 }));
  for (const f of filas) {
    const i = (f.mes ?? 1) - 1;
    meses[i] = { planificado: num(f.planificado), pedido: num(f.pedido) };
  }
  return meses;
}

export type FilaProyeccion = {
  departamentoId: number;
  departamento: string;
  centroCosto: string | null;
  /** Lo planificado para cada mes; índice 0 = enero. */
  meses: number[];
  total: number;
};

/**
 * Lo que recibe GESEMCO: cuánto dinero necesitará cada departamento en cada
 * mes, según los meses que indicó su jefe. Solo lo aprobado por contabilidad:
 * lo demás todavía puede cambiar entero.
 */
export async function proyeccionColegio(colegioId: number, anioId: number): Promise<FilaProyeccion[]> {
  const aprobados = (await resumenFormulacion(colegioId, anioId)).filter((r) => r.estado === 'aprobado');
  if (aprobados.length === 0) return [];

  const filas = await db
    .select({ presupuestoId: vwMesDepartamento.presupuestoId, mes: vwMesDepartamento.mes, planificado: vwMesDepartamento.planificado })
    .from(vwMesDepartamento)
    .where(inArray(vwMesDepartamento.presupuestoId, aprobados.map((a) => a.presupuestoId!)));

  return aprobados.map((a) => {
    const meses = Array.from({ length: 12 }, () => 0);
    for (const f of filas) {
      if (f.presupuestoId === a.presupuestoId) meses[(f.mes ?? 1) - 1] = num(f.planificado);
    }
    return {
      departamentoId: a.departamentoId,
      departamento: a.departamento,
      centroCosto: a.centroCosto,
      meses,
      total: meses.reduce((s, m) => s + m, 0),
    };
  });
}

export async function cuentasContables() {
  return db
    .select({ id: cuentaContable.id, codigo: cuentaContable.codigo, nombre: cuentaContable.nombre })
    .from(cuentaContable)
    .where(eq(cuentaContable.activa, true))
    .orderBy(asc(cuentaContable.codigo));
}
