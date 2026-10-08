'use client';

import { useState } from 'react';
import { registrarCompra } from '@/app/ejecucion/acciones';
import { CampoPesos } from './campos';
import { boton, campo, etiqueta } from './ui';

const PESOS = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

/**
 * Registrar lo que se pagó por un pedido: proveedor, documento, fecha y
 * monto real con IVA. El monto parte en lo presupuestado y, mientras se
 * escribe, dice cuánto se pagó de más o de menos. Al guardar, el pedido
 * queda comprado y el jefe recibe el aviso para confirmar cuando llegue.
 */
export function RegistrarCompra({
  ordenId, folio, presupuestado, hoy,
}: { ordenId: number; folio: string; presupuestado: number; hoy: string }) {
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState<number | null>(presupuestado);
  const id = `compra-${ordenId}`;

  if (!abierto) {
    return (
      <button type="button" className={boton.secundario} onClick={() => setAbierto(true)} aria-expanded={false}>
        Registrar compra
      </button>
    );
  }

  const diferencia = monto === null ? null : monto - presupuestado;

  return (
    <form action={registrarCompra} aria-label={`Registrar la compra del pedido ${folio}`}
      className="order-last mt-3 basis-full rounded-xl border border-accent/40 bg-accent-soft/40 p-5">
      <input type="hidden" name="ordenId" value={ordenId} />
      <p className="font-semibold text-ink">Compra del pedido {folio}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-proveedor`} className={etiqueta}>Proveedor</label>
          <input id={`${id}-proveedor`} name="proveedor" required maxLength={200} autoFocus className={campo}
            placeholder="Nombre de la tienda o empresa" />
        </div>
        <div>
          <label htmlFor={`${id}-tipo`} className={etiqueta}>Documento</label>
          <select id={`${id}-tipo`} name="tipoDocumento" className={campo} defaultValue="factura">
            <option value="factura">Factura</option>
            <option value="boleta">Boleta</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-numero`} className={etiqueta}>
            Número <span className="font-normal text-ink-2">(opcional)</span>
          </label>
          <input id={`${id}-numero`} name="numeroDocumento" maxLength={60} className={campo} placeholder="F-12345" />
        </div>
        <div>
          <label htmlFor={`${id}-fecha`} className={etiqueta}>Fecha de la compra</label>
          <input id={`${id}-fecha`} name="fechaCompra" type="date" required defaultValue={hoy} max={hoy}
            className={campo} />
        </div>
        <div>
          <label htmlFor={`${id}-monto`} className={etiqueta}>Monto pagado, con IVA</label>
          <CampoPesos id={`${id}-monto`} name="monto" required valorInicial={presupuestado} onCambio={setMonto} />
          <p className="mt-1.5 text-sm text-ink-2" aria-live="polite">
            Presupuestado: {PESOS.format(presupuestado)}
            {diferencia !== null && diferencia !== 0 && ` · ${PESOS.format(Math.abs(diferencia))} ${diferencia > 0 ? 'más' : 'menos'}`}
          </p>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-obs`} className={etiqueta}>
            Observaciones <span className="font-normal text-ink-2">(opcional)</span>
          </label>
          <input id={`${id}-obs`} name="observaciones" maxLength={500} className={campo}
            placeholder="Por ejemplo: llega en dos despachos" />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button className={boton.primario} disabled={monto === null}>Guardar la compra</button>
        <button type="button" className={boton.suave} onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
    </form>
  );
}
