/**
 * Clases compartidas para que botones, campos y tarjetas se vean iguales en
 * todas las pantallas. Solo tokens de globals.css: nada de colores literales.
 *
 * Pensado para personas que usan poco el computador: texto de 16px, botones
 * de al menos 44px de alto y etiquetas en palabras, no solo íconos.
 */

const baseBoton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-[15px] font-semibold ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-50';

export const boton = {
  /** La acción principal de la pantalla: una sola a la vista. */
  primario: `${baseBoton} bg-accent text-paper hover:bg-accent-ink`,
  secundario: `${baseBoton} border border-line-strong bg-surface text-ink hover:bg-surface-2`,
  /** Acciones de apoyo (Editar, Cancelar): sin borde, en el color del acento. */
  suave: `${baseBoton} text-accent hover:bg-accent-soft`,
  peligro: `${baseBoton} border border-bad/40 bg-surface text-bad hover:bg-bad-soft`,
  /** Para filas y listas donde un botón grande estorba. */
  chico:
    'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold ' +
    'transition-colors disabled:cursor-not-allowed disabled:opacity-50',
};

export const campo =
  'w-full min-h-11 rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-base text-ink ' +
  'placeholder:text-ink-3 focus:border-accent focus:outline-2 focus:-outline-offset-1 focus:outline-accent';

export const etiqueta = 'mb-1.5 block text-sm font-semibold text-ink';

/** Texto de ayuda bajo un campo o una sección. */
export const ayuda = 'text-[15px] text-ink-2';

export const tarjeta = 'rounded-2xl border border-line bg-surface';

export const titulo = 'font-display text-xl font-semibold';

/** Encabezado de página: la misma medida en todas. */
export const tituloPagina = 'font-display text-[28px] font-bold leading-tight tracking-tight md:text-[32px]';

export const th = 'border-b border-line px-4 py-3 text-left text-[13px] font-semibold text-ink-2';
export const td = 'border-b border-line px-4 py-3.5 align-top';
export const tdNum = `${td} tabular text-right`;
