import { IconoAlerta, IconoOk, IconoReloj } from './iconos';
import { NOMBRE_ESTADO, type EstadoPresupuesto } from '@/lib/estados';

const pildora = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-semibold leading-none';

export function EstadoPresupuestoPildora({ estado }: { estado: EstadoPresupuesto | null }) {
  switch (estado) {
    case null:
      return <span className={`${pildora} border border-line text-ink-3`}>{NOMBRE_ESTADO.sin_iniciar}</span>;
    case 'borrador':
      return <span className={`${pildora} bg-surface-2 text-ink-2`}>{NOMBRE_ESTADO.borrador}</span>;
    case 'enviado':
      return (
        <span className={`${pildora} bg-accent-soft text-accent-ink`}>
          <IconoReloj className="size-4" />{NOMBRE_ESTADO.enviado}
        </span>
      );
    case 'devuelto':
      return (
        <span className={`${pildora} bg-warn-soft text-warn`}>
          <IconoAlerta className="size-4" />{NOMBRE_ESTADO.devuelto}
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

const ORDEN: Record<string, { nombre: string; clase: string; icono?: 'ok' | 'alerta' | 'reloj' }> = {
  borrador: { nombre: 'Borrador', clase: 'bg-surface-2 text-ink-2' },
  pendiente_direccion: { nombre: 'Pendiente de Dirección', clase: 'bg-warn-soft text-warn', icono: 'alerta' },
  emitida: { nombre: 'Por comprar', clase: 'bg-accent-soft text-accent-ink', icono: 'reloj' },
  denegada: { nombre: 'Denegada', clase: 'bg-bad-soft text-bad', icono: 'alerta' },
  comprada: { nombre: 'Comprada', clase: 'bg-ok-soft text-ok', icono: 'ok' },
  recibida: { nombre: 'Recibida', clase: 'bg-ok-soft text-ok', icono: 'ok' },
  anulada: { nombre: 'Anulada', clase: 'bg-surface-2 text-ink-3' },
};

export function EstadoOrdenPildora({ estado }: { estado: string }) {
  const e = ORDEN[estado] ?? { nombre: estado, clase: 'bg-surface-2 text-ink-2' };
  return (
    <span className={`${pildora} ${e.clase}`}>
      {e.icono === 'ok' && <IconoOk className="size-4" />}
      {e.icono === 'alerta' && <IconoAlerta className="size-4" />}
      {e.icono === 'reloj' && <IconoReloj className="size-4" />}
      {e.nombre}
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
