import { cookies } from 'next/headers';
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import {
  db, usuario, rolAsignado, departamento, profesorAsignatura,
  anioPresupuestario, colegio,
} from '@/db';

export const COOKIE_USUARIO = 'gesemco_usuario';

export type Rol =
  | 'administrador' | 'contabilidad' | 'direccion'
  | 'jefe_departamento' | 'profesor';

/**
 * Qué parte del colegio puede ver el usuario. Sale de rol_asignado, que
 * guarda el par rol + ámbito, así que un jefe de departamento que además
 * hace clases queda resuelto sin duplicar la persona.
 */
export type Alcance =
  | { tipo: 'asignaturas'; asignaturaIds: number[] }
  | { tipo: 'departamento'; departamentoId: number; nombre: string }
  | { tipo: 'colegio'; colegioId: number; nombre: string };

export type Sesion = {
  usuario: { id: number; nombre: string; email: string; colegioId: number };
  rol: Rol;
  etiquetaRol: string;
  alcance: Alcance;
  anio: { id: number; anio: number; estado: 'abierto' | 'cerrado' };
  colegio: { id: number; nombre: string };
};

// Quien tiene varios roles opera con el de mayor alcance.
const PRECEDENCIA: Rol[] = [
  'administrador', 'contabilidad', 'direccion', 'jefe_departamento', 'profesor',
];

const ETIQUETA: Record<Rol, string> = {
  administrador: 'Administrador del sistema',
  contabilidad: 'Contabilidad GESEMCO',
  direccion: 'Dirección del colegio',
  jefe_departamento: 'Jefatura de departamento',
  profesor: 'Profesor',
};

/** Para el selector de usuario mientras no hay autenticación real. */
export async function usuariosDisponibles() {
  const filas = await db
    .select({
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: rolAsignado.rol,
    })
    .from(usuario)
    .leftJoin(rolAsignado, eq(rolAsignado.usuarioId, usuario.id))
    .where(eq(usuario.activo, true))
    .orderBy(asc(usuario.id));

  // Un usuario puede tener varios roles, así que la consulta devuelve una
  // fila por rol. Los agrupamos y nos quedamos con el de mayor alcance.
  const agrupado = new Map<number, { id: number; nombre: string; email: string; roles: Rol[] }>();
  for (const f of filas) {
    const u = agrupado.get(f.id) ?? { id: f.id, nombre: f.nombre, email: f.email, roles: [] };
    if (f.rol) u.roles.push(f.rol as Rol);
    agrupado.set(f.id, u);
  }

  return [...agrupado.values()].map((u) => ({
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    rol: PRECEDENCIA.find((r) => u.roles.includes(r)) ?? null,
  }));
}

export async function getSesion(): Promise<Sesion | null> {
  const store = await cookies();
  const guardado = Number(store.get(COOKIE_USUARIO)?.value);

  // Sin cookie válida entra el primer usuario activo. Es deliberado: este
  // selector reemplaza al login mientras construimos la Fase 1, y se cambia
  // por Auth.js sin tocar nada de lo que viene más abajo.
  const [quien] = await db
    .select({
      id: usuario.id, nombre: usuario.nombre,
      email: usuario.email, colegioId: usuario.colegioId,
    })
    .from(usuario)
    .where(
      Number.isInteger(guardado) && guardado > 0
        ? and(eq(usuario.id, guardado), eq(usuario.activo, true))
        : eq(usuario.activo, true),
    )
    .orderBy(asc(usuario.id))
    .limit(1);

  if (!quien) return null;

  const roles = await db
    .select({ rol: rolAsignado.rol, ambitoTipo: rolAsignado.ambitoTipo, ambitoId: rolAsignado.ambitoId })
    .from(rolAsignado)
    .where(and(
      eq(rolAsignado.usuarioId, quien.id),
      or(isNull(rolAsignado.hasta), sql`${rolAsignado.hasta} >= CURRENT_DATE`),
    ));

  const rol = PRECEDENCIA.find((r) => roles.some((x) => x.rol === r)) ?? 'profesor';

  const [establecimiento] = await db
    .select({ id: colegio.id, nombre: colegio.nombre })
    .from(colegio)
    .where(eq(colegio.id, quien.colegioId));

  const [periodo] = await db
    .select({ id: anioPresupuestario.id, anio: anioPresupuestario.anio, estado: anioPresupuestario.estado })
    .from(anioPresupuestario)
    .where(and(
      eq(anioPresupuestario.colegioId, quien.colegioId),
      eq(anioPresupuestario.estado, 'abierto'),
    ))
    .orderBy(asc(anioPresupuestario.anio))
    .limit(1);

  if (!establecimiento || !periodo) return null;

  const alcance = await resolverAlcance(rol, quien, roles, periodo.id, establecimiento);

  return {
    usuario: quien,
    rol,
    etiquetaRol: ETIQUETA[rol],
    alcance,
    anio: { id: periodo.id, anio: periodo.anio, estado: periodo.estado },
    colegio: establecimiento,
  };
}

async function resolverAlcance(
  rol: Rol,
  quien: { id: number; colegioId: number },
  roles: { rol: string; ambitoTipo: string; ambitoId: number }[],
  anioId: number,
  establecimiento: { id: number; nombre: string },
): Promise<Alcance> {
  if (rol === 'jefe_departamento') {
    const ambito = roles.find((r) => r.rol === 'jefe_departamento' && r.ambitoTipo === 'departamento');
    if (ambito) {
      const [d] = await db
        .select({ nombre: departamento.nombre })
        .from(departamento)
        .where(eq(departamento.id, ambito.ambitoId));
      return { tipo: 'departamento', departamentoId: ambito.ambitoId, nombre: d?.nombre ?? 'Departamento' };
    }
  }

  if (rol === 'profesor') {
    // Las asignaturas que dicta este año, no las de su historia completa.
    const filas = await db
      .select({ asignaturaId: profesorAsignatura.asignaturaId })
      .from(profesorAsignatura)
      .where(and(
        eq(profesorAsignatura.usuarioId, quien.id),
        eq(profesorAsignatura.anioId, anioId),
      ));
    return { tipo: 'asignaturas', asignaturaIds: filas.map((f) => f.asignaturaId) };
  }

  return { tipo: 'colegio', colegioId: establecimiento.id, nombre: establecimiento.nombre };
}
