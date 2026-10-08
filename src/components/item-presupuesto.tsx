'use client';

import Link from 'next/link';
import { useState } from 'react';
import { editarLinea, eliminarLinea } from '@/app/formulacion/acciones';
import { MESES, textoMeses } from '@/lib/formato';
import { BotonConConfirmacion } from './confirmar';
import { CampoPesos } from './campos';
import { COLUMNAS_ITEM, type ModoItem } from './columnas-item';
import { FueraDeCatalogo } from './pildoras';
import { IconoAlerta, IconoBasura, IconoCalendario, IconoLapiz } from './iconos';
import { boton, campo, etiqueta } from './ui';

const PESOS = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

export type ItemVista = {
  id: number;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  fueraCatalogo: boolean;
  origenPrecio: string | null;
  cuenta: string | null;
  meses: { mes: number; cantidad: number }[];
  cantidadSinMes: number;
};

/**
 * Un ítem del presupuesto, con los meses en que se usará. Se muestra en modo
 * lectura; el jefe lo cambia con "Editar" (cantidad y precio, con el total a
 * la vista) y lo quita con "Quitar", que pregunta antes. Los meses se
 * indican en la grilla de meses, para todos los ítems juntos.
 */
export function ItemPresupuesto({
  item, departamentoId, modo, mostrarCuenta,
}: { item: ItemVista; departamentoId: number; modo: ModoItem; mostrarCuenta: boolean }) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <li id={`item-${item.id}`} className="bg-accent-soft/50 px-6 py-5">
        <EditarItem item={item} departamentoId={departamentoId} onCancelar={() => setEditando(false)} />
      </li>
    );
  }

  return (
    <li id={`item-${item.id}`} className={`grid gap-x-4 gap-y-2 px-6 py-4 md:items-start ${COLUMNAS_ITEM[modo]}`}>
      <div className="min-w-0">
        <p className="font-medium text-ink">{item.descripcion}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
          {item.fueraCatalogo && <FueraDeCatalogo />}
          {item.origenPrecio && <span>{item.origenPrecio}</span>}
          {mostrarCuenta && item.cuenta && <span className="text-ink-3">· Cuenta {item.cuenta}</span>}
        </p>
        <MesesDelItem item={item} enlace={modo === 'editable' ? `/formulacion/${departamentoId}/meses#item-${item.id}` : null} />
        {/* En celular, cantidad, precio y total en una línea. */}
        <p className="tabular mt-2 text-[15px] text-ink md:hidden">
          {item.cantidad} × {PESOS.format(item.precioUnitario)} = <b className="font-semibold">{PESOS.format(item.subtotal)}</b>
        </p>
      </div>
      <p className="tabular hidden text-right md:block"><span className="sr-only">Cantidad: </span>{item.cantidad}</p>
      <p className="tabular hidden text-right md:block"><span className="sr-only">Precio de cada uno: </span>{PESOS.format(item.precioUnitario)}</p>
      <p className="tabular hidden text-right font-semibold md:block"><span className="sr-only">Total: </span>{PESOS.format(item.subtotal)}</p>

      {modo === 'editable' && (
        <div className="flex flex-wrap gap-1 md:justify-end">
          <button type="button" className={`${boton.chico} text-accent hover:bg-accent-soft`} onClick={() => setEditando(true)}>
            <IconoLapiz className="size-4" />Editar
          </button>
          <form action={eliminarLinea}>
            <input type="hidden" name="departamentoId" value={departamentoId} />
            <input type="hidden" name="lineaId" value={item.id} />
            <BotonConConfirmacion
              texto="Quitar"
              icono={<IconoBasura className="size-4" />}
              pregunta="¿Quitar este ítem?"
              confirmar="Sí, quitar"
              clase={`${boton.chico} text-ink-2 hover:bg-bad-soft hover:text-bad`}
              claseConfirmar={`${boton.chico} border border-bad/40 bg-surface text-bad hover:bg-bad-soft`}
            />
          </form>
        </div>
      )}
    </li>
  );
}

/** "30 en abril, 15 en junio y 5 en octubre", con aviso si faltan unidades sin mes. */
function MesesDelItem({ item, enlace }: { item: ItemVista; enlace: string | null }) {
  const falta = item.cantidadSinMes;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px]">
      {item.meses.length > 0 && (
        <span className="inline-flex items-center gap-1.5 text-ink">
          <IconoCalendario className="size-4 shrink-0 text-ink-2" />
          {textoMeses(item.meses)}
        </span>
      )}
      {falta > 0 && (
        <span className="inline-flex items-center gap-1.5 font-medium text-warn">
          <IconoAlerta className="size-4 shrink-0" />
          {item.meses.length === 0
            ? 'Sin meses todavía'
            : falta === 1 ? 'Falta 1 unidad sin mes' : `Faltan ${falta} unidades sin mes`}
        </span>
      )}
      {falta > 0 && enlace && (
        <Link href={enlace} className="text-sm font-semibold text-accent hover:underline">Indicar meses</Link>
      )}
    </div>
  );
}

function EditarItem({ item, departamentoId, onCancelar }: { item: ItemVista; departamentoId: number; onCancelar: () => void }) {
  const [cantidad, setCantidad] = useState<number | null>(item.cantidad);
  const [precio, setPrecio] = useState<number | null>(item.precioUnitario);
  const total = cantidad !== null && precio !== null ? cantidad * precio : null;
  const id = `editar-${item.id}`;

  return (
    <form
      action={editarLinea}
      onSubmit={(e) => {
        if (cantidad === item.cantidad && precio === item.precioUnitario) {
          e.preventDefault();
          onCancelar();
        }
      }}
    >
      <input type="hidden" name="departamentoId" value={departamentoId} />
      <input type="hidden" name="lineaId" value={item.id} />
      <p className="mb-3 font-semibold text-ink">Editando: {item.descripcion}</p>
      <div className="grid gap-4 sm:grid-cols-[8rem_12rem_1fr] sm:items-end">
        <div>
          <label htmlFor={`${id}-cantidad`} className={etiqueta}>Cantidad</label>
          <input id={`${id}-cantidad`} name="cantidad" type="number" min={1} step={1} inputMode="numeric" required
            defaultValue={item.cantidad}
            onChange={(e) => setCantidad(e.target.value === '' ? null : Number(e.target.value))}
            className={`${campo} tabular text-right`} />
        </div>
        <div>
          <label htmlFor={`${id}-precio`} className={etiqueta}>Precio de cada uno</label>
          <CampoPesos id={`${id}-precio`} name="precio" valorInicial={item.precioUnitario} required onCambio={setPrecio} />
        </div>
        <p className="pb-2.5 text-[15px] text-ink-2">
          Total: <b className="tabular font-semibold text-ink">{total !== null ? PESOS.format(total) : '—'}</b>
        </p>
      </div>
      {precio !== null && precio !== item.precioUnitario && (
        <p className="mt-3 text-sm text-ink-2">
          Cambiaste el precio: quedará anotado que antes era {PESOS.format(item.precioUnitario)}.
        </p>
      )}
      {cantidad !== null && cantidad !== item.cantidad && item.meses.length > 0 && (
        <p className="mt-3 text-sm text-ink-2">
          {item.meses.length === 1 && item.cantidadSinMes === 0
            ? `Va en un solo mes: las ${cantidad} unidades quedarán en ${MESES[item.meses[0].mes - 1]}.`
            : cantidad > item.cantidad
              ? 'Va repartido en varios meses: después de guardar, indica el mes de las unidades nuevas.'
              : 'Va repartido en varios meses: si bajas de lo repartido, tendrás que indicar sus meses de nuevo.'}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button className={boton.primario}>Guardar cambios</button>
        <button type="button" className={boton.suave} onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}
