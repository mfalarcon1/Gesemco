'use server';

import { and, eq, inArray } from 'drizzle-orm';
import {
  programa, lineaPresupuesto, lineaCalendario, presupuestoDepartamento,
} from '@/db';
import {
  comoUsuario, enteroDe, exigir, exigirSesion, idDe, responder, texto, ErrorDeUsuario, type Tx,
} from '@/lib/acciones';
import { precioParaLinea } from '@/lib/catalogo';
import { money } from '@/lib/formato';
import { esDireccion, esJefeDe, type Sesion } from '@/lib/sesion';

/**
 * Acciones de la etapa 1. Cada una exige el rol que corresponde; las reglas
 * de estado (no editar lo enviado, no aprobar un borrador, etc.) las hace
 * cumplir la base y su mensaje es el que ve el usuario.
 */

const ruta = (departamentoId: number) => `/formulacion/${departamentoId}`;

function anioFormulacion(sesion: Sesion) {
  exigir(sesion.anioFormulacion, 'No hay un año abierto para formular.');
  return sesion.anioFormulacion;
}

/** El presupuesto del departamento en el año en formulación; lo crea si no existe. */
async function asegurarPresupuesto(tx: Tx, departamentoId: number, anioId: number): Promise<number> {
  await tx.insert(presupuestoDepartamento)
    .values({ departamentoId, anioId })
    .onConflictDoNothing();
  const [p] = await tx.select({ id: presupuestoDepartamento.id })
    .from(presupuestoDepartamento)
    .where(and(eq(presupuestoDepartamento.departamentoId, departamentoId), eq(presupuestoDepartamento.anioId, anioId)));
  return p.id;
}

async function presupuestoDe(tx: Tx, departamentoId: number, anioId: number) {
  const [p] = await tx.select({ id: presupuestoDepartamento.id })
    .from(presupuestoDepartamento)
    .where(and(eq(presupuestoDepartamento.departamentoId, departamentoId), eq(presupuestoDepartamento.anioId, anioId)));
  if (!p) throw new ErrorDeUsuario('Este departamento todavía no empieza su presupuesto.');
  return p.id;
}

/** Confirma que el programa es del presupuesto de ese departamento en el año en formulación. */
async function exigirPrograma(tx: Tx, programaId: number, departamentoId: number, anioId: number) {
  const [p] = await tx.select({ nombre: programa.nombre })
    .from(programa)
    .innerJoin(presupuestoDepartamento, eq(presupuestoDepartamento.id, programa.presupuestoId))
    .where(and(
      eq(programa.id, programaId),
      eq(presupuestoDepartamento.departamentoId, departamentoId),
      eq(presupuestoDepartamento.anioId, anioId),
    ));
  if (!p) throw new ErrorDeUsuario('Ese programa no es de tu departamento.');
  return p;
}

async function exigirLinea(tx: Tx, lineaId: number, departamentoId: number, anioId: number) {
  const [l] = await tx.select({
    programaId: lineaPresupuesto.programaId,
    descripcion: lineaPresupuesto.descripcion,
    cantidad: lineaPresupuesto.cantidad,
    precioUnitario: lineaPresupuesto.precioUnitario,
  })
    .from(lineaPresupuesto)
    .innerJoin(programa, eq(programa.id, lineaPresupuesto.programaId))
    .innerJoin(presupuestoDepartamento, eq(presupuestoDepartamento.id, programa.presupuestoId))
    .where(and(
      eq(lineaPresupuesto.id, lineaId),
      eq(presupuestoDepartamento.departamentoId, departamentoId),
      eq(presupuestoDepartamento.anioId, anioId),
    ));
  if (!l) throw new ErrorDeUsuario('Ese ítem no es de tu departamento.');
  return l;
}

// ---------------------------------------------------------------------
// Jefe de departamento: programas y líneas
// ---------------------------------------------------------------------

export async function crearPrograma(form: FormData) {
  const departamentoId = idDe(form, 'departamentoId');
  await responder(ruta(departamentoId), async () => {
    const sesion = await exigirSesion();
    exigir(esJefeDe(sesion, departamentoId), 'Solo el jefe del departamento crea programas.');
    const nombre = texto(form, 'nombre', { obligatorio: true, max: 120 });
    const descripcion = texto(form, 'descripcion', { max: 600 }) || null;
    const anio = anioFormulacion(sesion);

    const id = await comoUsuario(sesion, async (tx) => {
      const presupuestoId = await asegurarPresupuesto(tx, departamentoId, anio.id);
      const [p] = await tx.insert(programa)
        .values({ presupuestoId, nombre, descripcion, creadoPor: sesion.usuario.id })
        .returning({ id: programa.id });
      return p.id;
    });
    return {
      mensaje: `Programa "${nombre}" creado. Ahora agrégale lo que necesitas: búscalo en el catálogo o agrégalo a mano.`,
      ancla: `programa-${id}`,
    };
  });
}

export async function eliminarPrograma(form: FormData) {
  const departamentoId = idDe(form, 'departamentoId');
  await responder(ruta(departamentoId), async () => {
    const sesion = await exigirSesion();
    exigir(esJefeDe(sesion, departamentoId), 'Solo el jefe del departamento elimina programas.');
    const programaId = idDe(form, 'programaId');
    const anio = anioFormulacion(sesion);

    const nombre = await comoUsuario(sesion, async (tx) => {
      const p = await exigirPrograma(tx, programaId, departamentoId, anio.id);
      await tx.delete(programa).where(eq(programa.id, programaId));
      return p.nombre;
    });
    return { mensaje: `Programa "${nombre}" eliminado.`, ancla: 'programas' };
  });
}

export async function agregarDesdeCatalogo(form: FormData) {
  // Vuelve al catálogo con la misma búsqueda, para seguir agregando.
  const volverA = String(form.get('volverA') ?? '/catalogo');
  const destino = volverA.startsWith('/catalogo') ? volverA : '/catalogo';

  const articuloId = idDe(form, 'articuloId');

  await responder(`${destino}#articulo-${articuloId}`, async () => {
    const sesion = await exigirSesion();
    exigir(sesion.jefeDe, 'Solo un jefe de departamento agrega artículos a su presupuesto.');
    const departamentoId = sesion.jefeDe.id;
    const programaId = idDe(form, 'programaId');
    const cantidad = enteroDe(form, 'cantidad', { min: 1 });
    const anio = anioFormulacion(sesion);

    const articulo = await precioParaLinea(articuloId);
    exigir(articulo, 'Ese artículo no tiene precios vigentes en el catálogo.');

    const nombrePrograma = await comoUsuario(sesion, async (tx) => {
      const p = await exigirPrograma(tx, programaId, departamentoId, anio.id);
      await tx.insert(lineaPresupuesto).values({
        programaId,
        articuloId,
        descripcion: articulo.nombre,
        cantidad,
        precioUnitario: articulo.precio,
        cuentaContableId: articulo.cuentaContableId,
        origenPrecio: articulo.origen,
      });
      return p.nombre;
    });
    return `Agregaste ${cantidad} × ${articulo.nombre} (${money(articulo.precio)} c/u) a "${nombrePrograma}".`;
  });
}

export async function agregarLineaLibre(form: FormData) {
  const departamentoId = idDe(form, 'departamentoId');
  const programaId = idDe(form, 'programaId');
  await responder(`${ruta(departamentoId)}#programa-${programaId}`, async () => {
    const sesion = await exigirSesion();
    exigir(esJefeDe(sesion, departamentoId), 'Solo el jefe del departamento agrega ítems.');
    const descripcion = texto(form, 'descripcion', { obligatorio: true, max: 200 });
    const cantidad = enteroDe(form, 'cantidad', { min: 1 });
    const precio = enteroDe(form, 'precio', { min: 0 });
    const cuenta = Number(form.get('cuentaContableId')) || null;
    const origen = texto(form, 'origen', { max: 200 }) || 'Estimación del jefe';
    const anio = anioFormulacion(sesion);

    const id = await comoUsuario(sesion, async (tx) => {
      await exigirPrograma(tx, programaId, departamentoId, anio.id);
      const [l] = await tx.insert(lineaPresupuesto).values({
        programaId, descripcion, cantidad, precioUnitario: precio, cuentaContableId: cuenta, origenPrecio: origen,
      }).returning({ id: lineaPresupuesto.id });
      return l.id;
    });
    return { mensaje: `Agregaste "${descripcion}".`, ancla: `item-${id}` };
  });
}

export async function editarLinea(form: FormData) {
  const departamentoId = idDe(form, 'departamentoId');
  const lineaId = idDe(form, 'lineaId');
  await responder(`${ruta(departamentoId)}#item-${lineaId}`, async () => {
    const sesion = await exigirSesion();
    exigir(esJefeDe(sesion, departamentoId), 'Solo el jefe del departamento edita ítems.');
    const cantidad = enteroDe(form, 'cantidad', { min: 1 });
    const precio = enteroDe(form, 'precio', { min: 0 });
    const anio = anioFormulacion(sesion);

    const descripcion = await comoUsuario(sesion, async (tx) => {
      const l = await exigirLinea(tx, lineaId, departamentoId, anio.id);
      await tx.update(lineaPresupuesto)
        .set({
          cantidad,
          precioUnitario: precio,
          // Si el jefe cambia el precio, queda anotado cuál era.
          ...(precio !== l.precioUnitario
            ? { origenPrecio: `Ajustado por el jefe (antes ${money(l.precioUnitario)})` }
            : {}),
        })
        .where(eq(lineaPresupuesto.id, lineaId));
      return l.descripcion;
    });
    return `Guardaste los cambios en "${descripcion}".`;
  });
}

export async function eliminarLinea(form: FormData) {
  const departamentoId = idDe(form, 'departamentoId');
  await responder(ruta(departamentoId), async () => {
    const sesion = await exigirSesion();
    exigir(esJefeDe(sesion, departamentoId), 'Solo el jefe del departamento quita ítems.');
    const lineaId = idDe(form, 'lineaId');
    const anio = anioFormulacion(sesion);

    const l = await comoUsuario(sesion, async (tx) => {
      const linea = await exigirLinea(tx, lineaId, departamentoId, anio.id);
      await tx.delete(lineaPresupuesto).where(eq(lineaPresupuesto.id, lineaId));
      return linea;
    });
    return { mensaje: `Quitaste "${l.descripcion}".`, ancla: `programa-${l.programaId}` };
  });
}

// ---------------------------------------------------------------------
// Ciclo de vida: jefe envía o retira; Dirección aprueba o devuelve
// ---------------------------------------------------------------------

async function cambiarEstado(
  sesion: Sesion, departamentoId: number,
  estado: 'enviado' | 'borrador' | 'aprobado' | 'devuelto', comentario?: string,
) {
  const anio = anioFormulacion(sesion);
  await comoUsuario(sesion, async (tx) => {
    const id = await presupuestoDe(tx, departamentoId, anio.id);
    await tx.update(presupuestoDepartamento)
      .set({ estado, ...(comentario !== undefined ? { comentarioDireccion: comentario } : {}) })
      .where(eq(presupuestoDepartamento.id, id));
  });
}

export async function enviarADireccion(form: FormData) {
  const departamentoId = idDe(form, 'departamentoId');
  await responder(ruta(departamentoId), async () => {
    const sesion = await exigirSesion();
    exigir(esJefeDe(sesion, departamentoId), 'Solo el jefe del departamento envía su presupuesto.');
    await cambiarEstado(sesion, departamentoId, 'enviado');
    return 'Enviaste tu presupuesto a Dirección. Te llegará un aviso cuando lo revise.';
  });
}

export async function retirarEnvio(form: FormData) {
  const departamentoId = idDe(form, 'departamentoId');
  await responder(ruta(departamentoId), async () => {
    const sesion = await exigirSesion();
    exigir(esJefeDe(sesion, departamentoId), 'Solo el jefe del departamento retira su envío.');
    await cambiarEstado(sesion, departamentoId, 'borrador');
    return 'Retiraste el envío: tu presupuesto volvió a preparación y ya lo puedes editar.';
  });
}

export async function aprobarPresupuesto(form: FormData) {
  const departamentoId = idDe(form, 'departamentoId');
  await responder(ruta(departamentoId), async () => {
    const sesion = await exigirSesion();
    exigir(esDireccion(sesion), 'Solo Dirección aprueba presupuestos.');
    await cambiarEstado(sesion, departamentoId, 'aprobado');
    return 'Presupuesto aprobado. El jefe ya puede indicar los meses de cada compra.';
  });
}

export async function devolverPresupuesto(form: FormData) {
  const departamentoId = idDe(form, 'departamentoId');
  await responder(ruta(departamentoId), async () => {
    const sesion = await exigirSesion();
    exigir(esDireccion(sesion), 'Solo Dirección devuelve presupuestos.');
    const comentario = texto(form, 'comentario', { max: 1000 });
    exigir(comentario, 'Para devolver el presupuesto hay que escribirle un comentario al jefe.');
    await cambiarEstado(sesion, departamentoId, 'devuelto', comentario);
    return 'Presupuesto devuelto al jefe con tu comentario.';
  });
}

// ---------------------------------------------------------------------
// Meses: el jefe indica cuántas unidades de cada ítem necesita cada mes
// ---------------------------------------------------------------------

/** Cantidad de un mes en el formulario: vacío es 0; si no, un entero de 0 en adelante. */
function cantidadDelMes(form: FormData, campo: string): number {
  const crudo = String(form.get(campo) ?? '').trim();
  if (crudo === '') return 0;
  const n = Number(crudo);
  if (!Number.isInteger(n) || n < 0) {
    throw new ErrorDeUsuario('Las cantidades por mes tienen que ser números enteros, de 0 en adelante.');
  }
  return n;
}

/**
 * Guarda la grilla de meses completa: por cada ítem (campo "linea"), las
 * cantidades m-<ítem>-1 … m-<ítem>-12. La suma de un ítem no puede pasar su
 * cantidad; lo que quede sin repartir aparece como "sin mes". Solo reescribe
 * los ítems que cambiaron, y todo va en una transacción: o se guarda todo o nada.
 */
export async function guardarMeses(form: FormData) {
  const departamentoId = idDe(form, 'departamentoId');
  await responder(`${ruta(departamentoId)}/meses`, async () => {
    const sesion = await exigirSesion();
    exigir(esJefeDe(sesion, departamentoId), 'Solo el jefe del departamento indica los meses.');
    const anio = anioFormulacion(sesion);

    const lineaIds = [...new Set(form.getAll('linea').map(Number))].filter((n) => Number.isInteger(n) && n > 0);
    exigir(lineaIds.length > 0, 'No hay ítems para guardar.');

    const { completos, incompletos } = await comoUsuario(sesion, async (tx) => {
      const antes = await tx
        .select({ lineaId: lineaCalendario.lineaId, mes: lineaCalendario.mes, cantidad: lineaCalendario.cantidad })
        .from(lineaCalendario)
        .where(inArray(lineaCalendario.lineaId, lineaIds));

      let completos = 0;
      let incompletos = 0;
      for (const lineaId of lineaIds) {
        const l = await exigirLinea(tx, lineaId, departamentoId, anio.id);
        const reparto = Array.from({ length: 12 }, (_, i) => cantidadDelMes(form, `m-${lineaId}-${i + 1}`));
        const suma = reparto.reduce((a, b) => a + b, 0);
        if (suma > l.cantidad) {
          throw new ErrorDeUsuario(`En "${l.descripcion}" pusiste ${suma} unidades y el ítem tiene ${l.cantidad}.`);
        }
        if (suma === l.cantidad) completos++;
        else incompletos++;

        const anterior = Array.from({ length: 12 }, (_, i) =>
          antes.find((a) => a.lineaId === lineaId && a.mes === i + 1)?.cantidad ?? 0);
        if (anterior.every((c, i) => c === reparto[i])) continue;

        await tx.delete(lineaCalendario).where(eq(lineaCalendario.lineaId, lineaId));
        const filas = reparto
          .map((cantidad, i) => ({ lineaId, mes: i + 1, cantidad }))
          .filter((f) => f.cantidad > 0);
        if (filas.length > 0) await tx.insert(lineaCalendario).values(filas);
      }
      return { completos, incompletos };
    });

    if (incompletos === 0) return 'Meses guardados: todos los ítems tienen sus meses.';
    return `Meses guardados. ${completos === 0 ? 'Todavía ningún ítem está completo' : `${completos} de ${completos + incompletos} ítems completos`}; `
      + `${incompletos === 1 ? 'a 1 ítem le faltan' : `a ${incompletos} ítems les faltan`} meses.`;
  });
}
