import { Encabezado, SinAcceso, SinDatos } from '@/components/encabezado';
import { Aviso, leerAviso } from '@/components/aviso';
import { RegistrarCompra } from '@/components/registrar-compra';
import { NoPlanificado } from '@/components/pildoras';
import { IconoAlerta, IconoOk, IconoReloj } from '@/components/iconos';
import { ayuda, tarjeta, titulo, tituloPagina } from '@/components/ui';
import { esEquipoCompra, getSesion } from '@/lib/sesion';
import { pedidos, type Pedido } from '@/lib/ejecucion';
import { conSigno, diasEntre, fecha, fechaCorta, hoyEnChile, money, plazo, plural } from '@/lib/formato';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Lo que tiene que comprar el equipo de compra: los pedidos que pasaron a
 * orden de compra, primero los que se necesitan antes. Al comprar se anota
 * el proveedor, el documento y lo que se pagó de verdad.
 */
export default async function Compras({ searchParams }: Props) {
  const sesion = await getSesion();
  if (!sesion) return <SinDatos />;

  if (!esEquipoCompra(sesion) || !sesion.anioEjecucion) {
    return (
      <>
        <Encabezado sesion={sesion} activo="compras" />
        <SinAcceso mensaje="La lista de compras es del equipo de compra." />
      </>
    );
  }

  const anioE = sesion.anioEjecucion;
  const filtro = { colegioId: sesion.colegio.id, anioId: anioE.id };
  const [porComprar, comprados, recibidos] = await Promise.all([
    pedidos({ ...filtro, estados: ['emitida'], orden: 'urgente' }),
    pedidos({ ...filtro, estados: ['comprada'], orden: 'urgente' }),
    pedidos({ ...filtro, estados: ['recibida'], limite: 10 }),
  ]);
  const aviso = await leerAviso(await searchParams);
  const hoy = hoyEnChile();
  const urgentes = porComprar.filter((p) => diasEntre(hoy, p.necesariaPara) <= 3).length;

  return (
    <>
      <Encabezado sesion={sesion} activo="compras" />
      <Aviso {...aviso} />
      <main className="mx-auto max-w-5xl px-5 pb-24 pt-8">
        <h1 className={tituloPagina}>Compras</h1>
        <p className="mb-6 mt-2 max-w-3xl text-[17px] text-ink-2">
          Las órdenes de compra de todo el colegio, ordenadas por la fecha en que se necesitan: arriba lo más urgente. Al
          comprar, anota el proveedor, la factura o boleta y cuánto se pagó; el jefe del departamento confirma cuando llega.
        </p>

        <section aria-labelledby="por-comprar">
          <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 id="por-comprar" className={titulo}>Por comprar</h2>
            <p className={ayuda}>
              {porComprar.length === 0 ? 'Nada pendiente.'
                : `${plural(porComprar.length, 'orden', 'órdenes')} · ${money(porComprar.reduce((s, p) => s + p.monto, 0))} presupuestado`}
              {urgentes > 0 && ` · ${urgentes === 1 ? '1 se necesita' : `${urgentes} se necesitan`} en 3 días o menos`}
            </p>
          </div>
          {porComprar.length === 0 ? (
            <p className={`${tarjeta} flex items-center gap-3 px-6 py-8 text-ink-2`}>
              <IconoOk className="size-5 shrink-0 text-ok" />No hay órdenes por comprar. Cuando un jefe haga un pedido que cabe en su presupuesto, aparecerá aquí.
            </p>
          ) : (
            <ul className={`${tarjeta} divide-y divide-line overflow-hidden`}>
              {porComprar.map((p) => <OrdenPorComprar key={p.ordenId} pedido={p} hoy={hoy} />)}
            </ul>
          )}
        </section>

        <section aria-labelledby="comprados" className="mt-12">
          <h2 id="comprados" className={`${titulo} mb-1`}>Comprados, esperando que lleguen</h2>
          <p className={`${ayuda} mb-4`}>El jefe de cada departamento confirma cuando llega.</p>
          {comprados.length === 0 ? (
            <p className={`${tarjeta} px-6 py-6 text-ink-2`}>No hay compras esperando la recepción.</p>
          ) : (
            <ul className={`${tarjeta} divide-y divide-line`}>
              {comprados.map((p) => <OrdenComprada key={p.ordenId} pedido={p} />)}
            </ul>
          )}
        </section>

        {recibidos.length > 0 && (
          <details className={`${tarjeta} mt-12 overflow-hidden`}>
            <summary className="cursor-pointer px-6 py-4 text-[15px] font-semibold text-accent">
              Lo último que llegó
            </summary>
            <ul className="divide-y divide-line border-t border-line">
              {recibidos.map((p) => <OrdenComprada key={p.ordenId} pedido={p} />)}
            </ul>
          </details>
        )}
      </main>
    </>
  );
}

/** Cuánto falta para la fecha en que se necesita: en palabras, con ícono si urge. */
function Plazo({ hoy, para }: { hoy: string; para: string }) {
  const n = diasEntre(hoy, para);
  const texto = plazo(hoy, para);
  if (n < 0) return <span className="inline-flex items-center gap-1 font-semibold text-bad"><IconoAlerta className="size-4" />{texto}</span>;
  if (n <= 3) return <span className="inline-flex items-center gap-1 font-semibold text-warn"><IconoReloj className="size-4" />{texto}</span>;
  return <span className="text-ink-2">{texto}</span>;
}

function OrdenPorComprar({ pedido: p, hoy }: { pedido: Pedido; hoy: string }) {
  const urge = diasEntre(hoy, p.necesariaPara) <= 3;
  return (
    <li id={`orden-${p.ordenId}`} className={`scroll-mt-28 px-6 py-4 ${urge ? 'bg-warn-soft/50' : ''}`}>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="w-28 shrink-0">
          <p className="text-sm text-ink-2">Se necesita</p>
          <p className="text-lg font-semibold text-ink">{fechaCorta(p.necesariaPara)}</p>
          <p className="text-sm"><Plazo hoy={hoy} para={p.necesariaPara} /></p>
        </div>
        <div className="min-w-[14rem] flex-1">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold text-ink">{p.detalle}</span>
            {p.noPlanificado && <NoPlanificado />}
          </p>
          <p className="mt-0.5 text-[15px] text-ink-2">
            {p.departamento} · {p.folio} · pedido por {p.pedidoPor} el {fecha(p.pedidoEn)}
          </p>
          {p.observacion && <p className="mt-1 text-[15px] text-ink">“{p.observacion}”</p>}
          {p.cuenta && <p className="mt-1 text-sm text-ink-3">Cuenta {p.cuenta} · centro de costo {p.centroCosto ?? '—'}</p>}
        </div>
        <p className="sm:text-right">
          <span className="block text-sm text-ink-2">Presupuestado</span>
          <span className="tabular block text-lg font-semibold">{money(p.monto)}</span>
        </p>
        {/* El formulario se abre debajo, a todo el ancho (order-last basis-full). */}
        <RegistrarCompra key={`${p.ordenId}-${p.estado}`} ordenId={p.ordenId} folio={p.folio} presupuestado={p.monto} hoy={hoy} />
      </div>
    </li>
  );
}

function OrdenComprada({ pedido: p }: { pedido: Pedido }) {
  return (
    <li className="flex flex-wrap items-start gap-x-6 gap-y-1 px-6 py-4">
      <div className="min-w-[15rem] flex-1">
        <p className="font-semibold text-ink">{p.detalle}</p>
        <p className="text-[15px] text-ink-2">
          {p.departamento} · {p.folio} · comprado el {fecha(p.fechaCompra)}{p.proveedor ? ` a ${p.proveedor}` : ''}
          {p.documento ? ` · ${p.documento}` : ''}
        </p>
        {p.estado === 'recibida' && (
          <p className={`mt-0.5 text-[15px] ${p.conforme === false ? 'text-warn' : 'text-ok'}`}>
            {p.conforme === false ? `Llegó el ${fecha(p.fechaRecepcion)}, con un problema: “${p.observacionRecepcion}”` : `Llegó el ${fecha(p.fechaRecepcion)}`}
          </p>
        )}
      </div>
      <p className="text-right">
        <span className="tabular block font-semibold">{money(p.pagado)}</span>
        <span className="block text-sm text-ink-2">
          {p.diferencia ? `${conSigno(p.diferencia)} sobre lo presupuestado` : 'igual a lo presupuestado'}
        </span>
      </p>
    </li>
  );
}
