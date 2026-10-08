import { cookies } from 'next/headers';
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
  uq_programa_nombre: 'Ya hay un programa con ese nombre en tu presupuesto.',
  uq_presupuesto_depto_anio: 'Este departamento ya tiene presupuesto para ese año.',
  ck_devuelto_con_comentario: 'Para devolver el presupuesto hay que escribirle un comentario al jefe.',
  ck_reparos_con_comentario: 'Para enviar reparos hay que escribirle al jefe qué tiene que corregir.',
  ck_denegado_con_explicacion: 'Para denegar hay que explicarle el motivo al jefe.',
  linea_presupuesto_cantidad_check: 'La cantidad tiene que ser mayor que cero.',
  linea_presupuesto_precio_unitario_check: 'El precio no puede ser negativo.',
  linea_calendario_mes_check: 'Los meses van de enero a diciembre.',
  linea_calendario_cantidad_check: 'La cantidad de cada mes tiene que ser mayor que cero.',
  uq_linea_mes: 'Ese ítem ya tiene unidades en ese mes.',
  item_orden_cantidad_check: 'La cantidad tiene que ser mayor que cero.',
  item_orden_precio_presupuesto_check: 'El precio no puede ser negativo.',
  compra_monto_total_check: 'El monto pagado no puede ser negativo.',
  recepcion_orden_id_key: 'La recepción de ese pedido ya está confirmada.',
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

/** Lo que devuelve una acción: el mensaje y, si conviene, a qué parte de la página volver. */
export type Resultado = string | { mensaje: string; ancla?: string };

/** El error de la última acción viaja en esta cookie de un solo uso (ver `responder`). */
export const COOKIE_ERROR = 'gesemco_error';

/**
 * Ejecuta el trabajo y avisa el resultado. Funciona sin JavaScript en el navegador.
 *
 * - Si sale bien, vuelve a `ruta` con ?ok= en la URL. La ruta puede traer un
 *   #ancla (la fila que se editó) y el trabajo también puede fijarla cuando
 *   recién sabe adónde volver (el programa que acaba de crear). Los
 *   formularios abiertos se cierran, porque ya se guardó.
 * - Si sale mal, no cambia de página: el error llega en una cookie y la página
 *   se vuelve a dibujar en el mismo lugar, con los formularios abiertos y lo
 *   que la persona escribió, para que corrija sin tipear todo de nuevo.
 */
export async function responder(ruta: string, trabajo: () => Promise<Resultado>): Promise<void> {
  const [base, anclaDeRuta] = ruta.split('#');
  const almacen = await cookies();
  let r: Resultado;
  try {
    r = await trabajo();
  } catch (e) {
    almacen.set(COOKIE_ERROR, encodeURIComponent(JSON.stringify({ mensaje: mensajeDeError(e), t: Date.now() })), {
      path: '/', maxAge: 120, sameSite: 'lax',
    });
    revalidatePath(base.split('?')[0]);
    return;
  }

  almacen.delete(COOKIE_ERROR);
  const { mensaje, ancla } = typeof r === 'string' ? { mensaje: r, ancla: anclaDeRuta } : { ancla: anclaDeRuta, ...r };
  revalidatePath(base.split('?')[0]);
  // t distingue dos avisos iguales seguidos, para que el segundo también se vea.
  redirect(`${base}${base.includes('?') ? '&' : '?'}ok=${encodeURIComponent(mensaje)}&t=${Date.now()}${ancla ? `#${ancla}` : ''}`);
}

// ---------------------------------------------------------------------
// Lectura de formularios
// ---------------------------------------------------------------------

// Cómo se nombra cada campo en los mensajes: nunca el nombre técnico del formulario.
const NOMBRE_CAMPO: Record<string, string> = {
  nombre: 'el nombre',
  descripcion: 'la descripción',
  comentario: 'el comentario',
  origen: 'de dónde sale el precio',
  cantidad: 'la cantidad',
  precio: 'el precio',
  necesariaPara: 'la fecha en que lo necesitas',
  observacion: 'para qué es',
  explicacion: 'la explicación',
  proveedor: 'el proveedor',
  numeroDocumento: 'el número del documento',
  fechaCompra: 'la fecha de la compra',
  monto: 'el monto pagado',
  observaciones: 'las observaciones',
  problema: 'qué problema hubo',
};

const nombreCampo = (campo: string) => NOMBRE_CAMPO[campo] ?? campo;
const conMayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function texto(form: FormData, campo: string, { obligatorio = false, max = 500 } = {}): string {
  const valor = String(form.get(campo) ?? '').trim();
  if (obligatorio && !valor) throw new ErrorDeUsuario(`Falta completar ${nombreCampo(campo)}.`);
  if (valor.length > max) {
    throw new ErrorDeUsuario(`${conMayuscula(nombreCampo(campo))} es demasiado largo: máximo ${max} caracteres.`);
  }
  return valor;
}

export function enteroDe(form: FormData, campo: string, { min = 0 } = {}): number {
  // Acepta "12.500", "$12.500" o "12500": en Chile el punto separa miles.
  const crudo = String(form.get(campo) ?? '').replace(/[.\s$]/g, '').trim();
  const n = Number(crudo);
  const nombre = conMayuscula(nombreCampo(campo));
  if (!crudo || !Number.isInteger(n)) throw new ErrorDeUsuario(`${nombre} tiene que ser un número entero, sin decimales.`);
  if (n < min) throw new ErrorDeUsuario(`${nombre} tiene que ser al menos ${min}.`);
  if (n > 2_000_000_000) throw new ErrorDeUsuario(`${nombre} es demasiado grande.`);
  return n;
}

export function idDe(form: FormData, campo: string): number {
  const n = Number(form.get(campo));
  if (!Number.isInteger(n) || n <= 0) throw new ErrorDeUsuario('Falta un identificador en el formulario.');
  return n;
}

/** Una fecha de un campo <input type="date">: "2026-10-20". */
export function fechaDe(form: FormData, campo: string): string {
  const valor = String(form.get(campo) ?? '').trim();
  if (!valor) throw new ErrorDeUsuario(`Falta ${nombreCampo(campo)}.`);
  const d = new Date(`${valor}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor) {
    throw new ErrorDeUsuario(`${conMayuscula(nombreCampo(campo))} no es una fecha válida.`);
  }
  return valor;
}
