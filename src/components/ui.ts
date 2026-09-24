/**
 * Clases compartidas para que botones, campos y tarjetas se vean iguales en
 * todas las pantallas. Solo tokens de globals.css: nada de colores literales.
 */

const baseBoton =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium ' +
  'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export const boton = {
  primario: `${baseBoton} bg-accent text-paper hover:opacity-90`,
  secundario: `${baseBoton} border border-line-strong bg-surface text-ink hover:bg-surface-2`,
  peligro: `${baseBoton} border border-line bg-surface text-bad hover:bg-bad-soft`,
  chico: 'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium transition-colors ' +
    'focus-visible:outline-2 focus-visible:outline-accent',
};

export const campo =
  'w-full rounded-lg border border-line-strong bg-surface-2 px-3 py-1.5 text-sm text-ink ' +
  'placeholder:text-ink-3 focus:outline-2 focus:outline-accent focus:-outline-offset-1';

export const etiqueta = 'mb-1 block text-xs font-medium text-ink-2';

export const tarjeta = 'rounded-xl border border-line bg-surface';

export const titulo = 'font-display text-lg font-semibold';

export const th = 'border-b border-line px-3.5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-ink-3';
export const td = 'border-b border-line px-3.5 py-3 align-top';
export const tdNum = `${td} tabular text-right font-mono`;
