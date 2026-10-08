import { and, asc, count, desc, eq, inArray, isNotNull, ne, type SQL } from 'drizzle-orm';
import { db, vwPedido, vwLineaPedida, vwMesDepartamento } from '@/db';
import { num, saldosEjecucion } from './consultas';
import type { EstadoPedido } from './estados';
import { programasConLineas, type Linea, type Mes, type MesLinea, type ProgramaConLineas } from './formulacion';
import { mesDe, sumarDias } from './formato';

/**
 * Lecturas de la etapa 2: los pedidos de los jefes, lo que espera a
 * Dirección, lo que tiene que comprar el equipo de compra y el mes a mes.
 * Todo sale de vistas (vw_pedido, vw_linea_pedida, vw_mes_departamento);
 * las reglas (la fecha, el disponible, quién mueve qué) las pone la base.
 */

export type Pedido = {
  ordenId: number;
  folio: string;
  estado: EstadoPedido;
  necesariaPara: string;
  pedidoEn: string;
  monto: number;
  observacion: string | null;
  pedidoPor: string;
  departamentoId: number;
  departamento: string;
  centroCosto: string | null;
  anio: number;
  /** Los ítems en una frase: "Témpera frasco 250 ml × 30". */
  detalle: string;
  items: number;
  noPlanificado: boolean;
  cuenta: string | null;
  /** Lo pagado de verdad (null mientras no se compra) y su diferencia con lo presupuestado. */
  pagado: number | null;
  diferencia: number | null;
  fechaCompra: string | null;
  proveedor: string | null;
  documento: string | null;
  fechaRecepcion: string | null;
  conforme: boolean | null;
  observacionRecepcion: string | null;
  /** La solicitud a Dirección, si el pedido no cupo. */
  pendienteId: number | null;
  estadoSolicitud: 'pendiente' | 'aprobado' | 'denegado' | 'retirado' | null;
  montoExcedido: number | null;
  disponibleAlEmitir: number | null;
  explicacion: string | null;
  resueltoEn: string | null;
  /** Lo que Dirección sumó al presupuesto para que cupiera. */
  extension: number | null;
};

const p = vwPedido;

function aPedido(f: typeof p.$inferSelect): Pedido {
  return {
    ordenId: f.ordenId ?? 0,
    folio: f.folio ?? '',
    estado: (f.estado ?? 'borrador') as EstadoPedido,
    necesariaPara: f.necesariaPara ?? '',
    pedidoEn: f.pedidoEn ?? '',
    monto: num(f.monto),
    observacion: f.observacion,
    pedidoPor: f.pedidoPor ?? '',
    departamentoId: f.departamentoId ?? 0,
    departamento: f.departamento ?? '',
    centroCosto: f.centroCosto,
    anio: f.anio ?? 0,
    detalle: f.detalle ?? '',
    items: num(f.items),
    noPlanificado: Boolean(f.noPlanificado),
    cuenta: f.cuenta,
    pagado: f.pagado === null ? null : num(f.pagado),
    diferencia: f.diferencia === null ? null : num(f.diferencia),
    fechaCompra: f.fechaCompra,
    proveedor: f.proveedor,
    documento: f.documento,
    fechaRecepcion: f.fechaRecepcion,
    conforme: f.conforme,
    observacionRecepcion: f.observacionRecepcion,
    pendienteId: f.pendienteId,
    estadoSolicitud: f.estadoSolicitud,
    montoExcedido: f.montoExcedido === null ? null : num(f.montoExcedido),
    disponibleAlEmitir: f.disponibleAlEmitir === null ? null : num(f.disponibleAlEmitir),
    explicacion: f.explicacion,
    resueltoEn: f.resueltoEn,
    extension: f.extension,
  };
}

type Filtro = {
  colegioId: number;
  anioId: number;
  departamentoId?: number;
  estados?: EstadoPedido[];
  /** reciente: lo último que se pidió primero. urgente: lo que se necesita antes, primero. */
  orden?: 'reciente' | 'urgente';
  limite?: number;
};

export async function pedidos(filtro: Filtro): Promise<Pedido[]> {
  const condiciones: SQL[] = [eq(p.colegioId, filtro.colegioId), eq(p.anioId, filtro.anioId)];
  if (filtro.departamentoId) condiciones.push(eq(p.departamentoId, filtro.departamentoId));
  if (filtro.estados) {
    if (filtro.estados.length === 0) return [];
    condiciones.push(inArray(p.estado, filtro.estados));
  }

  const consulta = db.select().from(p).where(and(...condiciones))
    .orderBy(...(filtro.orden === 'urgente'
      ? [asc(p.necesariaPara), asc(p.folio)]
      : [desc(p.pedidoEn), desc(p.folio)]));
  const filas = filtro.limite ? await consulta.limit(filtro.limite) : await consulta;
  return filas.map(aPedido);
}

/** Cuántos pedidos del colegio están en un estado (para el encabezado). */
export async function contarPedidos(colegioId: number, anioId: number, estado: EstadoPedido): Promise<number> {
  const [f] = await db.select({ n: count() }).from(p)
    .where(and(eq(p.colegioId, colegioId), eq(p.anioId, anioId), eq(p.estado, estado)));
  return f?.n ?? 0;
}

// ---------------------------------------------------------------------
// El jefe: su presupuesto ítem por ítem, para pedir
// ---------------------------------------------------------------------

/** Qué cantidad proponer al pedir un ítem, y de qué mes sale. */
export type Sugerencia = { cantidad: number; mes: number | null };

/**
 * Lo pedido se descuenta de los meses planificados en orden (primero los
 * más antiguos). Se propone lo que queda del primer mes desde `desdeMes`;
 * si no queda nada desde ahí, lo que quedó de un mes anterior; y si ya se
 * pidió todo lo planificado, una unidad. Es solo una sugerencia: se puede
 * pedir cualquier cantidad.
 */
export function sugerir(meses: MesLinea[], pedida: number, desdeMes: number): Sugerencia {
  let resto = pedida;
  const quedan = [...meses].sort((a, b) => a.mes - b.mes).map((m) => {
    const usado = Math.min(resto, m.cantidad);
    resto -= usado;
    return { mes: m.mes, cantidad: m.cantidad - usado };
  }).filter((m) => m.cantidad > 0);

  const proximo = quedan.find((m) => m.mes >= desdeMes) ?? quedan[0];
  return proximo ? { cantidad: proximo.cantidad, mes: proximo.mes } : { cantidad: 1, mes: null };
}

export type LineaParaPedir = Linea & {
  /** Lo pedido que pasó a compra (por comprar, comprado o recibido). */
  pedida: number;
  /** Lo pedido que espera a Dirección. */
  enEspera: number;
  sugerencia: Sugerencia;
};

export type ProgramaParaPedir = Omit<ProgramaConLineas, 'lineas'> & { lineas: LineaParaPedir[] };

/**
 * Los programas del presupuesto en ejecución con lo pedido de cada ítem y
 * la cantidad que se propone pedir. `hoy` y `anticipacion` dan el primer
 * mes en que puede necesitarse algo que se pida hoy.
 */
export async function programasParaPedir(presupuestoId: number, hoy: string, anticipacion: number): Promise<ProgramaParaPedir[]> {
  const [programas, pedidas] = await Promise.all([
    programasConLineas(presupuestoId),
    db.select().from(vwLineaPedida).where(eq(vwLineaPedida.presupuestoId, presupuestoId)),
  ]);
  const desdeMes = mesDe(sumarDias(hoy, anticipacion));

  return programas.map((prog) => ({
    ...prog,
    lineas: prog.lineas.map((l) => {
      const f = pedidas.find((x) => x.lineaId === l.id);
      const pedida = num(f?.pedida);
      return { ...l, pedida, enEspera: num(f?.enEspera), sugerencia: sugerir(l.meses, pedida, desdeMes) };
    }),
  }));
}

// ---------------------------------------------------------------------
// Dirección: lo que no cupo
// ---------------------------------------------------------------------

export type Solicitud = Pedido & {
  vigente: number;
  disponible: number;
  /** Cuánto falta hoy: lo que Dirección sumaría al aprobar. Puede ser 0 si entremedio se liberó plata. */
  faltaHoy: number;
};

/** Los pedidos que esperan a Dirección, del más antiguo al más nuevo, con el saldo de hoy. */
export async function solicitudesPendientes(colegioId: number, anioId: number): Promise<Solicitud[]> {
  const lista = await db.select().from(p)
    .where(and(eq(p.colegioId, colegioId), eq(p.anioId, anioId), eq(p.estado, 'pendiente_direccion')))
    .orderBy(asc(p.pedidoEn));
  if (lista.length === 0) return [];

  const saldos = await saldosEjecucion(colegioId, anioId, [...new Set(lista.map((f) => f.departamentoId ?? 0))]);
  return lista.map(aPedido).map((x) => {
    const s = saldos.find((y) => y.departamentoId === x.departamentoId);
    const disponible = s?.disponible ?? 0;
    return { ...x, vigente: s?.vigente ?? 0, disponible, faltaHoy: Math.max(0, x.monto - disponible) };
  });
}

/** Las últimas solicitudes resueltas (aprobadas, denegadas o retiradas por el jefe). */
export async function solicitudesResueltas(colegioId: number, anioId: number, limite = 10): Promise<Pedido[]> {
  const filas = await db.select().from(p)
    .where(and(
      eq(p.colegioId, colegioId), eq(p.anioId, anioId),
      isNotNull(p.pendienteId), ne(p.estadoSolicitud, 'pendiente'),
    ))
    .orderBy(desc(p.resueltoEn))
    .limit(limite);
  return filas.map(aPedido);
}

// ---------------------------------------------------------------------
// Mes a mes
// ---------------------------------------------------------------------

export type MesesDepartamento = {
  departamentoId: number;
  departamento: string;
  centroCosto: string | null;
  meses: Mes[];
};

/**
 * Lo planificado y lo pedido de cada mes, por departamento, para los
 * presupuestos aprobados de un año (en ejecución, todos lo están).
 */
export async function mesesColegio(colegioId: number, anioId: number): Promise<MesesDepartamento[]> {
  const m = vwMesDepartamento;
  const filas = await db.select().from(m)
    .where(and(eq(m.colegioId, colegioId), eq(m.anioId, anioId), eq(m.estado, 'aprobado')))
    .orderBy(asc(m.departamentoId), asc(m.mes));

  const lista: MesesDepartamento[] = [];
  for (const f of filas) {
    let d = lista.find((x) => x.departamentoId === f.departamentoId);
    if (!d) {
      d = {
        departamentoId: f.departamentoId ?? 0,
        departamento: f.departamento ?? '',
        centroCosto: f.centroCosto,
        meses: Array.from({ length: 12 }, () => ({ planificado: 0, pedido: 0 })),
      };
      lista.push(d);
    }
    d.meses[(f.mes ?? 1) - 1] = { planificado: num(f.planificado), pedido: num(f.pedido) };
  }
  return lista;
}

/** Suma mes a mes de varios departamentos. */
export function sumarMeses(lista: { meses: Mes[] }[]): Mes[] {
  return Array.from({ length: 12 }, (_, i) => ({
    planificado: lista.reduce((s, d) => s + d.meses[i].planificado, 0),
    pedido: lista.reduce((s, d) => s + d.meses[i].pedido, 0),
  }));
}
