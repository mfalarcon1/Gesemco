const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
             'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** 1234567 -> "$1.234.567" */
export function money(n: number | null | undefined): string {
  return CLP.format(Math.round(n ?? 0));
}

/** Porcentaje del presupuesto ya comprometido o ejecutado. */
export function pctUsado(asignado: number, comprometido: number, ejecutado: number): number {
  if (!asignado) return 0;
  return Math.round(((comprometido + ejecutado) / asignado) * 100);
}

/** "2026-03-12" -> "12 mar 2026" */
export function fecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${Number(d)} ${MES[Number(m) - 1]} ${a}`;
}

export function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
}
