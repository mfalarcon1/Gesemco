import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { getSesion, type Sesion } from './sesion';

/**
 * Piezas comunes de las acciones del servidor.
 *
 * Patrón de cada acción:
 *   1. exigirSesion() y los permisos del rol (exigir(...)).
 *   2. comoUsuario(sesion, tx => ...) hace el trabajo en una transacción que
 *      le dice a la base quién actúa, para la bitácora y los avisos.
 *   3. responder(ruta, ...) vuelve a la página con ?ok= o ?error=.
 *
 * Las reglas de estado (qué se puede editar y cuándo) no se revisan acá:
 * las hace cumplir la base, y su mensaje es el que ve el usuario.
 */

/** Un error pensado para mostrárselo tal cual al usuario. */
export class ErrorDeUsuario extends Error {}

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function exigirSesion(): Promise<Sesion> {
  const sesion = await getSesion();
  if (!sesion) throw new ErrorDeUsuario('No hay una sesión activa.');
  return sesion;
}

export function exigir(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new ErrorDeUsuario(mensaje);
}

export async function comoUsuario<T>(sesion: Sesion, trabajo: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.usuario_id', ${String(sesion.usuario.id)}, true)`);
    return trabajo(tx);
  });
}

// Mensajes para las restricciones cuyo texto por defecto es técnico.
const POR_RESTRICCION: Record<string, string> = {
  uq_programa_nombre: 'Ya hay un programa con ese nombre en este presupuesto.',
  uq_presupuesto_depto_anio: 'Este departamento ya tiene presupuesto para ese año.',
  ck_devuelto_con_comentario: 'Para devolver el presupuesto hay que escribirle un comentario al jefe.',
  ck_denegado_con_explicacion: 'Para denegar hay que explicarle el motivo al jefe.',
  linea_presupuesto_cantidad_check: 'La cantidad tiene que ser mayor que cero.',
  linea_presupuesto_precio_unitario_check: 'El precio no puede ser negativo.',
};

type ErrorPg = { message?: string; constraint?: string; code?: string };

export function mensajeDeError(e: unknown): string {
  if (e instanceof ErrorDeUsuario) return e.message;

  // drizzle envuelve el error de PostgreSQL en DrizzleQueryError.cause.
  const pg = ((e as { cause?: ErrorPg })?.cause ?? e) as ErrorPg;

  // Violación de una restricción declarada (CHECK, UNIQUE, FK).
  if (pg.constraint) {
    return POR_RESTRICCION[pg.constraint]
      ?? (pg.code === '23505' ? 'Ya existe un registro igual.' : `Los datos no cumplen una regla del sistema (${pg.constraint}).`);
  }

  // Los RAISE EXCEPTION de los triggers ya vienen escritos para el usuario.
  if (pg.code === 'P0001' || pg.code === '23514') return pg.message ?? 'Operación no permitida.';

  console.error(e);
  return 'No se pudo completar la operación. Revisa los datos e intenta de nuevo.';
}

/**
 * Ejecuta el trabajo y vuelve a `ruta` con el resultado en la URL, para que
 * la página lo muestre. Funciona sin JavaScript en el navegador.
 */
export async function responder(ruta: string, trabajo: () => Promise<string>): Promise<never> {
  let resultado: string;
  try {
    resultado = `ok=${encodeURIComponent(await trabajo())}`;
  } catch (e) {
    resultado = `error=${encodeURIComponent(mensajeDeError(e))}`;
  }
  revalidatePath(ruta.split('?')[0]);
  redirect(`${ruta}${ruta.includes('?') ? '&' : '?'}${resultado}`);
}

// ---------------------------------------------------------------------
// Lectura de formularios
// ---------------------------------------------------------------------

export function texto(form: FormData, campo: string, { obligatorio = false, max = 500 } = {}): string {
  const valor = String(form.get(campo) ?? '').trim();
  if (obligatorio && !valor) throw new ErrorDeUsuario(`Falta completar: ${campo}.`);
  if (valor.length > max) throw new ErrorDeUsuario(`El campo ${campo} es demasiado largo.`);
  return valor;
}

export function enteroDe(form: FormData, campo: string, { min = 0 } = {}): number {
  // Acepta "12.500" o "12500": en Chile el punto separa miles.
  const crudo = String(form.get(campo) ?? '').replace(/[.\s$]/g, '').trim();
  const n = Number(crudo);
  if (!crudo || !Number.isInteger(n)) throw new ErrorDeUsuario(`${campo} tiene que ser un número entero.`);
  if (n < min) throw new ErrorDeUsuario(`${campo} tiene que ser al menos ${min}.`);
  if (n > 2_000_000_000) throw new ErrorDeUsuario(`${campo} es demasiado grande.`);
  return n;
}

export function idDe(form: FormData, campo: string): number {
  const n = Number(form.get(campo));
  if (!Number.isInteger(n) || n <= 0) throw new ErrorDeUsuario('Falta un identificador en el formulario.');
  return n;
}
