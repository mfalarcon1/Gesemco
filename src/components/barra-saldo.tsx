/**
 * Una sola barra con lo ejecutado, lo comprometido y lo que queda.
 * Si el disponible es negativo, lo ejecutado se pinta en rojo: significa
 * que hubo una excepción autorizada por Dirección.
 */
export function BarraSaldo({
  asignado, comprometido, ejecutado, disponible,
}: { asignado: number; comprometido: number; ejecutado: number; disponible: number }) {
  const base = Math.max(asignado, comprometido + ejecutado) || 1;
  const pe = (ejecutado / base) * 100;
  const pc = (comprometido / base) * 100;
  const sobregiro = disponible < 0;

  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-track">
      <span className={sobregiro ? 'bg-bad' : 'bg-accent'} style={{ width: `${pe.toFixed(2)}%` }} />
      <span className="bg-warn" style={{ width: `${pc.toFixed(2)}%` }} />
    </div>
  );
}

export function Leyenda() {
  return (
    <div className="mt-2.5 flex flex-wrap gap-4 text-xs text-ink-3">
      <span><i className="mr-1.5 inline-block size-2 rounded-xs bg-accent align-middle" />Ejecutado</span>
      <span><i className="mr-1.5 inline-block size-2 rounded-xs bg-warn align-middle" />Comprometido</span>
      <span><i className="mr-1.5 inline-block size-2 rounded-xs bg-track align-middle" />Disponible</span>
    </div>
  );
}
