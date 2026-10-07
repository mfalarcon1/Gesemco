import { cookies } from 'next/headers';
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { db, usuario, rolAsignado, departamento, anioPresupuestario, colegio } from '@/db';

export const COOKIE_USUARIO = 'gesemco_usuario';

export type Rol =
  | 'administrador' | 'direccion' | 'contabilidad'
  | 'equipo_compra' | 'jefe_departamento' | 'profesor';

export type Departamento = { id: number; nombre: string };
/** formulacionHasta: hasta cuándo se formula ese año (solo informativo). */
export type Anio = { id: number; anio: number; formulacionHasta: string | null };

export type Sesion = {
  usuario: { id: number; nombre: string; email: string; colegioId: number };
  colegio: { id: number; nombre: string };
  /** El rol de mayor alcance: define la etiqueta y la portada. */
  rol: Rol;
  etiquetaRol: string;
  /** Todos los roles vigentes. Un jefe puede además hacer clases en otro departamento. */
  roles: Rol[];
  jefeDe: Departamento | null;
  profesorEn: Departamento[];
  /** Dirección, contabilidad, equipo de compra y administrador ven el colegio completo. */
  veTodoElColegio: boolean;
  /** El año que se está formulando (etapa 1) y el que se está ejecutando (etapa 2). */
  anioFormulacion: Anio | null;
  anioEjecucion: Anio | null;
};

const PRECEDENCIA: Rol[] = [
  'administrador', 'direccion', 'contabilidad', 'equipo_compra', 'jefe_departamento', 'profesor',
];

const DE_COLEGIO: Rol[] = ['administrador', 'direccion', 'contabilidad', 'equipo_compra'];

export const ETIQUETA_ROL: Record<Rol, string> = {
  administrador: 'Administrador del sistema',
  direccion: 'Dirección del colegio',
  contabilidad: 'Contabilidad GESEMCO',
  equipo_compra: 'Equipo de compra',
  jefe_departamento: 'Jefatura de departamento',
  profesor: 'Profesor',
};

// La fecha la pone la base: un servidor que lleva días corriendo no
// debe arrastrar la fecha del día en que partió.
const vigente = or(isNull(rolAsignado.hasta), sql`${rolAsignado.hasta} >= CURRENT_DATE`);

/** Para el selector de usuario mientras no hay autenticación real. */
export async function usuariosDisponibles() {
  const filas = await db
    .select({
      id: usuario.id,
      nombre: usuario.nombre,
      rol: rolAsignado.rol,
      departamento: departamento.nombre,
    })
    .from(usuario)
    .leftJoin(rolAsignado, and(eq(rolAsignado.usuarioId, usuario.id), vigente))
    .leftJoin(departamento, eq(departamento.id, rolAsignado.departamentoId))
    .where(eq(usuario.activo, true))
    .orderBy(asc(usuario.id));

  const agrupado = new Map<number, { id: number; nombre: string; roles: { rol: Rol; departamento: string | null }[] }>();
  for (const f of filas) {
    const u = agrupado.get(f.id) ?? { id: f.id, nombre: f.nombre, roles: [] };
    if (f.rol) u.roles.push({ rol: f.rol, departamento: f.departamento });
    agrupado.set(f.id, u);
  }

  return [...agrupado.values()].map((u) => {
    const rol = PRECEDENCIA.find((r) => u.roles.some((x) => x.rol === r)) ?? null;
    const departamentos = u.roles.filter((x) => x.rol === rol && x.departamento).map((x) => x.departamento!);
    return {
      id: u.id,
      nombre: u.nombre,
      rol,
      departamento: departamentos.length ? departamentos.join(' y ') : null,
    };
  });
}

export async function getSesion(): Promise<Sesion | null> {
  const store = await cookies();
  const guardado = Number(store.get(COOKIE_USUARIO)?.value);

  // Sin cookie válida entra el primer usuario activo. Es deliberado: el
  // selector reemplaza al login mientras construimos, y se cambia por
  // Auth.js sin tocar nada de lo que viene más abajo.
  const [quien] = await db
    .select({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, colegioId: usuario.colegioId })
    .from(usuario)
    .where(
      Number.isInteger(guardado) && guardado > 0
        ? and(eq(usuario.id, guardado), eq(usuario.activo, true))
        : eq(usuario.activo, true),
    )
    .orderBy(asc(usuario.id))
    .limit(1);

  if (!quien) return null;

  const [establecimiento] = await db
    .select({ id: colegio.id, nombre: colegio.nombre })
    .from(colegio)
    .where(eq(colegio.id, quien.colegioId));

  if (!establecimiento) return null;

  const asignaciones = await db
    .select({ rol: rolAsignado.rol, departamentoId: departamento.id, departamento: departamento.nombre })
    .from(rolAsignado)
    .leftJoin(departamento, eq(departamento.id, rolAsignado.departamentoId))
    .where(and(eq(rolAsignado.usuarioId, quien.id), vigente));

  const roles = [...new Set(asignaciones.map((a) => a.rol))];
  const rol = PRECEDENCIA.find((r) => roles.includes(r)) ?? 'profesor';

  const jefatura = asignaciones.find((a) => a.rol === 'jefe_departamento' && a.departamentoId);
  const clases = asignaciones.filter((a) => a.rol === 'profesor' && a.departamentoId);

  const anios = await db
    .select({
      id: anioPresupuestario.id,
      anio: anioPresupuestario.anio,
      etapa: anioPresupuestario.etapa,
      formulacionHasta: anioPresupuestario.formulacionHasta,
    })
    .from(anioPresupuestario)
    .where(and(
      eq(anioPresupuestario.colegioId, quien.colegioId),
      inArray(anioPresupuestario.etapa, ['formulacion', 'ejecucion']),
    ))
    .orderBy(desc(anioPresupuestario.anio));

  const buscarAnio = (etapa: 'formulacion' | 'ejecucion'): Anio | null => {
    const a = anios.find((x) => x.etapa === etapa);
    return a ? { id: a.id, anio: a.anio, formulacionHasta: a.formulacionHasta } : null;
  };

  return {
    usuario: quien,
    colegio: establecimiento,
    rol,
    etiquetaRol: ETIQUETA_ROL[rol],
    roles,
    jefeDe: jefatura ? { id: jefatura.departamentoId!, nombre: jefatura.departamento! } : null,
    profesorEn: clases.map((c) => ({ id: c.departamentoId!, nombre: c.departamento! })),
    veTodoElColegio: roles.some((r) => DE_COLEGIO.includes(r)),
    anioFormulacion: buscarAnio('formulacion'),
    anioEjecucion: buscarAnio('ejecucion'),
  };
}

// ---------------------------------------------------------------------
// Permisos. Se consultan en las páginas (qué mostrar) y se vuelven a
// exigir en las acciones del servidor (qué se puede hacer). Las reglas de
// estado (qué se puede editar y cuándo) las garantiza la base.
// ---------------------------------------------------------------------

const tiene = (s: Sesion, ...roles: Rol[]) => s.roles.some((r) => roles.includes(r));

export const esAdministrador = (s: Sesion) => tiene(s, 'administrador');
export const esDireccion = (s: Sesion) => tiene(s, 'direccion', 'administrador');
export const esContabilidad = (s: Sesion) => tiene(s, 'contabilidad', 'administrador');

/** Formula el presupuesto del departamento: solo su jefe. */
export const esJefeDe = (s: Sesion, departamentoId: number) =>
  s.jefeDe?.id === departamentoId || esAdministrador(s);

export const puedeVerDepartamento = (s: Sesion, departamentoId: number) =>
  s.veTodoElColegio || s.jefeDe?.id === departamentoId || s.profesorEn.some((d) => d.id === departamentoId);

/** La etapa 1 la viven los jefes, Dirección y contabilidad. */
export const participaEnFormulacion = (s: Sesion) =>
  s.jefeDe !== null || tiene(s, 'direccion', 'contabilidad', 'administrador');

/** Las órdenes de compra de cada periodo son para GESEMCO y Dirección. */
export const veOrdenesDeCompra = (s: Sesion) => tiene(s, 'direccion', 'contabilidad', 'administrador');
