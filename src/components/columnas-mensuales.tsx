'use client';

import { useState } from 'react';

/**
 * Monto por mes, una sola serie. Sigue la guía de gráficos del proyecto:
 * columnas de 24px como máximo con 4px redondeados arriba y rectas en la
 * base, grilla de línea fina y sólida, una sola etiqueta directa (el mes más
 * alto) y el resto en el tooltip, que responde igual al mouse y al teclado.
 * No lleva leyenda: es una serie y el título de la tarjeta la nombra.
 * La página muestra los mismos valores en una tabla, así que el tooltip
 * nunca es la única forma de leer un número.
 */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                      'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const PESOS = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

/** 180000 -> "$180 mil", 1250000 -> "$1,3 M": como se dicen los montos en Chile. */
function compacto(n: number): string {
  if (n >= 1_000_000) return `$${(Math.round(n / 100_000) / 10).toLocaleString('es-CL')} M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000).toLocaleString('es-CL')} mil`;
  return `$${n}`;
}

/** Tope y marcas redondas del eje: 0, 100 mil, 200 mil… */
function escala(maximo: number) {
  if (maximo <= 0) return { tope: 1, marcas: [0] };
  const bruto = maximo / 4;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) ?? bruto;
  const tope = Math.ceil(maximo / paso) * paso;
  const marcas: number[] = [];
  for (let v = 0; v <= tope + paso / 2; v += paso) marcas.push(v);
  return { tope, marcas };
}

const ALTO = 160;

export function ColumnasMensuales({ meses, descripcion }: { meses: number[]; descripcion: string }) {
  const [activo, setActivo] = useState<number | null>(null);
  const { tope, marcas } = escala(Math.max(...meses));
  const pico = meses.some((m) => m > 0) ? meses.indexOf(Math.max(...meses)) : -1;

  return (
    <figure className="m-0" aria-label={descripcion}>
      <div className="flex gap-2">
        {/* Eje Y: solo marcas redondas, en tinta apagada */}
        <div className="relative w-14 shrink-0 text-right text-[11px] text-ink-3 tabular" style={{ height: ALTO }}>
          {marcas.map((m) => (
            <span key={m} className="absolute right-0 -translate-y-1/2 font-mono"
              style={{ top: ALTO - (m / tope) * ALTO }}>
              {m === 0 ? '$0' : compacto(m)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height: ALTO }}>
            {/* Grilla: líneas finas y sólidas, un paso fuera de la superficie */}
            {marcas.map((m) => (
              <div key={m} className="absolute inset-x-0 border-t border-line"
                style={{ top: ALTO - (m / tope) * ALTO }} />
            ))}

            <div className="absolute inset-0 flex">
              {meses.map((monto, i) => {
                const alto = (monto / tope) * ALTO;
                return (
                  // El área que responde es toda la franja del mes, no solo la columna.
                  <div
                    key={MESES[i]}
                    tabIndex={0}
                    aria-label={`${MESES_LARGOS[i]}: ${PESOS.format(monto)}`}
                    onPointerEnter={() => setActivo(i)}
                    onPointerLeave={() => setActivo(null)}
                    onFocus={() => setActivo(i)}
                    onBlur={() => setActivo(null)}
                    className="relative flex flex-1 cursor-default items-end justify-center outline-none focus-visible:bg-accent-soft/60"
                  >
                    {monto > 0 && (
                      <div
                        className={`w-[60%] max-w-6 rounded-t-[4px] bg-dato transition-opacity ${activo === i ? 'opacity-75' : ''}`}
                        style={{ height: Math.max(alto, 2) }}
                      />
                    )}

                    {/* Etiqueta directa solo en el mes más alto */}
                    {i === pico && activo === null && (
                      <span className="pointer-events-none absolute whitespace-nowrap text-[11px] font-medium text-ink-2"
                        style={{ bottom: alto + 4 }}>
                        {compacto(monto)}
                      </span>
                    )}

                    {activo === i && (
                      <div role="tooltip"
                        className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1.5 text-left shadow-sm"
                        style={{ bottom: Math.min(alto + 8, ALTO - 36) }}>
                        <b className="block text-sm font-semibold text-ink">{PESOS.format(monto)}</b>
                        <span className="block text-[11px] text-ink-3">{MESES_LARGOS[i]}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Eje X, dentro del contenedor para que nunca quede cortado */}
          <div className="mt-1.5 flex text-[11px] text-ink-3">
            {MESES.map((m) => <span key={m} className="flex-1 text-center">{m}</span>)}
          </div>
        </div>
      </div>
    </figure>
  );
}
