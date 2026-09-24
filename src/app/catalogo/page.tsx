import Link from 'next/link';
import { Encabezado, SinDatos } from '@/components/encabezado';
import { Aviso, leerAviso } from '@/components/aviso';
import { EstadoPresupuestoPildora } from '@/components/pildoras';
import { boton, campo, etiqueta, tarjeta } from '@/components/ui';
import { getSesion } from '@/lib/sesion';
import {
  buscarCatalogo, categorias, destinosDelJefe, productosSinClasificar, type ArticuloCatalogo, type Destino,
} from '@/lib/catalogo';
import { fecha, money } from '@/lib/formato';
import { agregarDesdeCatalogo } from '../formulacion/acciones';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function Catalogo({ searchParams }: Props) {
  const sesion = await getSesion();
  if (!sesion) return <SinDatos />;

  const params = await searchParams;
  const q = uno(params.q).slice(0, 80);
  const categoriaId = Number(uno(params.categoria)) || undefined;
  const programaElegido = Number(uno(params.programa)) || undefined;
  const aviso = leerAviso(params);

  const [lista, cats, destinos, sinClasificar] = await Promise.all([
    buscarCatalogo({ q, categoriaId }),
    categorias(),
    destinosDelJefe(sesion),
    sesion.veTodoElColegio ? productosSinClasificar() : Promise.resolve(0),
  ]);

  // Para volver a esta misma búsqueda después de agregar.
  const consulta = new URLSearchParams();
  if (q) consulta.set('q', q);
  if (categoriaId) consulta.set('categoria', String(categoriaId));
  if (programaElegido) consulta.set('programa', String(programaElegido));
  const volverA = `/catalogo${consulta.size ? `?${consulta}` : ''}`;

  const puedeAgregar = Boolean(sesion.jefeDe) && destinos.editable && destinos.programas.length > 0;

  return (
    <>
      <Encabezado sesion={sesion} activo="catalogo" />
      <main className="mx-auto max-w-6xl px-5 pb-20 pt-7">
        <h1 className="mb-1 font-display text-2xl font-semibold">Catálogo</h1>
        <p className="mb-5 max-w-3xl text-sm text-ink-2">
          Artículos con los precios que publican las tiendas. El precio de referencia es la mediana de las ofertas
          vigentes, con IVA: es el que queda congelado en la línea cuando la agregas a un programa.
        </p>

        <Aviso {...aviso} />

        {sesion.jefeDe && sesion.anioFormulacion && (
          <ContextoJefe destinos={destinos} departamento={sesion.jefeDe.nombre} departamentoId={sesion.jefeDe.id}
            anio={sesion.anioFormulacion.anio} />
        )}

        {/* Filtros: una sola fila, arriba de todo lo que afectan */}
        <form className="mb-5 flex flex-wrap items-end gap-3" role="search">
          {programaElegido && <input type="hidden" name="programa" value={programaElegido} />}
          <div className="min-w-[14rem] flex-1">
            <label htmlFor="q" className={etiqueta}>Buscar</label>
            <input id="q" name="q" defaultValue={q} className={campo} placeholder="témpera, cuaderno, tóner…" />
          </div>
          <div className="w-56">
            <label htmlFor="categoria" className={etiqueta}>Categoría</label>
            <select id="categoria" name="categoria" defaultValue={categoriaId ?? ''} className={campo}>
              <option value="">Todas</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <button className={boton.secundario}>Buscar</button>
          {(q || categoriaId) && (
            <Link href={programaElegido ? `/catalogo?programa=${programaElegido}` : '/catalogo'}
              className="py-2 text-sm text-accent hover:underline">
              Limpiar
            </Link>
          )}
        </form>

        <p className="mb-3 text-xs text-ink-3">
          {lista.length} {lista.length === 1 ? 'artículo' : 'artículos'}
          {sinClasificar > 0 && ` · ${sinClasificar} productos de tiendas todavía sin asociar a un artículo`}
        </p>

        {lista.length === 0 ? (
          <p className={`${tarjeta} px-4 py-10 text-center text-sm text-ink-3`}>
            No hay artículos con esa búsqueda. Si es un servicio o algo que las tiendas no venden, agrégalo como
            línea libre en tu programa.
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-4">
            {lista.map((a) => (
              <TarjetaArticulo key={a.articuloId} articulo={a}
                destinos={puedeAgregar ? destinos.programas : []}
                programaElegido={programaElegido} volverA={volverA} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function ContextoJefe({
  destinos, departamento, departamentoId, anio,
}: {
  destinos: Awaited<ReturnType<typeof destinosDelJefe>>; departamento: string; departamentoId: number; anio: number;
}) {
  let mensaje: React.ReactNode;
  if (!destinos.editable) {
    mensaje = <>Tu presupuesto {anio} no se puede editar en este estado, así que el catálogo es solo de consulta.</>;
  } else if (destinos.programas.length === 0) {
    mensaje = (
      <>
        Para agregar artículos, primero{' '}
        <Link href={`/formulacion/${departamentoId}`} className="text-accent underline underline-offset-2">crea un programa</Link>{' '}
        en tu presupuesto {anio}.
      </>
    );
  } else {
    mensaje = (
      <>
        Agrega artículos a los programas de {departamento}.{' '}
        <Link href={`/formulacion/${departamentoId}`} className="text-accent underline underline-offset-2">Volver a mi presupuesto</Link>
      </>
    );
  }

  return (
    <div className={`${tarjeta} mb-5 flex flex-wrap items-center gap-3 px-4 py-3 text-sm`}>
      <span className="font-medium">Presupuesto {anio} de {departamento}</span>
      <EstadoPresupuestoPildora estado={destinos.estado} />
      <span className="text-ink-2">{mensaje}</span>
    </div>
  );
}

function TarjetaArticulo({
  articulo: a, destinos, programaElegido, volverA,
}: { articulo: ArticuloCatalogo; destinos: Destino[]; programaElegido?: number; volverA: string }) {
  const unaTienda = a.ofertas.length === 1;
  const preseleccion = destinos.some((d) => d.programaId === programaElegido) ? programaElegido : destinos[0]?.programaId;

  return (
    <article className={`${tarjeta} flex flex-col p-4`}>
      <p className="mb-1 text-[11px] uppercase tracking-wider text-ink-3">{a.categoria}</p>
      <h2 className="font-medium leading-snug text-ink">{a.nombre}</h2>
      <p className="text-xs text-ink-3">por {a.unidad}</p>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xl font-semibold">{a.precioReferencia !== null ? money(a.precioReferencia) : 'Sin precio'}</p>
          <p className="text-xs text-ink-3">
            {a.ofertas.length === 0 && 'sin ofertas vigentes'}
            {unaTienda && a.ofertas[0].tienda}
            {a.ofertas.length > 1 && `mediana de ${a.ofertas.length} ofertas`}
          </p>
        </div>
        {a.ofertas.length > 1 && a.precioMin !== null && a.precioMax !== null && (
          <p className="tabular text-right font-mono text-xs text-ink-2">
            {money(a.precioMin)} – {money(a.precioMax)}
          </p>
        )}
      </div>

      {a.ofertas.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs text-accent">
            {a.ofertas.length === 1 ? 'Ver la oferta' : `Ver las ${a.ofertas.length} ofertas`}
          </summary>
          <ul className="mt-2 divide-y divide-line">
            {a.ofertas.map((o) => (
              <li key={o.productoTiendaId} className="flex items-start justify-between gap-3 py-1.5">
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-ink">{o.tienda}</span>
                  <span className="block text-xs text-ink-3">{o.producto}</span>
                </span>
                <span className="text-right">
                  <span className="tabular block font-mono text-xs">{money(o.precioConIva)}</span>
                  {o.conIva === false && <span className="block text-[10px] text-ink-3">neto {money(o.precio)} + IVA</span>}
                  {o.conIva === null && <span className="block text-[10px] text-ink-3">IVA no indicado</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-ink-3">Actualizado el {fecha(a.actualizadoEn)}</p>
        </details>
      )}

      {destinos.length > 0 && a.precioReferencia !== null && (
        <form action={agregarDesdeCatalogo} className="mt-auto flex flex-wrap items-end gap-2 border-t border-line pt-3">
          <input type="hidden" name="articuloId" value={a.articuloId} />
          <input type="hidden" name="volverA" value={volverA} />
          <div className="min-w-0 flex-1">
            <label htmlFor={`programa-${a.articuloId}`} className="sr-only">Programa</label>
            <select id={`programa-${a.articuloId}`} name="programaId" defaultValue={preseleccion} className={`${campo} text-xs`}>
              {destinos.map((d) => <option key={d.programaId} value={d.programaId}>{d.programa}</option>)}
            </select>
          </div>
          <div className="w-20">
            <label htmlFor={`cantidad-${a.articuloId}`} className="sr-only">Cantidad</label>
            <input id={`cantidad-${a.articuloId}`} name="cantidad" type="number" min={1} step={1} defaultValue={1}
              required className={`${campo} tabular text-right font-mono`} />
          </div>
          <button className={`${boton.primario} px-3 py-1.5`}>Agregar</button>
        </form>
      )}
    </article>
  );
}
