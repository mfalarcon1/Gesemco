import { IconoOk } from './iconos';

export type EstadoPaso = 'hecho' | 'actual' | 'pendiente';
export type Paso = { titulo: string; detalle: string; estado: EstadoPaso };

/**
 * Las etapas del presupuesto, para que cada persona vea dónde va y qué sigue.
 * El estado de cada paso también va en palabras (en `detalle`): el color y el
 * ícono solo acompañan.
 */
export function Pasos({ pasos }: { pasos: Paso[] }) {
  return (
    <ol aria-label="Etapas del presupuesto" className="grid gap-3 md:grid-cols-3">
      {pasos.map((p, i) => (
        <li
          key={p.titulo}
          aria-current={p.estado === 'actual' ? 'step' : undefined}
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 ${
            p.estado === 'actual' ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
          }`}
        >
          <span
            className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
              p.estado === 'pendiente' ? 'border-2 border-line-strong text-ink-2' : 'bg-accent text-paper'
            }`}
          >
            {p.estado === 'hecho' ? <IconoOk className="size-4" /> : i + 1}
          </span>
          <span className="min-w-0">
            <b className={`block font-semibold ${p.estado === 'pendiente' ? 'text-ink-2' : 'text-ink'}`}>{p.titulo}</b>
            <span className={`block text-sm ${p.estado === 'actual' ? 'text-accent-ink' : 'text-ink-2'}`}>{p.detalle}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
