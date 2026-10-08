'use client';

import { useRouter } from 'next/navigation';

type Opcion = { programaId: number; programa: string; items: number; total: number };

const PESOS = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

/**
 * En el catálogo: a qué programa se agregan los artículos. Cambiarlo recarga
 * el catálogo con la misma búsqueda, para ver qué tiene ya ese programa.
 */
export function SelectorPrograma({
  programas, elegido, q, categoria,
}: { programas: Opcion[]; elegido: number; q: string; categoria?: number }) {
  const router = useRouter();

  return (
    <form action="/catalogo" method="get" className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
      {q && <input type="hidden" name="q" value={q} />}
      {categoria && <input type="hidden" name="categoria" value={categoria} />}
      <label htmlFor="programa-destino" className="font-semibold text-ink">Agregando a</label>
      <select
        id="programa-destino"
        name="programa"
        value={elegido}
        onChange={(e) => {
          const p = new URLSearchParams();
          if (q) p.set('q', q);
          if (categoria) p.set('categoria', String(categoria));
          p.set('programa', e.target.value);
          router.push(`/catalogo?${p}`, { scroll: false });
        }}
        className="min-h-11 min-w-0 max-w-full flex-1 rounded-lg border border-line-strong bg-surface px-3 py-2 text-base font-semibold text-ink sm:flex-none"
      >
        {programas.map((p) => (
          <option key={p.programaId} value={p.programaId}>
            {p.programa} ({p.items === 1 ? '1 ítem' : `${p.items} ítems`}, {PESOS.format(p.total)})
          </option>
        ))}
      </select>
      <noscript>
        <button className="rounded-lg border border-line-strong px-3 py-2 text-sm">Cambiar</button>
      </noscript>
    </form>
  );
}
