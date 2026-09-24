/**
 * Íconos mínimos en SVG. Los colores de estado (ok, warn, bad) siempre van
 * con ícono y texto: el color solo nunca es la única señal.
 */
type Props = { className?: string };

const base = {
  width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const, 'aria-hidden': true,
};

export function IconoOk({ className }: Props) {
  return <svg {...base} className={className}><path d="M3.5 8.5l3 3 6-7" /></svg>;
}

export function IconoAlerta({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M8 2.5l6 11H2l6-11z" /><path d="M8 7v2.5" /><path d="M8 11.6v.1" />
    </svg>
  );
}

export function IconoInfo({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <circle cx="8" cy="8" r="6" /><path d="M8 7.2V11" /><path d="M8 5v.1" />
    </svg>
  );
}

export function IconoReloj({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <circle cx="8" cy="8" r="6" /><path d="M8 4.8V8l2.2 1.5" />
    </svg>
  );
}
