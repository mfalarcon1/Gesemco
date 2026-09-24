import Link from 'next/link';
import Form from 'next/form';
import { Encabezado, SinDatos } from '@/components/encabezado';
import { Aviso, leerAviso } from '@/components/aviso';
import { EstadoPresupuestoPildora } from '@/components/pildoras';
import { SelectorPrograma } from '@/components/selector-programa';
import { CampoCantidad } from '@/components/campos';
import { IconoBuscar, IconoMas, IconoOk, IconoVolver } from '@/components/iconos';
import { boton, campo, tarjeta, tituloPagina } from '@/components/ui';
import { getSesion } from '@/lib/sesion';
import {
  buscarCatalogo, cantidadesEnPrograma, categorias, destinosDelJefe, productosSinClasificar,
  type ArticuloCatalogo,
} from '@/lib/catalogo';
import { fecha, money, plural } from '@/lib/formato';
import { agregarDesdeCatalogo } from '../formulacion/acciones';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function Catalogo({ searchParams }: Props) {
  const sesion = await getSesion();
  if (!sesion) return <SinDatos />;

  const params = await searchParams;
  const q = uno(params.q).trim().slice(0, 80);
  const categoriaId = Number(uno(params.categoria)) || undefined;
  const aviso = await leerAviso(params);

  const [lista, cats, destinos, sinClasificar] = await Promise.all([
    buscarCatalogo({ q, categoriaId }),
    categorias(),
    destinosDelJefe(sesion),
    sesion.veTodoElColegio ? productosSinClasificar() : Promise.resolve(0),
  ]);

  // El programa al que se agrega: el pedido en la URL si es del jefe; si no, el primero.
  const pedido = Number(uno(params.programa)) || undefined;
  const destino = destinos.programas.find((d) => d.programaId === pedido) ?? destinos.programas[0];
  const puedeAgregar = Boolean(sesion.jefeDe) && destinos.editable && destino !== undefined;
  const yaEnPrograma = puedeAgregar ? await cantidadesEnPrograma(destino.programaId) : new Map<number, number>();

  // Para volver a esta misma búsqueda (y al mismo programa) después de agregar.
  const consulta = (cambios: { q?: string; categoria?: number | null; programa?: number | null } = {}) => {
    const p = new URLSearchParams();
    const texto = cambios.q === undefined ? q : cambios.q;
    if (texto) p.set('q', texto);
    const cat = cambios.categoria === undefined ? categoriaId : cambios.categoria;
    if (cat) p.set('categoria', String(cat));
    const prog = cambios.programa === undefined ? (puedeAgregar ? destino.programaId : undefined) : cambios.programa;
    if (prog) p.set('programa', String(prog));
    return `/catalogo${p.size ? `?${p}` : ''}`;
  };
  const categoriaActual = cats.find((c) => c.id === categoriaId);

  return (
    <>
      <Encabezado sesion={sesion} activo="catalogo" />
      <Aviso {...aviso} />
      <main className="mx-auto max-w-6xl px-5 pb-24 pt-8">
        <h1 className={tituloPagina}>Catálogo</h1>
        <p className="mb-6 mt-2 max-w-3xl text-[17px] text-ink-2">
          Precios de tiendas de útiles y materiales, con IVA. Si un artículo está en varias tiendas, usamos el precio
          del medio: ni el más barato ni el más caro. Al agregarlo a un presupuesto, ese precio queda fijo.
        </p>

        {sesion.jefeDe && sesion.anioFormulacion && (
          <div className="z-20 mb-6 md:sticky md:top-[61px]">
            <div className={`${tarjeta} flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 shadow-sm`}>
              {!destinos.editable ? (
                <p className="flex flex-wrap items-center gap-2 text-ink">
                  Tu presupuesto {sesion.anioFormulacion.anio} está <EstadoPresupuestoPildora estado={destinos.estado} />
                  <span className="text-ink-2">Por ahora el catálogo es solo de consulta.</span>
                </p>
              ) : !puedeAgregar ? (
                <>
                  <p className="min-w-0 flex-1 text-ink">Para agregar artículos, primero crea un programa en tu presupuesto.</p>
                  <Link href={`/formulacion/${sesion.jefeDe.id}`} className={boton.primario}>Ir a mi presupuesto</Link>
                </>
              ) : (
                <>
                  <SelectorPrograma programas={destinos.programas} elegido={destino.programaId} q={q} categoria={categoriaId} />
                  <Link href={`/formulacion/${sesion.jefeDe.id}#programa-${destino.programaId}`} className={boton.secundario}>
                    <IconoVolver className="size-4" />Listo, volver a mi presupuesto
                  </Link>
                </>
              )}
            </div>
          </div>
        )}

        <Form action="/catalogo" role="search" className="mb-4 flex flex-wrap gap-3">
          {categoriaId && <input type="hidden" name="categoria" value={categoriaId} />}
          {puedeAgregar && <input type="hidden" name="programa" value={destino.programaId} />}
          <div className="relative min-w-[16rem] flex-1">
            <label htmlFor="q" className="sr-only">Buscar un artículo</label>
            <IconoBuscar className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-2" />
            <input id="q" name="q" type="search" defaultValue={q} className={`${campo} min-h-12 pl-12 text-[17px]`}
              placeholder="Busca un artículo: témpera, cuaderno, tóner…" />
          </div>
          <button className={`${boton.primario} min-h-12 px-6`}>Buscar</button>
        </Form>

        <nav aria-label="Categorías" className="mb-6 flex flex-wrap gap-2">
          {[{ id: undefined as number | undefined, nombre: 'Todas' }, ...cats].map((c) => {
            const activa = c.id === categoriaId;
            return (
              <Link key={c.nombre} href={consulta({ categoria: c.id ?? null })} aria-current={activa ? 'page' : undefined}
                className={`rounded-full border px-4 py-2 text-[15px] font-medium transition-colors ${
                  activa ? 'border-accent bg-accent text-paper' : 'border-line-strong bg-surface text-ink hover:border-accent hover:bg-accent-soft'
                }`}>
                {c.nombre}
              </Link>
            );
          })}
        </nav>

        <p className="mb-4 text-[15px] text-ink-2" aria-live="polite">
          {plural(lista.length, 'artículo', 'artículos')}
          {q && <> para “<b className="font-semibold text-ink">{q}</b>”</>}
          {categoriaActual && <> en {categoriaActual.nombre}</>}
          {(q || categoriaActual) && (
            <> · <Link href={consulta({ q: '', categoria: null })}
              className="font-medium text-accent hover:underline">Ver todo el catálogo</Link></>
          )}
          {sinClasificar > 0 && ` · ${plural(sinClasificar, 'producto de tienda', 'productos de tiendas')} todavía sin asociar a un artículo`}
        </p>

        {lista.length === 0 ? (
          <div className={`${tarjeta} px-6 py-10 text-center`}>
            <p className="text-lg font-semibold">No encontramos artículos{q ? ` para “${q}”` : ''}.</p>
            <p className="mx-auto mt-2 max-w-xl text-ink-2">
              Prueba con otra palabra. Si es un servicio o algo que las tiendas no venden, agrégalo a mano en tu programa.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {lista.map((a) => (
              <TarjetaArticulo key={a.articuloId} articulo={a}
                destino={puedeAgregar ? destino.programaId : undefined}
                yaTiene={yaEnPrograma.get(a.articuloId) ?? 0}
                volverA={consulta()} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function TarjetaArticulo({
  articulo: a, destino, yaTiene, volverA,
}: { articulo: ArticuloCatalogo; destino?: number; yaTiene: number; volverA: string }) {
  const ofertas = a.ofertas.length;
  const origen =
    ofertas === 0 ? 'Sin ofertas vigentes'
      : ofertas === 1 ? a.ofertas[0].tienda
        : `Precio del medio entre ${ofertas} ofertas`;

  return (
    <article id={`articulo-${a.articuloId}`} className={`${tarjeta} flex flex-col p-5`}>
      {/* La información crece y empuja el formulario al fondo: todas las tarjetas lo tienen a la misma altura. */}
      <div className="flex flex-1 flex-col pb-4">
        <p className="text-[13px] font-medium text-ink-2">{a.categoria}</p>
        <h2 className="mt-1 text-[17px] font-semibold leading-snug text-ink">{a.nombre}</h2>
        <p className="text-sm text-ink-2">por {a.unidad}</p>

        <p className="mt-3 text-2xl font-semibold tracking-tight">
          {a.precioReferencia !== null ? money(a.precioReferencia) : 'Sin precio'}
        </p>
        <p className="text-sm text-ink-2">
          {origen}
          {ofertas > 1 && a.precioMin !== null && a.precioMax !== null && ` · de ${money(a.precioMin)} a ${money(a.precioMax)}`}
        </p>

        {yaTiene > 0 && (
          <p className="mt-3 inline-flex items-center gap-1.5 self-start rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent-ink">
            <IconoOk className="size-4" />Ya tienes {yaTiene} en este programa
          </p>
        )}

        {ofertas > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-accent">
              {ofertas === 1 ? 'Ver la tienda' : `Ver las ${ofertas} ofertas`}
            </summary>
            <ul className="mt-2 divide-y divide-line">
              {a.ofertas.map((o) => (
                <li key={o.productoTiendaId} className="flex items-start justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{o.tienda}</span>
                    <span className="block text-[13px] text-ink-2">{o.producto}</span>
                  </span>
                  <span className="text-right">
                    <span className="tabular block text-sm">{money(o.precioConIva)}</span>
                    {o.conIva === false && <span className="block text-[13px] text-ink-2">neto {money(o.precio)} + IVA</span>}
                    {o.conIva === null && <span className="block text-[13px] text-ink-2">IVA no indicado</span>}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[13px] text-ink-2">Precios vistos el {fecha(a.actualizadoEn)}</p>
          </details>
        )}
      </div>

      {destino !== undefined && a.precioReferencia !== null && (
        <form action={agregarDesdeCatalogo} className="flex items-end gap-2 border-t border-line pt-4">
          <input type="hidden" name="articuloId" value={a.articuloId} />
          <input type="hidden" name="programaId" value={destino} />
          <input type="hidden" name="volverA" value={volverA} />
          <CampoCantidad id={`cantidad-${a.articuloId}`} name="cantidad" etiqueta={a.nombre} />
          <button className={`${boton.primario} flex-1`}>
            <IconoMas className="size-4" />Agregar
          </button>
        </form>
      )}
    </article>
  );
}
