/**
 * Avance de una tarea (por ejemplo, cuántos ítems ya tienen sus meses). La
 * parte hecha va en el color de datos y la pista en un tono más claro del
 * mismo acento. El número siempre va escrito al lado: la barra no es la única
 * forma de leerlo.
 */
export function Medidor({ valor, total, etiqueta }: { valor: number; total: number; etiqueta: string }) {
  const pct = total > 0 ? Math.min(100, (valor / total) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={valor}
      className="h-2.5 w-full overflow-hidden rounded-full bg-accent-soft"
    >
      {pct > 0 && <div className="h-full rounded-full bg-dato" style={{ width: `${pct}%` }} />}
    </div>
  );
}
