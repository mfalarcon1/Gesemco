import { IconoAlerta, IconoOk, IconoReloj } from './iconos';
import {
  NOMBRE_ESTADO, NOMBRE_ESTADO_PEDIDO, type EstadoPedido, type EstadoPresupuesto,
} from '@/lib/estados';

const pildora = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-semibold leading-none';

export function EstadoPresupuestoPildora({ estado }: { estado: EstadoPresupuesto | null }) {
  switch (estado) {
    case null:
      return <span className={`${pildora} border border-line text-ink-3`}>{NOMBRE_ESTADO.sin_iniciar}</span>;
    case 'borrador':
      return <span className={`${pildora} bg-surface-2 text-ink-2`}>{NOMBRE_ESTADO.borrador}</span>;
    case 'enviado':
    case 'revision_contabilidad':
      return (
        <span className={`${pildora} bg-accent-soft text-accent-ink`}>
          <IconoReloj className="size-4" />{NOMBRE_ESTADO[estado]}
        </span>
      );
    case 'devuelto':
    case 'con_reparos':
      return (
        <span className={`${pildora} bg-warn-soft text-warn`}>
          <IconoAlerta className="size-4" />{NOMBRE_ESTADO[estado]}
        </span>
      );
    case 'aprobado':
      return (
        <span className={`${pildora} bg-ok-soft text-ok`}>
          <IconoOk className="size-4" />{NOMBRE_ESTADO.aprobado}
        </span>
      );
  }
}

const PEDIDO: Record<EstadoPedido, { clase: string; icono?: 'ok' | 'alerta' | 'reloj' }> = {
  borrador: { clase: 'bg-surface-2 text-ink-2' },
  pendiente_direccion: { clase: 'bg-warn-soft text-warn', icono: 'alerta' },
  emitida: { clase: 'bg-accent-soft text-accent-ink', icono: 'reloj' },
  denegada: { clase: 'bg-bad-soft text-bad', icono: 'alerta' },
  comprada: { clase: 'bg-accent-soft text-accent-ink', icono: 'ok' },
  recibida: { clase: 'bg-ok-soft text-ok', icono: 'ok' },
  anulada: { clase: 'border border-line text-ink-3' },
};

/** El estado de un pedido, en palabras y con ícono: el color nunca va solo. */
export function EstadoPedidoPildora({ estado }: { estado: EstadoPedido }) {
  const e = PEDIDO[estado];
  return (
    <span className={`${pildora} ${e.clase}`}>
      {e.icono === 'ok' && <IconoOk className="size-4" />}
      {e.icono === 'alerta' && <IconoAlerta className="size-4" />}
      {e.icono === 'reloj' && <IconoReloj className="size-4" />}
      {NOMBRE_ESTADO_PEDIDO[estado]}
    </span>
  );
}

/** Marca neutra: el pedido no estaba en el presupuesto del departamento. */
export function NoPlanificado() {
  return (
    <span className="whitespace-nowrap rounded-full border border-line-strong px-2 py-0.5 text-[13px] font-medium text-ink-2">
      Fuera del presupuesto
    </span>
  );
}

/** Marca neutra: el ítem no viene del catálogo (un servicio, algo sin precio de tienda). */
export function FueraDeCatalogo() {
  return (
    <span className="whitespace-nowrap rounded-full border border-line-strong px-2 py-0.5 text-[13px] font-medium text-ink-2">
      Fuera del catálogo
    </span>
  );
}
