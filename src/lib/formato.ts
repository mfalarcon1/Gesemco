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

/** +2700 -> "+$2.700", -1200 -> "−$1.200", 0 -> "$0": diferencias con su signo. */
export function conSigno(n: number): string {
  if (n === 0) return money(0);
  return `${n > 0 ? '+' : '−'}${money(Math.abs(n))}`;
}

/** Porcentaje entero de `parte` sobre `total`; 0 si no hay total. */
export function pct(parte: number, total: number): number {
  if (!total) return 0;
  return Math.round((parte / total) * 100);
}

// ---------------------------------------------------------------------
// Fechas. Las del colegio son las de Chile, aunque el servidor (o la
// base) esté en otra zona horaria.
// ---------------------------------------------------------------------

const DIA_CHILE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
});

/**
 * El día en Chile de un momento: "2026-10-08 02:09:12.67+00" -> "2026-10-07".
 * Una fecha sola ("2026-10-08") se devuelve tal cual.
 */
export function diaEnChile(iso: string): string {
  const t = iso.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const normal = t.replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1').replace(/([+-]\d{2})$/, '$1:00');
  const d = new Date(normal);
  return Number.isNaN(d.getTime()) ? t.slice(0, 10) : DIA_CHILE.format(d);
}

/** Hoy en Chile, "2026-10-08". */
export function hoyEnChile(): string {
  return DIA_CHILE.format(new Date());
}

/** "2026-10-08" + 7 -> "2026-10-15". */
export function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Días de una fecha a otra: ("2026-10-08", "2026-10-20") -> 12. */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta.slice(0, 10)}T12:00:00Z`) - Date.parse(`${desde.slice(0, 10)}T12:00:00Z`)) / 86_400_000);
}

/** El mes (1 a 12) de una fecha. */
export const mesDe = (iso: string) => Number(diaEnChile(iso).slice(5, 7));

/** "2026-03-12" o "2026-03-12 10:00:00-03" -> "12 mar 2026" */
export function fecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [a, m, d] = diaEnChile(iso).split('-');
  return `${Number(d)} ${MESES_CORTOS[Number(m) - 1]} ${a}`;
}

/** "2026-10-20" -> "20 oct", cuando el año se entiende. */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [, m, d] = diaEnChile(iso).split('-');
  return `${Number(d)} ${MESES_CORTOS[Number(m) - 1]}`;
}

/** "2026-10-20" -> "20 de octubre", para frases. */
export function fechaLarga(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [, m, d] = diaEnChile(iso).split('-');
  return `${Number(d)} de ${MESES[Number(m) - 1]}`;
}

/** "2026-09-24..." -> "24-09-2026", compacta para notas al pie. */
export function fechaNumerica(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [a, m, d] = diaEnChile(iso).split('-');
  return `${d}-${m}-${a}`;
}

/** Cuánto falta para una fecha, en palabras: "Hoy", "Mañana", "Faltan 12 días", "Atrasado 3 días". */
export function plazo(hoy: string, para: string): string {
  const n = diasEntre(hoy, para);
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n > 1) return `Faltan ${n} días`;
  return n === -1 ? 'Atrasado 1 día' : `Atrasado ${-n} días`;
}

// ---------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------

/** "Camila Rojas" -> "Camila", para saludar. */
export function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}

/** plural(1, 'ítem', 'ítems') -> "1 ítem"; plural(5, …) -> "5 ítems". */
export function plural(n: number, uno: string, varios: string): string {
  return `${entero(n)} ${n === 1 ? uno : varios}`;
}

/** "30 en abril, 15 en junio y 5 en octubre" */
export function textoMeses(meses: { mes: number; cantidad: number }[]): string {
  const partes = [...meses].sort((a, b) => a.mes - b.mes).map((m) => `${entero(m.cantidad)} en ${MESES[m.mes - 1]}`);
  if (partes.length <= 1) return partes[0] ?? '';
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

export function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
}
