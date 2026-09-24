'use client';

import { useState } from 'react';
import { asignarMeses } from '@/app/formulacion/acciones';
import { IconoAlerta, IconoOk } from './iconos';
import { boton } from './ui';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * El jefe escribe cuántas unidades de la línea necesita cada mes. El contador
 * dice en vivo cuánto lleva repartido y cuánto falta; si se pasa, no deja
 * guardar. Sin JavaScript el formulario igual funciona: la acción del
 * servidor y la base validan lo mismo.
 */
export function RepartoMeses({
  lineaId, departamentoId, cantidad, meses,
}: {
  lineaId: number;
  departamentoId: number;
  cantidad: number;
  meses: { mes: number; cantidad: number }[];
}) {
  const [valores, setValores] = useState<string[]>(() =>
    MESES.map((_, i) => String(meses.find((m) => m.mes === i + 1)?.cantidad ?? '')),
  );

  const numeros = valores.map((v) => (/^\d+$/.test(v.trim()) ? Number(v) : 0));
  const invalido = valores.some((v) => v.trim() !== '' && !/^\d+$/.test(v.trim()));
  const repartidas = numeros.reduce((a, b) => a + b, 0);
  const faltan = cantidad - repartidas;
  const pasado = faltan < 0;

  const cambiar = (i: number, valor: string) =>
    setValores((actual) => actual.map((v, j) => (j === i ? valor : v)));

  return (
    <form action={asignarMeses} className="mt-2">
      <input type="hidden" name="departamentoId" value={departamentoId} />
      <input type="hidden" name="lineaId" value={lineaId} />
      <fieldset>
        <legend className="mb-1.5 text-ink-2">Unidades que necesitas cada mes (la línea tiene {cantidad})</legend>
        <div className="grid grid-cols-4 gap-1">
          {MESES.map((m, i) => (
            <label key={m} className="flex flex-col gap-0.5 text-[11px] text-ink-3">
              {m}
              <input
                name={`mes-${i + 1}`}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                placeholder="0"
                value={valores[i]}
                onChange={(e) => cambiar(i, e.target.value)}
                className="w-full min-w-0 rounded border border-line-strong bg-surface-2 px-1.5 py-1 text-right font-mono text-xs text-ink tabular focus:outline-2 focus:outline-accent focus:-outline-offset-1"
              />
            </label>
          ))}
        </div>
      </fieldset>

      <p role="status" aria-live="polite" className="mt-2 flex items-center gap-1">
        {pasado ? (
          <span className="flex items-center gap-1 text-bad">
            <IconoAlerta className="size-3.5" />Te pasaste por {-faltan}: la línea tiene {cantidad}
          </span>
        ) : faltan === 0 ? (
          <span className="flex items-center gap-1 text-ok">
            <IconoOk className="size-3.5" />{cantidad === 1 ? 'La unidad tiene mes' : `Las ${cantidad} unidades tienen mes`}
          </span>
        ) : (
          <span className="text-ink-2">Repartidas {repartidas} de {cantidad} · {faltan === 1 ? 'falta 1' : `faltan ${faltan}`}</span>
        )}
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <button className={`${boton.chico} bg-accent text-paper hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50`}
          disabled={pasado || invalido}>
          Guardar meses
        </button>
        <button type="button" onClick={() => setValores(MESES.map(() => ''))}
          className={`${boton.chico} text-ink-3 hover:bg-surface-2 hover:text-ink`}>
          Limpiar
        </button>
      </div>
    </form>
  );
}
