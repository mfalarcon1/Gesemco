import { anularPedido, confirmarRecepcion } from '@/app/ejecucion/acciones';
import { BotonConConfirmacion } from './confirmar';
import { EstadoPedidoPildora, NoPlanificado } from './pildoras';
import { IconoAlerta, IconoOk } from './iconos';
import { boton, campo } from './ui';
import type { Pedido } from '@/lib/ejecucion';
import { conSigno, fecha, fechaCorta, money } from '@/lib/formato';

/**
 * Los pedidos de un departamento, cada uno con lo que pasó y lo que falta.
 * Con `acciones` (el jefe), los que están por comprar se pueden anular, los
 * que esperan a Dirección retirar y los comprados confirmar cuando llegan.
 * Con `verReal` (Dirección y contabilidad), lo pagado y su diferencia.
 */
export function ListaPedidos({
  pedidos, departamentoId, acciones, verReal,
}: { pedidos: Pedido[]; departamentoId: number; acciones: boolean; verReal: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {pedidos.map((p) => (
        <li key={p.ordenId} id={`pedido-${p.ordenId}`} className="scroll-mt-28 px-6 py-4">
          <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
            <div className="min-w-[15rem] flex-1">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold text-ink">{p.detalle}</span>
                <EstadoPedidoPildora estado={p.estado} />
                {p.noPlanificado && <NoPlanificado />}
              </p>
              <p className="mt-1 text-sm text-ink-2">
                {p.folio} · pedido el {fecha(p.pedidoEn)} · <b className="font-semibold text-ink">para el {fechaCorta(p.necesariaPara)}</b>
              </p>
              {p.observacion && <p className="mt-1 text-[15px] text-ink-2">“{p.observacion}”</p>}
              <Situacion pedido={p} />
            </div>
            <div className="text-right">
              <p className="tabular text-lg font-semibold">{money(p.monto)}</p>
              {verReal && p.pagado !== null && (
                <p className="tabular text-sm text-ink-2">
                  Pagado {money(p.pagado)}{p.diferencia ? ` (${conSigno(p.diferencia)})` : ''}
                </p>
              )}
            </div>
          </div>

          {acciones && <Acciones pedido={p} departamentoId={departamentoId} />}
        </li>
      ))}
    </ul>
  );
}

/** Cierra una frase con punto, sin duplicarlo si ya termina en uno ("Ltda."). */
const conPunto = (t: string) => (t.endsWith('.') ? t : `${t}.`);

/** Lo que pasó con el pedido, en una frase. */
function Situacion({ pedido: p }: { pedido: Pedido }) {
  const linea = 'mt-2 flex items-start gap-1.5 text-[15px]';
  switch (p.estado) {
    case 'pendiente_direccion':
      return (
        <p className={`${linea} text-warn`}>
          <IconoAlerta className="mt-0.5 size-4 shrink-0" />
          No cupo: faltaban {money(p.montoExcedido)}. Espera que Dirección decida si extiende el presupuesto.
        </p>
      );
    case 'emitida':
      return (
        <p className={`${linea} text-ink-2`}>
          {p.extension
            ? `Dirección extendió el presupuesto en ${money(p.extension)}. Está en la lista del equipo de compra.`
            : 'Está en la lista del equipo de compra.'}
        </p>
      );
    case 'comprada':
      return (
        <p className={`${linea} text-ink-2`}>
          {conPunto(`Comprado el ${fecha(p.fechaCompra)}${p.proveedor ? ` a ${p.proveedor}` : ''}`)} Falta confirmar que llegó.
        </p>
      );
    case 'recibida':
      return p.conforme === false ? (
        <p className={`${linea} text-warn`}>
          <IconoAlerta className="mt-0.5 size-4 shrink-0" />
          Llegó el {fecha(p.fechaRecepcion)}, con un problema: “{p.observacionRecepcion}”
        </p>
      ) : (
        <p className={`${linea} text-ok`}>
          <IconoOk className="mt-0.5 size-4 shrink-0" />Llegó el {fecha(p.fechaRecepcion)}.
          {p.extension ? <span className="text-ink-2"> Dirección extendió el presupuesto en {money(p.extension)}.</span> : null}
        </p>
      );
    case 'denegada':
      return (
        <div className={`${linea} text-ink`}>
          <IconoAlerta className="mt-0.5 size-4 shrink-0 text-bad" />
          <p>Dirección lo denegó el {fecha(p.resueltoEn)}: <span className="text-ink-2">“{p.explicacion}”</span></p>
        </div>
      );
    case 'anulada':
      return (
        <p className={`${linea} text-ink-2`}>
          {p.estadoSolicitud === 'retirado' ? 'Se retiró antes de que Dirección lo resolviera.' : 'Se anuló antes de comprarlo.'}
        </p>
      );
    default:
      return null;
  }
}

function Acciones({ pedido: p, departamentoId }: { pedido: Pedido; departamentoId: number }) {
  const ocultos = (
    <>
      <input type="hidden" name="departamentoId" value={departamentoId} />
      <input type="hidden" name="ordenId" value={p.ordenId} />
    </>
  );

  if (p.estado === 'comprada') {
    return (
      <form action={confirmarRecepcion} className="mt-3 rounded-xl border border-accent/40 bg-accent-soft/40 p-4">
        {ocultos}
        <p className="font-semibold text-ink">¿Ya llegó?</p>
        <details className="mt-2">
          <summary className="cursor-pointer text-[15px] font-medium text-accent">Llegó incompleto o con algún problema</summary>
          <label htmlFor={`problema-${p.ordenId}`} className="mt-2 block text-sm text-ink-2">
            Cuenta qué pasó. Contabilidad y el equipo de compra lo verán.
          </label>
          <textarea id={`problema-${p.ordenId}`} name="problema" rows={2} maxLength={500} className={`${campo} mt-1`}
            placeholder="Por ejemplo: llegaron 25 de las 30 témperas" />
        </details>
        <button className={`${boton.primario} mt-3`}>Confirmar que llegó</button>
      </form>
    );
  }

  if (p.estado === 'emitida' || p.estado === 'pendiente_direccion') {
    const retirar = p.estado === 'pendiente_direccion';
    return (
      <form action={anularPedido} className="mt-2">
        {ocultos}
        <BotonConConfirmacion
          texto={retirar ? 'Retirar pedido' : 'Anular pedido'}
          pregunta={retirar ? '¿Retirar este pedido? Dirección ya no lo resolverá.' : '¿Anular este pedido? El equipo de compra ya no lo comprará.'}
          confirmar={retirar ? 'Sí, retirar' : 'Sí, anular'}
          clase={`${boton.chico} text-ink-2 hover:bg-bad-soft hover:text-bad`}
          claseConfirmar={`${boton.chico} border border-bad/40 bg-surface text-bad hover:bg-bad-soft`}
        />
      </form>
    );
  }

  return null;
}
