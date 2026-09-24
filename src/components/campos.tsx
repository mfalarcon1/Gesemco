'use client';

import { useState } from 'react';
import { campo } from './ui';

const MILES = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

/**
 * Monto en pesos que se escribe con separador de miles mientras se tipea:
 * "250000" se ve "250.000". Al servidor llega con puntos y él los quita.
 */
export function CampoPesos({
  id, name, valorInicial, required, placeholder, onCambio,
}: {
  id: string; name: string; valorInicial?: number | null; required?: boolean;
  placeholder?: string; onCambio?: (n: number | null) => void;
}) {
  const [texto, setTexto] = useState(valorInicial != null ? MILES.format(valorInicial) : '');

  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-ink-2">$</span>
      <input
        id={id}
        name={name}
        inputMode="numeric"
        autoComplete="off"
        required={required}
        placeholder={placeholder}
        value={texto}
        onChange={(e) => {
          const digitos = e.target.value.replace(/\D/g, '').slice(0, 10);
          const n = digitos === '' ? null : Number(digitos);
          setTexto(n === null ? '' : MILES.format(n));
          onCambio?.(n);
        }}
        className={`${campo} tabular pl-7 text-right`}
      />
    </div>
  );
}

/** Cantidad con botones − y + grandes, más fácil que las flechitas del navegador. */
export function CampoCantidad({
  id, name, valorInicial = 1, min = 1, etiqueta, onCambio,
}: {
  id: string; name: string; valorInicial?: number; min?: number; etiqueta: string;
  onCambio?: (n: number | null) => void;
}) {
  const [texto, setTexto] = useState(String(valorInicial));
  const n = Number(texto);
  const valido = texto.trim() !== '' && Number.isInteger(n);

  const fijar = (valor: string) => {
    setTexto(valor);
    const m = Number(valor);
    onCambio?.(valor.trim() !== '' && Number.isInteger(m) ? m : null);
  };

  const botonLado =
    'grid w-10 shrink-0 place-items-center border border-line-strong bg-surface-2 text-lg font-semibold text-ink ' +
    'hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="flex min-h-11 items-stretch">
      <button type="button" aria-label={`Una unidad menos de ${etiqueta}`} className={`${botonLado} rounded-l-lg`}
        disabled={valido && n <= min} onClick={() => fijar(String(Math.max(min, (valido ? n : min) - 1)))}>
        −
      </button>
      <input
        id={id}
        name={name}
        type="number"
        min={min}
        step={1}
        inputMode="numeric"
        required
        aria-label={`Cantidad de ${etiqueta}`}
        value={texto}
        onChange={(e) => fijar(e.target.value)}
        className="tabular w-16 min-w-0 border-y border-line-strong bg-surface text-center text-base text-ink
                   [appearance:textfield] focus:outline-2 focus:-outline-offset-2 focus:outline-accent
                   [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button type="button" aria-label={`Una unidad más de ${etiqueta}`} className={`${botonLado} rounded-r-lg`}
        onClick={() => fijar(String((valido ? n : min - 1) + 1))}>
        +
      </button>
    </div>
  );
}
