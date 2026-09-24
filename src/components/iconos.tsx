/**
 * Íconos mínimos en SVG. Los colores de estado (ok, warn, bad) siempre van
 * con ícono y texto: el color solo nunca es la única señal. Y un ícono nunca
 * reemplaza la palabra en un botón: la acompaña.
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

export function IconoMas({ className }: Props) {
  return <svg {...base} className={className}><path d="M8 3v10" /><path d="M3 8h10" /></svg>;
}

export function IconoLapiz({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M10.5 2.8l2.7 2.7L6 12.7l-3.3.6.6-3.3 7.2-7.2z" /><path d="M9.2 4.1l2.7 2.7" />
    </svg>
  );
}

export function IconoBasura({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M2.8 4.5h10.4" /><path d="M6.3 4.5V3h3.4v1.5" /><path d="M4.2 4.5l.7 8.5h6.2l.7-8.5" />
    </svg>
  );
}

export function IconoFlecha({ className }: Props) {
  return <svg {...base} className={className}><path d="M3 8h10" /><path d="M9 4l4 4-4 4" /></svg>;
}

export function IconoVolver({ className }: Props) {
  return <svg {...base} className={className}><path d="M13 8H3" /><path d="M7 4L3 8l4 4" /></svg>;
}

export function IconoBuscar({ className }: Props) {
  return <svg {...base} className={className}><circle cx="7" cy="7" r="4.5" /><path d="M10.4 10.4L14 14" /></svg>;
}

export function IconoCalendario({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" /><path d="M2.5 6.5h11" /><path d="M5.5 2v3" /><path d="M10.5 2v3" />
    </svg>
  );
}

export function IconoDescarga({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M8 2.5v8" /><path d="M4.5 7.5L8 11l3.5-3.5" /><path d="M3 13.5h10" />
    </svg>
  );
}

export function IconoCerrar({ className }: Props) {
  return <svg {...base} className={className}><path d="M4 4l8 8" /><path d="M12 4l-8 8" /></svg>;
}
