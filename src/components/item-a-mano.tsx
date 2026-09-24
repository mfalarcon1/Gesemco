'use client';

import { useState } from 'react';
import { agregarLineaLibre } from '@/app/formulacion/acciones';
import { CampoPesos } from './campos';
import { IconoMas } from './iconos';
import { ayuda, boton, campo, etiqueta } from './ui';

type Cuenta = { id: number; codigo: string; nombre: string };

const PESOS = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

/**
 * Para lo que el catálogo no tiene: un servicio, una salida, una inscripción,
 * un artículo sin precio de tienda. El botón abre el formulario debajo de los
 * botones del programa (ocupa toda la fila).
 */
export function ItemAMano({ programaId, departamentoId, cuentas }: { programaId: number; departamentoId: number; cuentas: Cuenta[] }) {
  const [abierto, setAbierto] = useState(false);
  const [cantidad, setCantidad] = useState<number | null>(1);
  const [precio, setPrecio] = useState<number | null>(null);
  const id = `a-mano-${programaId}`;

  if (!abierto) {
    return (
      <button type="button" className={boton.secundario} onClick={() => setAbierto(true)} aria-expanded={false}>
        <IconoMas className="size-4" />Agregar ítem a mano
      </button>
    );
  }

  const total = cantidad !== null && precio !== null ? cantidad * precio : null;

  return (
    <form action={agregarLineaLibre} aria-label="Agregar ítem a mano"
      className="order-last basis-full rounded-xl border border-line bg-surface p-5">
      <input type="hidden" name="departamentoId" value={departamentoId} />
      <input type="hidden" name="programaId" value={programaId} />
      <h4 className="font-semibold text-ink">Agregar ítem a mano</h4>
      <p className={`${ayuda} mt-1`}>
        Para lo que el catálogo no tiene: servicios, salidas, inscripciones o un artículo sin precio de tienda.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-descripcion`} className={etiqueta}>¿Qué necesitas?</label>
          <input id={`${id}-descripcion`} name="descripcion" required maxLength={200} autoFocus className={campo}
            placeholder="Por ejemplo: bus para la salida pedagógica a Valparaíso" />
        </div>
        <div>
          <label htmlFor={`${id}-cantidad`} className={etiqueta}>Cantidad</label>
          <input id={`${id}-cantidad`} name="cantidad" type="number" min={1} step={1} inputMode="numeric" defaultValue={1}
            required className={`${campo} tabular`}
            onChange={(e) => setCantidad(e.target.value === '' ? null : Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor={`${id}-precio`} className={etiqueta}>Precio de cada uno, con IVA</label>
          <CampoPesos id={`${id}-precio`} name="precio" required placeholder="250.000" onCambio={setPrecio} />
        </div>
        <div>
          <label htmlFor={`${id}-origen`} className={etiqueta}>
            ¿De dónde sale el precio? <span className="font-normal text-ink-2">(opcional)</span>
          </label>
          <input id={`${id}-origen`} name="origen" maxLength={200} className={campo}
            placeholder="Cotización, valor del año pasado…" />
        </div>
        <div>
          <label htmlFor={`${id}-cuenta`} className={etiqueta}>
            Tipo de gasto <span className="font-normal text-ink-2">(opcional, para contabilidad)</span>
          </label>
          <select id={`${id}-cuenta`} name="cuentaContableId" className={campo} defaultValue="">
            <option value="">No sé: que lo asigne contabilidad</option>
            {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre} ({c.codigo})</option>)}
          </select>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button className={boton.primario}>Agregar ítem</button>
        <button type="button" className={boton.suave} onClick={() => setAbierto(false)}>Cancelar</button>
        {total !== null && <p className="text-[15px] text-ink-2">Total: <b className="tabular font-semibold text-ink">{PESOS.format(total)}</b></p>}
      </div>
    </form>
  );
}
