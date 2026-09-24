const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

const ENTERO = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                             'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** 1234567 -> "$1.234.567" */
export function money(n: number | null | undefined): string {
  return CLP.format(Math.round(n ?? 0));
}

/** 1234567 -> "1.234.567" */
export function entero(n: number | null | undefined): string {
  return ENTERO.format(Math.round(n ?? 0));
}

/** Porcentaje entero de `parte` sobre `total`; 0 si no hay total. */
export function pct(parte: number, total: number): number {
  if (!total) return 0;
  return Math.round((parte / total) * 100);
}

/** "2026-03-12" o "2026-03-12 10:00:00-03" -> "12 mar 2026" */
export function fecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${Number(d)} ${MESES_CORTOS[Number(m) - 1]} ${a}`;
}

/** "2026-09-24..." -> "24-09-2026", compacta para notas al pie. */
export function fechaNumerica(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}-${m}-${a}`;
}

/** "Camila Rojas" -> "Camila", para saludar. */
export function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}

/** plural(1, 'ítem', 'ítems') -> "1 ítem"; plural(5, …) -> "5 ítems". */
export function plural(n: number, uno: string, varios: string): string {
  return `${entero(n)} ${n === 1 ? uno : varios}`;
}

export function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
}
