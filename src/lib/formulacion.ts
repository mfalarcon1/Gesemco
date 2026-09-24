import { and, asc, eq, inArray } from 'drizzle-orm';
import {
  db, vwPresupuestoDepartamento, vwProyeccionMensual, vwCalendarizacionLinea,
  programa, lineaPresupuesto, lineaCalendario, cuentaContable,
} from '@/db';
import { num } from './consultas';

export type EstadoPresupuesto = 'borrador' | 'enviado' | 'devuelto' | 'aprobado';

export const NOMBRE_ESTADO: Record<EstadoPresupuesto | 'sin_iniciar', string> = {
  sin_iniciar: 'Sin iniciar',
  borrador: 'En preparación',
  enviado: 'En revisión',
  devuelto: 'Devuelto',
  aprobado: 'Aprobado',
};

/** Solo el jefe edita, y solo en estos estados (la base lo exige igual). */
export const esEditable = (estado: EstadoPresupuesto | null) =>
  estado === null || estado === 'borrador' || estado === 'devuelto';

export type ResumenPresupuesto = {
  departamentoId: number;
  departamento: string;
  centroCosto: string | null;
  anioId: number;
  anio: number;
  presupuestoId: number | null;
  estado: EstadoPresupuesto | null;
  enviadoEn: string | null;
  resueltoEn: string | null;
  comentarioDireccion: string | null;
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
    presupuestoId: f.presupuestoId,
    estado: f.estado,
    enviadoEn: f.enviadoEn,
    resueltoEn: f.resueltoEn,
    comentarioDireccion: f.comentarioDireccion,
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
  meses: { mes: number; cantidad: number }[];
  cantidadSinMes: number;
};

export type ProgramaConLineas = {
  id: number;
  nombre: string;
  descripcion: string | null;
  total: number;
  lineas: Linea[];
};

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
    .where(inArray(lineaCalendario.lineaId, lineas.map((l) => l.id)));

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
        cantidadSinMes: num(l.cantidadSinMes ?? l.cantidad),
      }));
    return {
      ...p,
      total: propias.reduce((s, l) => s + l.subtotal, 0),
      lineas: propias,
    };
  });
}

/** Monto por mes (índice 0 = enero) y lo que falta asignar a un mes. */
export type Proyeccion = { meses: number[]; sinMes: number; total: number };

export async function proyeccionPresupuesto(presupuestoId: number, total: number): Promise<Proyeccion> {
  const filas = await db
    .select({ mes: vwProyeccionMensual.mes, monto: vwProyeccionMensual.monto })
    .from(vwProyeccionMensual)
    .where(eq(vwProyeccionMensual.presupuestoId, presupuestoId));

  const meses = Array.from({ length: 12 }, () => 0);
  for (const f of filas) meses[(f.mes ?? 1) - 1] = num(f.monto);
  const conMes = meses.reduce((a, b) => a + b, 0);
  return { meses, sinMes: total - conMes, total };
}

export type FilaProyeccion = { departamentoId: number; departamento: string; centroCosto: string | null } & Proyeccion;

/**
 * La matriz que recibe GESEMCO: cada departamento con presupuesto aprobado
 * por mes. Solo lo aprobado: un borrador todavía puede cambiar entero.
 */
export async function proyeccionColegio(colegioId: number, anioId: number): Promise<FilaProyeccion[]> {
  const aprobados = (await resumenFormulacion(colegioId, anioId)).filter((r) => r.estado === 'aprobado');
  if (aprobados.length === 0) return [];

  const filas = await db
    .select({ presupuestoId: vwProyeccionMensual.presupuestoId, mes: vwProyeccionMensual.mes, monto: vwProyeccionMensual.monto })
    .from(vwProyeccionMensual)
    .where(inArray(vwProyeccionMensual.presupuestoId, aprobados.map((a) => a.presupuestoId!)));

  return aprobados.map((a) => {
    const meses = Array.from({ length: 12 }, () => 0);
    for (const f of filas.filter((x) => x.presupuestoId === a.presupuestoId)) {
      meses[(f.mes ?? 1) - 1] = num(f.monto);
    }
    const conMes = meses.reduce((s, m) => s + m, 0);
    // El total es el vigente: incluye las modificaciones que vengan después.
    return {
      departamentoId: a.departamentoId,
      departamento: a.departamento,
      centroCosto: a.centroCosto,
      meses,
      sinMes: a.vigente - conMes,
      total: a.vigente,
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
