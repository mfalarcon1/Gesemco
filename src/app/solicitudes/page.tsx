import Link from 'next/link';
import { Encabezado, SinAcceso, SinDatos } from '@/components/encabezado';
import { Aviso, leerAviso } from '@/components/aviso';
import { BotonConConfirmacion } from '@/components/confirmar';
import { NoPlanificado } from '@/components/pildoras';
import { IconoAlerta, IconoOk } from '@/components/iconos';
import { ayuda, boton, campo, tarjeta, titulo, tituloPagina } from '@/components/ui';
import { esDireccion, getSesion } from '@/lib/sesion';
import { solicitudesPendientes, solicitudesResueltas, type Pedido, type Solicitud } from '@/lib/ejecucion';
import { fecha, fechaLarga, money } from '@/lib/formato';
import { resolverSolicitud } from '../ejecucion/acciones';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Lo que espera a Dirección: los pedidos que no cupieron en el presupuesto
 * de su departamento. Aprobar extiende el presupuesto en lo que falta y el
 * pedido pasa a compra; denegar le explica al jefe por qué.
 */
export default async function Solicitudes({ searchParams }: Props) {
  const sesion = await getSesion();
  if (!sesion) return <SinDatos />;

  if (!esDireccion(sesion) || !sesion.anioEjecucion) {
    return (
      <>
        <Encabezado sesion={sesion} activo="solicitudes" />
        <SinAcceso mensaje="Las solicitudes para extender un presupuesto las resuelve Dirección." />
      </>
    );
  }

  const anioE = sesion.anioEjecucion;
  const [pendientes, resueltas] = await Promise.all([
    solicitudesPendientes(sesion.colegio.id, anioE.id),
    solicitudesResueltas(sesion.colegio.id, anioE.id),
  ]);
  const aviso = await leerAviso(await searchParams);

  return (
    <>
      <Encabezado sesion={sesion} activo="solicitudes" />
      <Aviso {...aviso} />
      <main className="mx-auto max-w-5xl px-5 pb-24 pt-8">
        <h1 className={tituloPagina}>Solicitudes para extender un presupuesto</h1>
        <p className="mb-6 mt-2 max-w-3xl text-[17px] text-ink-2">
          Cuando un jefe pide algo que no cabe en lo que le queda de su presupuesto {anioE.anio}, el pedido espera aquí. Si
          lo apruebas, su presupuesto sube en lo que falta y el pedido pasa al equipo de compra; si lo deniegas, el jefe
          recibe tu explicación. Mientras esperan, no descuentan nada.
        </p>

        {pendientes.length === 0 ? (
          <p className={`${tarjeta} flex items-center gap-3 px-6 py-8 text-ink-2`}>
            <IconoOk className="size-5 shrink-0 text-ok" />No hay solicitudes esperando tu decisión.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {pendientes.map((s) => <TarjetaSolicitud key={s.ordenId} solicitud={s} />)}
          </div>
        )}

        {resueltas.length > 0 && (
          <section aria-labelledby="resueltas" className="mt-12">
            <h2 id="resueltas" className={`${titulo} mb-4`}>Resueltas</h2>
            <ul className={`${tarjeta} divide-y divide-line`}>
              {resueltas.map((r) => <Resuelta key={r.ordenId} pedido={r} />)}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}

function TarjetaSolicitud({ solicitud: s }: { solicitud: Solicitud }) {
  const ocultos = <input type="hidden" name="pendienteId" value={s.pendienteId ?? 0} />;
  const idExplicacion = `explicacion-${s.ordenId}`;

  return (
    <article id={`solicitud-${s.ordenId}`} className="scroll-mt-28 rounded-2xl border-2 border-warn/40 bg-surface">
      <header className="flex flex-wrap items-start gap-4 border-b border-line px-6 py-5">
        <IconoAlerta className="mt-1 size-6 shrink-0 text-warn" />
        <div className="min-w-[15rem] flex-1">
          <h2 className="font-display text-xl font-semibold">
            {s.departamento} pide extender su presupuesto en {money(s.faltaHoy)}
          </h2>
          <p className="mt-1 text-ink-2">
            {s.pedidoPor} lo pidió el {fecha(s.pedidoEn)} · pedido {s.folio}
          </p>
        </div>
        <Link href={`/ejecucion/${s.departamentoId}`} className="text-[15px] font-medium text-accent hover:underline">
          Ver el presupuesto de {s.departamento}
        </Link>
      </header>

      <div className="grid gap-x-8 gap-y-4 px-6 py-5 md:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-lg font-semibold text-ink">
            {s.detalle}{s.noPlanificado && <NoPlanificado />}
          </p>
          <p className="mt-1 text-[17px] text-ink">
            Para el <b className="font-semibold">{fechaLarga(s.necesariaPara)}</b>: {money(s.monto)}
          </p>
          {s.montoExcedido !== null && s.montoExcedido !== s.faltaHoy && (
            <p className="mt-1 text-[15px] text-ink-2">
              Al pedirlo faltaban {money(s.montoExcedido)}; desde entonces cambió lo que le queda al departamento.
            </p>
          )}
          {s.observacion && (
            <blockquote className="mt-3 border-l-4 border-line-strong pl-4 text-ink-2">“{s.observacion}”</blockquote>
          )}
        </div>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 self-start rounded-xl bg-surface-2 px-5 py-4 text-[15px]">
          <dt className="text-ink-2">Presupuesto vigente</dt><dd className="tabular text-right">{money(s.vigente)}</dd>
          <dt className="text-ink-2">Le queda hoy</dt><dd className="tabular text-right">{money(s.disponible)}</dd>
          <dt className="text-ink-2">El pedido cuesta</dt><dd className="tabular text-right">{money(s.monto)}</dd>
          <dt className="border-t border-line pt-1.5 font-semibold">Falta</dt>
          <dd className="tabular border-t border-line pt-1.5 text-right font-semibold">{money(s.faltaHoy)}</dd>
        </dl>
      </div>

      <div className="grid gap-4 border-t border-line px-6 py-5 md:grid-cols-2">
        <form action={resolverSolicitud} className="flex flex-col gap-3 rounded-xl border border-line p-5">
          {ocultos}
          <input type="hidden" name="decision" value="aprobar" />
          <h3 className="flex items-center gap-2 text-lg font-semibold"><IconoOk className="size-5 text-ok" />Aprobar</h3>
          <p className="text-ink-2">
            {s.faltaHoy > 0
              ? `El presupuesto de ${s.departamento} sube ${money(s.faltaHoy)}, a ${money(s.vigente + s.faltaHoy)}. Queda registrado y el aprobado original se conserva. El pedido pasa a compra.`
              : `Ya cabe en lo que le queda: pasa a compra sin extender el presupuesto.`}
          </p>
          <div className="mt-auto pt-2">
            <BotonConConfirmacion
              texto={s.faltaHoy > 0 ? `Aprobar y extender en ${money(s.faltaHoy)}` : 'Aprobar'}
              pregunta="¿Confirmas la aprobación?"
              confirmar="Sí, aprobar"
              clase={boton.primario}
              claseConfirmar={boton.primario}
              enfocar="confirmar"
            />
          </div>
        </form>
        <form action={resolverSolicitud} className="flex flex-col gap-3 rounded-xl border border-line p-5">
          {ocultos}
          <input type="hidden" name="decision" value="denegar" />
          <h3 className="flex items-center gap-2 text-lg font-semibold"><IconoAlerta className="size-5 text-warn" />Denegar</h3>
          <label htmlFor={idExplicacion} className="text-ink-2">
            El pedido no se compra. Escríbele al jefe por qué; le llegará como aviso.
          </label>
          <textarea id={idExplicacion} name="explicacion" required rows={3} maxLength={1000} className={campo}
            placeholder="Por ejemplo: esta compra entra en el presupuesto del próximo año." />
          <div className="mt-auto pt-2">
            <button className={boton.secundario}>Denegar con explicación</button>
          </div>
        </form>
      </div>
    </article>
  );
}

function Resuelta({ pedido: p }: { pedido: Pedido }) {
  const texto = p.estadoSolicitud === 'aprobado'
    ? (p.extension ? `Aprobada: el presupuesto subió ${money(p.extension)}` : 'Aprobada: ya cabía')
    : p.estadoSolicitud === 'denegado' ? 'Denegada' : 'Retirada por el jefe';
  return (
    <li className="flex flex-wrap items-start gap-x-6 gap-y-1 px-6 py-4">
      <div className="min-w-[15rem] flex-1">
        <p className="font-semibold">{p.departamento} · <span className="font-normal text-ink-2">{p.detalle}</span></p>
        <p className={ayuda}>
          {texto} el {fecha(p.resueltoEn)} · pedido {p.folio}
        </p>
        {p.estadoSolicitud === 'denegado' && p.explicacion && (
          <p className="mt-1 text-[15px] text-ink-2">“{p.explicacion}”</p>
        )}
      </div>
      <p className="tabular font-semibold">{money(p.monto)}</p>
    </li>
  );
}
