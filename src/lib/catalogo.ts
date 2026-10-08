import { and, asc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import {
  db, vwCatalogoArticulo, vwPrecioVigente, categoriaArticulo,
  presupuestoDepartamento, programa, productoTienda, lineaPresupuesto,
} from '@/db';
import { num } from './consultas';
import { fechaNumerica } from './formato';
import { esEditable, type EstadoPresupuesto } from './formulacion';
import type { Sesion } from './sesion';

export async function categorias() {
  return db
    .select({ id: categoriaArticulo.id, nombre: categoriaArticulo.nombre })
    .from(categoriaArticulo)
    .orderBy(asc(categoriaArticulo.orden), asc(categoriaArticulo.nombre));
}

/** Minúsculas y sin tildes, para buscar "temperas" y encontrar "Témpera". */
function normalizar(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

export type Oferta = {
  productoTiendaId: number;
  tienda: string;
  producto: string;
  marca: string | null;
  url: string | null;
  precio: number;
  conIva: boolean | null;
  precioConIva: number;
  observadoEn: string | null;
};

export type ArticuloCatalogo = {
  articuloId: number;
  nombre: string;
  unidad: string;
  categoriaId: number;
  categoria: string;
  ofertas: Oferta[];
  precioMin: number | null;
  precioMax: number | null;
  precioReferencia: number | null;
  actualizadoEn: string | null;
};

export async function buscarCatalogo(filtro: { q?: string; categoriaId?: number }): Promise<ArticuloCatalogo[]> {
  const c = vwCatalogoArticulo;
  const condiciones: SQL[] = [];

  const q = normalizar(filtro.q ?? '');
  if (q) {
    // translate() quita las tildes en la base sin necesitar la extensión unaccent.
    condiciones.push(sql`translate(lower(${c.nombre}), 'áéíóúüñ', 'aeiouun') like ${'%' + q + '%'}`);
  }
  if (filtro.categoriaId) condiciones.push(eq(c.categoriaId, filtro.categoriaId));

  const articulos = await db.select().from(c)
    .where(condiciones.length ? and(...condiciones) : undefined)
    .orderBy(asc(c.categoriaId), asc(c.nombre));

  if (articulos.length === 0) return [];

  const ofertas = await db.select().from(vwPrecioVigente)
    .where(inArray(vwPrecioVigente.articuloId, articulos.map((a) => a.articuloId!)))
    .orderBy(asc(vwPrecioVigente.precioConIva));

  return articulos.map((a) => ({
    articuloId: a.articuloId!,
    nombre: a.nombre ?? '',
    unidad: a.unidad ?? 'unidad',
    categoriaId: a.categoriaId!,
    categoria: a.categoria ?? '',
    precioMin: a.precioMin,
    precioMax: a.precioMax,
    precioReferencia: a.precioReferencia,
    actualizadoEn: a.actualizadoEn,
    ofertas: ofertas
      .filter((o) => o.articuloId === a.articuloId)
      .map((o) => ({
        productoTiendaId: o.productoTiendaId!,
        tienda: o.tienda ?? '',
        producto: o.producto ?? '',
        marca: o.marca,
        url: o.url,
        precio: o.precio ?? 0,
        conIva: o.conIva,
        precioConIva: o.precioConIva ?? 0,
        observadoEn: o.observadoEn,
      })),
  }));
}

/** Productos que el scraper trajo y nadie ha asociado a un artículo. */
export async function productosSinClasificar(): Promise<number> {
  const [f] = await db
    .select({ n: sql<number>`count(*)` })
    .from(productoTienda)
    .where(and(eq(productoTienda.activo, true), sql`${productoTienda.articuloId} is null`));
  return num(f?.n);
}

/**
 * Datos con los que se crea una línea desde el catálogo: el precio es la
 * mediana de las ofertas vigentes (el "precio del medio", como se le explica
 * a los jefes), y queda anotado de dónde salió.
 */
export async function precioParaLinea(articuloId: number) {
  const [a] = await db.select().from(vwCatalogoArticulo).where(eq(vwCatalogoArticulo.articuloId, articuloId));
  if (!a || a.precioReferencia === null) return null;

  const ofertas = num(a.ofertas);
  let origen = `Precio del medio entre ${ofertas} ofertas`;
  if (ofertas === 1) {
    const [unica] = await db.select({ tienda: vwPrecioVigente.tienda })
      .from(vwPrecioVigente).where(eq(vwPrecioVigente.articuloId, articuloId));
    origen = unica?.tienda ?? '1 oferta';
  }

  return {
    articuloId,
    nombre: a.nombre ?? '',
    precio: a.precioReferencia,
    cuentaContableId: a.cuentaContableId,
    origen: `${origen} al ${fechaNumerica(a.actualizadoEn)}`,
  };
}

export type Destino = { programaId: number; programa: string; items: number; total: number };

/**
 * A qué programas puede agregar artículos este usuario: los del presupuesto
 * de su departamento en el año en formulación, mientras sea editable.
 */
export async function destinosDelJefe(sesion: Sesion): Promise<{
  estado: EstadoPresupuesto | null; editable: boolean; programas: Destino[];
}> {
  if (!sesion.jefeDe || !sesion.anioFormulacion) return { estado: null, editable: false, programas: [] };

  const [pres] = await db
    .select({ id: presupuestoDepartamento.id, estado: presupuestoDepartamento.estado })
    .from(presupuestoDepartamento)
    .where(and(
      eq(presupuestoDepartamento.departamentoId, sesion.jefeDe.id),
      eq(presupuestoDepartamento.anioId, sesion.anioFormulacion.id),
    ));

  if (!pres) return { estado: null, editable: true, programas: [] };

  const programas = await db
    .select({
      programaId: programa.id,
      programa: programa.nombre,
      items: sql<number>`count(${lineaPresupuesto.id})`,
      total: sql<number>`coalesce(sum(${lineaPresupuesto.subtotal}), 0)`,
    })
    .from(programa)
    .leftJoin(lineaPresupuesto, eq(lineaPresupuesto.programaId, programa.id))
    .where(eq(programa.presupuestoId, pres.id))
    .groupBy(programa.id, programa.nombre, programa.creadoEn)
    .orderBy(asc(programa.creadoEn), asc(programa.id));

  return {
    estado: pres.estado,
    editable: esEditable(pres.estado),
    programas: programas.map((p) => ({ ...p, items: num(p.items), total: num(p.total) })),
  };
}

/**
 * Cuántas unidades de cada artículo del catálogo tiene ya un programa, para
 * que el jefe vea en el catálogo lo que ya agregó y no lo repita sin querer.
 * Quien llama se asegura de que el programa sea del jefe.
 */
export async function cantidadesEnPrograma(programaId: number): Promise<Map<number, number>> {
  const filas = await db
    .select({ articuloId: lineaPresupuesto.articuloId, cantidad: sql<number>`sum(${lineaPresupuesto.cantidad})` })
    .from(lineaPresupuesto)
    .where(and(eq(lineaPresupuesto.programaId, programaId), sql`${lineaPresupuesto.articuloId} is not null`))
    .groupBy(lineaPresupuesto.articuloId);
  return new Map(filas.map((f) => [f.articuloId!, num(f.cantidad)]));
}
