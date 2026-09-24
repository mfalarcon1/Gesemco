'use server';

import { and, eq } from 'drizzle-orm';
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
  if (!l) throw new ErrorDeUsuario('Esa línea no es de tu departamento.');
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

    await comoUsuario(sesion, async (tx) => {
      const presupuestoId = await asegurarPresupuesto(tx, departamentoId, anio.id);
      await tx.insert(programa).values({ presupuestoId, nombre, descripcion, creadoPor: sesion.usuario.id });
    });
    return `Programa "${nombre}" creado. Ahora agrégale artículos del catálogo o líneas libres.`;
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
    return `Programa "${nombre}" eliminado con sus líneas.`;
  });
}

export async function agregarDesdeCatalogo(form: FormData) {
  // Vuelve al catálogo con la misma búsqueda, para seguir agregando.
  const volverA = String(form.get('volverA') ?? '/catalogo');
  const destino = volverA.startsWith('/catalogo') ? volverA : '/catalogo';

  await responder(destino, async () => {
    const sesion = await exigirSesion();
    exigir(sesion.jefeDe, 'Solo un jefe de departamento agrega artículos a su presupuesto.');
    const departamentoId = sesion.jefeDe.id;
    const programaId = idDe(form, 'programaId');
    const articuloId = idDe(form, 'articuloId');
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
    return `Agregado: ${cantidad} × ${articulo.nombre} (${money(articulo.precio)} c/u) a "${nombrePrograma}".`;
  });
}

export async function agregarLineaLibre(form: FormData) {
  const departamentoId = idDe(form, 'departamentoId');
  await responder(ruta(departamentoId), async () => {
    const sesion = await exigirSesion();
    exigir(esJefeDe(sesion, departamentoId), 'Solo el jefe del departamento agrega líneas.');
    const programaId = idDe(form, 'programaId');
    const descripcion = texto(form, 'descripcion', { obligatorio: true, max: 200 });
    const cantidad = enteroDe(form, 'cantidad', { min: 1 });
    const precio = enteroDe(form, 'precio', { min: 0 });
    const cuenta = Number(form.get('cuentaContableId')) || null;
    const origen = texto(form, 'origen', { max: 200 }) || 'Estimación del jefe';
    const anio = anioFormulacion(sesion);

    await comoUsuario(sesion, async (tx) => {
      await exigirPrograma(tx, programaId, departamentoId, anio.id);
      await tx.insert(lineaPresupuesto).values({
        programaId, descripcion, cantidad, precioUnitario: precio, cuentaContableId: cuenta, origenPrecio: origen,
      });
    });
    return `Línea libre "${descripcion}" agregada.`;
  });
}

export async function editarLinea(form: FormData) {
  const departamentoId = idDe(form, 'departamentoId');
  await responder(ruta(departamentoId), async () => {
    const sesion = await exigirSesion();
    exigir(esJefeDe(sesion, departamentoId), 'Solo el jefe del departamento edita líneas.');
    const lineaId = idDe(form, 'lineaId');
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
    return `Línea "${descripcion}" actualizada.`;
  });
}

export async function eliminarLinea(form: FormData) {
  const departamentoId = idDe(form, 'departamentoId');
  await responder(ruta(departamentoId), async () => {
    const sesion = await exigirSesion();
    exigir(esJefeDe(sesion, departamentoId), 'Solo el jefe del departamento elimina líneas.');
    const lineaId = idDe(form, 'lineaId');
    const anio = anioFormulacion(sesion);

    const descripcion = await comoUsuario(sesion, async (tx) => {
      const l = await exigirLinea(tx, lineaId, departamentoId, anio.id);
      await tx.delete(lineaPresupuesto).where(eq(lineaPresupuesto.id, lineaId));
      return l.descripcion;
    });
    return `Línea "${descripcion}" eliminada.`;
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
    return 'Presupuesto enviado a Dirección. Mientras lo revisa no se puede editar.';
  });
}

export async function retirarEnvio(form: FormData) {
  const departamentoId = idDe(form, 'departamentoId');
  await responder(ruta(departamentoId), async () => {
    const sesion = await exigirSesion();
    exigir(esJefeDe(sesion, departamentoId), 'Solo el jefe del departamento retira su envío.');
    await cambiarEstado(sesion, departamentoId, 'borrador');
    return 'Retiraste el envío: el presupuesto volvió a preparación y lo puedes editar.';
  });
}

export async function aprobarPresupuesto(form: FormData) {
  const departamentoId = idDe(form, 'departamentoId');
  await responder(ruta(departamentoId), async () => {
    const sesion = await exigirSesion();
    exigir(esDireccion(sesion), 'Solo Dirección aprueba presupuestos.');
    await cambiarEstado(sesion, departamentoId, 'aprobado');
    return 'Presupuesto aprobado. El jefe ya puede asignar los meses.';
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
// Meses: el jefe reparte cada línea en los meses en que la necesita
// ---------------------------------------------------------------------

/**
 * Reparte la cantidad de la línea en partes iguales entre los meses
 * marcados; el resto de la división va a los primeros meses. Sin meses
 * marcados, la línea queda sin mes. Reemplaza el reparto anterior.
 */
export async function asignarMeses(form: FormData) {
  const departamentoId = idDe(form, 'departamentoId');
  await responder(ruta(departamentoId), async () => {
    const sesion = await exigirSesion();
    exigir(esJefeDe(sesion, departamentoId), 'Solo el jefe del departamento asigna los meses.');
    const lineaId = idDe(form, 'lineaId');
    const meses = [...new Set(form.getAll('mes').map(Number))]
      .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12)
      .sort((a, b) => a - b);
    const anio = anioFormulacion(sesion);

    const descripcion = await comoUsuario(sesion, async (tx) => {
      const l = await exigirLinea(tx, lineaId, departamentoId, anio.id);
      await tx.delete(lineaCalendario).where(eq(lineaCalendario.lineaId, lineaId));

      if (meses.length > 0) {
        const base = Math.floor(l.cantidad / meses.length);
        const resto = l.cantidad % meses.length;
        const filas = meses
          .map((mes, i) => ({ lineaId, mes, cantidad: base + (i < resto ? 1 : 0) }))
          .filter((f) => f.cantidad > 0);
        await tx.insert(lineaCalendario).values(filas);
      }
      return l.descripcion;
    });

    return meses.length === 0
      ? `"${descripcion}" quedó sin mes asignado.`
      : `"${descripcion}" repartida en ${meses.length} ${meses.length === 1 ? 'mes' : 'meses'}.`;
  });
}
