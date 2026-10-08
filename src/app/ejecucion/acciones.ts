'use server';

import { and, eq, sql } from 'drizzle-orm';
import {
  compra, itemOrden, lineaPresupuesto, ordenCompra, pendientePedido, presupuestoDepartamento, programa, recepcion,
  vwPedido,
} from '@/db';
import {
  comoUsuario, enteroDe, exigir, exigirSesion, fechaDe, idDe, responder, texto, ErrorDeUsuario, type Tx,
} from '@/lib/acciones';
import { fechaLarga, money } from '@/lib/formato';
import { esDireccion, esEquipoCompra, esJefeDe, type Sesion } from '@/lib/sesion';

/**
 * Acciones de la etapa 2. El jefe pide, anula y confirma lo que llegó;
 * Dirección resuelve lo que no cupo; el equipo de compra registra lo que
 * pagó. Cada una exige el rol que corresponde. La fecha, el disponible y
 * qué estado sigue a cuál los decide la base, y su mensaje es el que ve
 * el usuario.
 */

const rutaJefe = (departamentoId: number) => `/ejecucion/${departamentoId}`;

function anioEjecucion(sesion: Sesion) {
  exigir(sesion.anioEjecucion, 'No hay un año en ejecución: todavía no se puede pedir.');
  return sesion.anioEjecucion;
}

async function presupuestoEnEjecucion(tx: Tx, departamentoId: number, anioId: number): Promise<number> {
  const [p] = await tx.select({ id: presupuestoDepartamento.id })
    .from(presupuestoDepartamento)
    .where(and(eq(presupuestoDepartamento.departamentoId, departamentoId), eq(presupuestoDepartamento.anioId, anioId)));
  if (!p) throw new ErrorDeUsuario('El departamento no tiene presupuesto para este año.');
  return p.id;
}

type ItemNuevo = {
  lineaId?: number;
  articuloId?: number | null;
  descripcion: string;
  cantidad: number;
  precioPresupuesto: number;
  cuentaContableId: number | null;
};

/**
 * Crea el pedido en borrador con su fecha y sus ítems, y lo pide. La base
 * revisa la fecha y decide: si cabe en el disponible pasa a compra; si no,
 * queda esperando a Dirección.
 */
async function pedir(
  tx: Tx, sesion: Sesion, presupuestoId: number, necesariaPara: string, observacion: string | null, items: ItemNuevo[],
): Promise<string> {
  const r = await tx.execute<{ folio: string }>(sql`select fn_folio('OC', ${presupuestoId}) as folio`);
  const folio = r.rows[0].folio;

  const [orden] = await tx.insert(ordenCompra)
    .values({ folio, presupuestoId, emitidaPor: sesion.usuario.id, necesariaPara, observacion })
    .returning({ id: ordenCompra.id });
  await tx.insert(itemOrden).values(items.map((i) => ({ ...i, ordenId: orden.id })));

  const [pedido] = await tx.update(ordenCompra)
    .set({ estado: 'emitida' })
    .where(eq(ordenCompra.id, orden.id))
    .returning({ estado: ordenCompra.estado, monto: ordenCompra.montoPresupuesto });

  if (pedido.estado === 'emitida') {
    return `Pedido ${folio} enviado a compra, para el ${fechaLarga(necesariaPara)}. `
      + `Se descontaron ${money(pedido.monto)} de tu presupuesto.`;
  }

  const [pendiente] = await tx.select({ excedido: pendientePedido.montoExcedido })
    .from(pendientePedido).where(eq(pendientePedido.ordenId, orden.id));
  return `No alcanzaba: faltaban ${money(pendiente?.excedido)}. El pedido ${folio} se envió a Dirección como `
    + 'solicitud para extender tu presupuesto; te llegará un aviso cuando decida.';
}

/** "Pedir" al lado de un ítem del presupuesto: cualquier cantidad, con la fecha en que se necesita. */
export async function pedirItem(form: FormData) {
  const departamentoId = idDe(form, 'departamentoId');
  const lineaId = idDe(form, 'lineaId');
  await responder(`${rutaJefe(departamentoId)}#item-${lineaId}`, async () => {
    const sesion = await exigirSesion();
    exigir(esJefeDe(sesion, departamentoId), 'Solo el jefe del departamento hace sus pedidos.');
    const anio = anioEjecucion(sesion);
    const cantidad = enteroDe(form, 'cantidad', { min: 1 });
    const necesariaPara = fechaDe(form, 'necesariaPara');
    const observacion = texto(form, 'observacion', { max: 500 }) || null;

    return comoUsuario(sesion, async (tx) => {
      const presupuestoId = await presupuestoEnEjecucion(tx, departamentoId, anio.id);
      const [l] = await tx.select({
        articuloId: lineaPresupuesto.articuloId,
        descripcion: lineaPresupuesto.descripcion,
        precio: lineaPresupuesto.precioUnitario,
        cuentaContableId: lineaPresupuesto.cuentaContableId,
      })
        .from(lineaPresupuesto)
        .innerJoin(programa, eq(programa.id, lineaPresupuesto.programaId))
        .where(and(eq(lineaPresupuesto.id, lineaId), eq(programa.presupuestoId, presupuestoId)));
      if (!l) throw new ErrorDeUsuario('Ese ítem no es del presupuesto de tu departamento.');

      return pedir(tx, sesion, presupuestoId, necesariaPara, observacion, [{
        lineaId, articuloId: l.articuloId, descripcion: l.descripcion, cantidad,
        precioPresupuesto: l.precio, cuentaContableId: l.cuentaContableId,
      }]);
    });
  });
}

/** Algo que no estaba en el presupuesto: se pide igual, con su precio estimado y su fecha. */
export async function pedirFueraDelPresupuesto(form: FormData) {
  const departamentoId = idDe(form, 'departamentoId');
  await responder(`${rutaJefe(departamentoId)}#mis-pedidos`, async () => {
    const sesion = await exigirSesion();
    exigir(esJefeDe(sesion, departamentoId), 'Solo el jefe del departamento hace sus pedidos.');
    const anio = anioEjecucion(sesion);
    const descripcion = texto(form, 'descripcion', { obligatorio: true, max: 200 });
    const cantidad = enteroDe(form, 'cantidad', { min: 1 });
    const precio = enteroDe(form, 'precio', { min: 1 });
    const cuentaContableId = Number(form.get('cuentaContableId')) || null;
    const necesariaPara = fechaDe(form, 'necesariaPara');
    const observacion = texto(form, 'observacion', { obligatorio: true, max: 500 });

    return comoUsuario(sesion, async (tx) => {
      const presupuestoId = await presupuestoEnEjecucion(tx, departamentoId, anio.id);
      return pedir(tx, sesion, presupuestoId, necesariaPara, observacion, [{
        descripcion, cantidad, precioPresupuesto: precio, cuentaContableId,
      }]);
    });
  });
}

/** Pedido del departamento en el año en ejecución, o error. */
async function exigirPedido(tx: Tx, ordenId: number, departamentoId: number, anioId: number) {
  const [o] = await tx.select({ folio: vwPedido.folio, estado: vwPedido.estado, monto: vwPedido.monto })
    .from(vwPedido)
    .where(and(eq(vwPedido.ordenId, ordenId), eq(vwPedido.departamentoId, departamentoId), eq(vwPedido.anioId, anioId)));
  if (!o) throw new ErrorDeUsuario('Ese pedido no es de tu departamento.');
  return o;
}

/** El jefe anula un pedido por comprar o retira uno que espera a Dirección. */
export async function anularPedido(form: FormData) {
  const departamentoId = idDe(form, 'departamentoId');
  const ordenId = idDe(form, 'ordenId');
  await responder(`${rutaJefe(departamentoId)}#pedido-${ordenId}`, async () => {
    const sesion = await exigirSesion();
    exigir(esJefeDe(sesion, departamentoId), 'Solo el jefe del departamento anula sus pedidos.');
    const anio = anioEjecucion(sesion);

    return comoUsuario(sesion, async (tx) => {
      const o = await exigirPedido(tx, ordenId, departamentoId, anio.id);
      await tx.update(ordenCompra).set({ estado: 'anulada' }).where(eq(ordenCompra.id, ordenId));
      return o.estado === 'pendiente_direccion'
        ? `Retiraste el pedido ${o.folio}: Dirección ya no tiene que resolverlo.`
        : `Anulaste el pedido ${o.folio}: volvieron ${money(o.monto)} a tu presupuesto y el equipo de compra ya no lo comprará.`;
    });
  });
}

/** El jefe confirma que llegó lo comprado; si llegó con problemas, queda anotado. */
export async function confirmarRecepcion(form: FormData) {
  const departamentoId = idDe(form, 'departamentoId');
  const ordenId = idDe(form, 'ordenId');
  await responder(`${rutaJefe(departamentoId)}#pedido-${ordenId}`, async () => {
    const sesion = await exigirSesion();
    exigir(esJefeDe(sesion, departamentoId), 'Solo el jefe del departamento confirma lo que llegó.');
    const anio = anioEjecucion(sesion);
    const problema = texto(form, 'problema', { max: 500 }) || null;

    return comoUsuario(sesion, async (tx) => {
      const o = await exigirPedido(tx, ordenId, departamentoId, anio.id);
      await tx.insert(recepcion).values({
        ordenId, recibidoPor: sesion.usuario.id, conforme: problema === null, observaciones: problema,
      });
      return problema
        ? `Confirmaste que llegó el pedido ${o.folio}, con el problema que anotaste.`
        : `Confirmaste que llegó el pedido ${o.folio}.`;
    });
  });
}

// ---------------------------------------------------------------------
// Dirección: lo que no cupo
// ---------------------------------------------------------------------

export async function resolverSolicitud(form: FormData) {
  const pendienteId = idDe(form, 'pendienteId');
  await responder('/solicitudes', async () => {
    const sesion = await exigirSesion();
    exigir(esDireccion(sesion), 'Solo Dirección resuelve las solicitudes para extender un presupuesto.');
    const decision = String(form.get('decision') ?? '');
    exigir(decision === 'aprobar' || decision === 'denegar', 'Elige si apruebas o deniegas la solicitud.');
    const aprobar = decision === 'aprobar';
    const explicacion = texto(form, 'explicacion', { max: 1000 });
    exigir(aprobar || explicacion, 'Para denegar hay que explicarle el motivo al jefe.');

    return comoUsuario(sesion, async (tx) => {
      await tx.execute(sql`select fn_resolver_pendiente(${pendienteId}, ${aprobar}, ${explicacion || null})`);
      const [p] = await tx.select({ folio: vwPedido.folio, departamento: vwPedido.departamento, extension: vwPedido.extension })
        .from(vwPedido).where(eq(vwPedido.pendienteId, pendienteId));
      if (!aprobar) return `Denegaste el pedido ${p.folio} de ${p.departamento}. El jefe recibió tu explicación.`;
      return p.extension
        ? `Aprobaste la solicitud: el presupuesto de ${p.departamento} subió ${money(p.extension)} y el pedido ${p.folio} pasó a compra.`
        : `Aprobaste la solicitud: el pedido ${p.folio} de ${p.departamento} ya cabía y pasó a compra sin extender el presupuesto.`;
    });
  });
}

// ---------------------------------------------------------------------
// Equipo de compra: lo que se pagó
// ---------------------------------------------------------------------

const DOCUMENTOS = ['factura', 'boleta', 'otro'] as const;

export async function registrarCompra(form: FormData) {
  const ordenId = idDe(form, 'ordenId');
  await responder('/compras', async () => {
    const sesion = await exigirSesion();
    exigir(esEquipoCompra(sesion), 'Solo el equipo de compra registra compras.');
    const proveedor = texto(form, 'proveedor', { obligatorio: true, max: 200 });
    const tipo = String(form.get('tipoDocumento') ?? 'factura');
    exigir((DOCUMENTOS as readonly string[]).includes(tipo), 'Elige si es factura, boleta u otro documento.');
    const numeroDocumento = texto(form, 'numeroDocumento', { max: 60 }) || null;
    const fechaCompra = fechaDe(form, 'fechaCompra');
    const monto = enteroDe(form, 'monto', { min: 0 });
    const observaciones = texto(form, 'observaciones', { max: 500 }) || null;

    return comoUsuario(sesion, async (tx) => {
      const [o] = await tx.select({ folio: vwPedido.folio, departamento: vwPedido.departamento, presupuestado: vwPedido.monto })
        .from(vwPedido)
        .where(and(eq(vwPedido.ordenId, ordenId), eq(vwPedido.colegioId, sesion.colegio.id)));
      if (!o) throw new ErrorDeUsuario('Ese pedido no existe.');

      await tx.insert(compra).values({
        ordenId, proveedor, tipoDocumento: tipo as (typeof DOCUMENTOS)[number], numeroDocumento,
        fechaCompra, montoTotal: monto, registradaPor: sesion.usuario.id, observaciones,
      });
      const diferencia = monto - (o.presupuestado ?? 0);
      const comparado = diferencia === 0 ? 'lo mismo que lo presupuestado'
        : `${money(Math.abs(diferencia))} ${diferencia > 0 ? 'más' : 'menos'} que lo presupuestado`;
      return `Registraste la compra del pedido ${o.folio}: ${money(monto)}, ${comparado}. `
        + `Le avisamos a ${o.departamento} para que confirme cuando llegue.`;
    });
  });
}
