import { money } from '@/lib/formato';

/**
 * Cuánto del presupuesto vigente ya se compró, cuánto está por comprar y
 * cuánto queda. Rampa ordinal de un solo tono (validada en claro y oscuro):
 * comprado más intenso, por comprar más suave, disponible es la pista.
 * Los segmentos se separan con 2px del color de la superficie, no con bordes.
 * Los valores exactos están siempre en la tabla o las cifras de al lado.
 */
export function BarraSaldo({
  vigente, comprometido, ejecutado, disponible,
}: { vigente: number; comprometido: number; ejecutado: number; disponible: number }) {
  const base = Math.max(vigente, comprometido + ejecutado) || 1;
  const pe = (ejecutado / base) * 100;
  const pc = (comprometido / base) * 100;
  const sobregiro = disponible < 0;

  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-track" role="img"
      aria-label={`Comprado ${money(ejecutado)}, por comprar ${money(comprometido)}, disponible ${money(disponible)}`}>
      {pe > 0 && (
        <>
          <span className={sobregiro ? 'bg-bad' : 'bg-dato'} style={{ width: `${pe.toFixed(2)}%` }}
            title={`Comprado: ${money(ejecutado)}`} />
          <span className="w-[2px] shrink-0 bg-surface" />
        </>
      )}
      {pc > 0 && (
        <>
          <span className="bg-dato-2" style={{ width: `${pc.toFixed(2)}%` }}
            title={`Por comprar: ${money(comprometido)}`} />
          <span className="w-[2px] shrink-0 bg-surface" />
        </>
      )}
    </div>
  );
}

export function Leyenda() {
  return (
    <div className="mt-3 flex flex-wrap gap-5 text-sm text-ink-2">
      <span><i className="mr-1.5 inline-block size-2.5 rounded-[3px] bg-dato align-[-1px]" />Comprado</span>
      <span><i className="mr-1.5 inline-block size-2.5 rounded-[3px] bg-dato-2 align-[-1px]" />Por comprar</span>
      <span><i className="mr-1.5 inline-block size-2.5 rounded-[3px] bg-track align-[-1px]" />Disponible</span>
    </div>
  );
}
