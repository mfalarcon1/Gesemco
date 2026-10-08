'use client';

import { useState } from 'react';
import { guardarMeses } from '@/app/formulacion/acciones';
import { Medidor } from './medidor';
import { IconoAlerta, IconoOk } from './iconos';
import { boton } from './ui';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                      'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const PESOS = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const MILES = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

export type ItemMeses = {
  id: number;
  descripcion: string;
  cantidad: number;
  precio: number;
  meses: { mes: number; cantidad: number }[];
};
export type GrupoMeses = { programa: string; items: ItemMeses[] };

type Estado = { suma: number; invalido: boolean; faltan: number };

const esEntero = (v: string) => /^\d+$/.test(v.trim());
const valor = (v: string) => (esEntero(v) ? Number(v) : 0);

/**
 * Todos los ítems del presupuesto en una grilla de 12 meses: el jefe escribe
 * cuántas unidades usará cada mes (lo que quiera, no partes iguales) y
 * guarda todo junto. Cada fila dice en vivo cuánto falta o si se pasó; abajo
 * va el dinero de cada mes. Con una fila pasada no se puede guardar. La
 * acción y la base validan lo mismo.
 */
export function GrillaMeses({ grupos, departamentoId, editable }: { grupos: GrupoMeses[]; departamentoId: number; editable: boolean }) {
  const items = grupos.flatMap((g) => g.items);
  const [valores, setValores] = useState<Record<number, string[]>>(() =>
    Object.fromEntries(items.map((it) => [
      it.id,
      Array.from({ length: 12 }, (_, i) => {
        const c = it.meses.find((m) => m.mes === i + 1)?.cantidad;
        return c ? String(c) : '';
      }),
    ])),
  );

  const estadoDe = (it: ItemMeses): Estado => {
    const fila = valores[it.id];
    const invalido = fila.some((v) => v.trim() !== '' && !esEntero(v));
    const suma = fila.reduce((s, v) => s + valor(v), 0);
    return { suma, invalido, faltan: it.cantidad - suma };
  };

  const estados = items.map((it) => ({ it, ...estadoDe(it) }));
  const listos = estados.filter((e) => !e.invalido && e.faltan === 0).length;
  const conProblema = estados.filter((e) => e.invalido || e.faltan < 0);
  const dineroMes = Array.from({ length: 12 }, (_, i) => items.reduce((s, it) => s + valor(valores[it.id][i]) * it.precio, 0));

  const cambiar = (id: number, mes: number, v: string) =>
    setValores((actual) => ({ ...actual, [id]: actual[id].map((x, i) => (i === mes ? v : x)) }));

  return (
    <form action={guardarMeses}>
      <input type="hidden" name="departamentoId" value={departamentoId} />

      <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[1060px] border-collapse">
          <thead>
            <tr className="bg-surface-2 text-[13px] font-semibold text-ink-2">
              <th scope="col" className="sticky left-0 z-10 w-[11rem] border-b border-line bg-surface-2 px-4 py-3 text-left md:w-[17rem]">Ítem</th>
              {MESES.map((m) => <th key={m} scope="col" className="border-b border-line px-1 py-3 text-center">{m}</th>)}
              <th scope="col" className="w-[9.5rem] border-b border-line px-4 py-3 text-left">Estado</th>
            </tr>
          </thead>
          {grupos.map((g) => (
            <tbody key={g.programa}>
              <tr>
                <th colSpan={14} scope="colgroup"
                  className="border-b border-line bg-accent-soft/60 px-4 py-2 text-left text-sm font-semibold text-accent-ink">
                  {g.programa}
                </th>
              </tr>
              {g.items.map((it) => {
                const e = estadoDe(it);
                return (
                  <tr key={it.id} id={`item-${it.id}`}>
                    <th scope="row" className="sticky left-0 z-10 border-b border-line bg-surface px-4 py-2.5 text-left align-middle font-normal">
                      <span className="block font-medium leading-snug text-ink">{it.descripcion}</span>
                      <span className="block text-sm text-ink-2">
                        {it.cantidad === 1 ? '1 unidad' : `${MILES.format(it.cantidad)} unidades`} · {PESOS.format(it.precio)} c/u
                      </span>
                      {editable && <input type="hidden" name="linea" value={it.id} />}
                    </th>
                    {valores[it.id].map((v, i) => (
                      <td key={i} className="border-b border-line px-0.5 py-2 text-center align-middle">
                        {editable ? (
                          <input
                            name={`m-${it.id}-${i + 1}`}
                            inputMode="numeric"
                            autoComplete="off"
                            aria-label={`${it.descripcion}, unidades en ${MESES_LARGOS[i]}`}
                            value={v}
                            onChange={(ev) => cambiar(it.id, i, ev.target.value)}
                            placeholder="·"
                            className={`tabular h-10 w-full min-w-0 rounded-md border px-1 text-center text-base text-ink placeholder:text-line-strong
                              focus:border-accent focus:outline-2 focus:-outline-offset-1 focus:outline-accent ${
                                v.trim() !== '' && !esEntero(v) ? 'border-bad bg-bad-soft'
                                  : v.trim() !== '' && Number(v) > 0 ? 'border-accent/60 bg-accent-soft font-semibold' : 'border-line bg-surface'
                              }`}
                          />
                        ) : (
                          <span className={`tabular ${v ? 'font-semibold text-ink' : 'text-ink-3'}`}>{v || '·'}</span>
                        )}
                      </td>
                    ))}
                    <td className="border-b border-line px-4 py-2.5 align-middle text-sm" aria-live="polite">
                      <EstadoFila estado={e} cantidad={it.cantidad} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
          <tfoot>
            <tr className="bg-surface-2 text-[13px]">
              <th scope="row" className="sticky left-0 z-10 bg-surface-2 px-4 py-3 text-left font-semibold text-ink">
                Dinero de cada mes
              </th>
              {dineroMes.map((m, i) => (
                <td key={MESES[i]} className="tabular px-0.5 py-3 text-center font-semibold text-ink">
                  {m === 0 ? <span className="font-normal text-ink-3">·</span> : <span title={PESOS.format(m)}>{compacto(m)}</span>}
                </td>
              ))}
              <td className="tabular px-4 py-3 font-semibold text-ink">{PESOS.format(dineroMes.reduce((s, m) => s + m, 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Barra fija abajo: cuánto va listo y el botón para guardar todo. */}
      <div className="sticky bottom-0 z-20 mt-6 rounded-2xl border border-line bg-surface/95 px-5 py-4 shadow-lg backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="min-w-[14rem] flex-1">
            <p className="mb-1.5 text-[15px] font-semibold text-ink">
              {listos} de {items.length} {items.length === 1 ? 'ítem listo' : 'ítems listos'}
            </p>
            <Medidor valor={listos} total={items.length} etiqueta="Ítems con todos sus meses" />
            {conProblema.length > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-bad" role="status">
                <IconoAlerta className="size-4 shrink-0" />
                Revisa {conProblema.length === 1 ? `"${conProblema[0].it.descripcion}"` : `${conProblema.length} ítems`}: {conProblema.length === 1 ? 'tiene' : 'tienen'} más unidades de las que corresponden o un valor que no es un número.
              </p>
            )}
          </div>
          {editable && (
            <button className={boton.primario} disabled={conProblema.length > 0}>
              Guardar meses
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

/** 180000 -> "180 mil", 1250000 -> "1,3 M": para que quepa en la columna de un mes. */
function compacto(n: number): string {
  if (n >= 1_000_000) return `${(Math.round(n / 100_000) / 10).toLocaleString('es-CL')} M`;
  if (n >= 1_000) return `${Math.round(n / 1_000).toLocaleString('es-CL')} mil`;
  return MILES.format(n);
}

function EstadoFila({ estado: e, cantidad }: { estado: Estado; cantidad: number }) {
  if (e.invalido) {
    return <span className="flex items-center gap-1 text-bad"><IconoAlerta className="size-4 shrink-0" />Solo números</span>;
  }
  if (e.faltan < 0) {
    return <span className="flex items-center gap-1 text-bad"><IconoAlerta className="size-4 shrink-0" />Te pasaste por {-e.faltan}</span>;
  }
  if (e.faltan === 0) {
    return <span className="flex items-center gap-1 font-semibold text-ok"><IconoOk className="size-4 shrink-0" />Listo</span>;
  }
  if (e.suma === 0) return <span className="text-ink-2">Sin meses</span>;
  return <span className="text-ink-2">Faltan {e.faltan} de {cantidad}</span>;
}
