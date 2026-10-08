'use client';

import { useState } from 'react';
import { pedirFueraDelPresupuesto, pedirItem } from '@/app/ejecucion/acciones';
import { fechaLarga, MESES, textoMeses } from '@/lib/formato';
import { CampoCantidad, CampoPesos } from './campos';
import { FueraDeCatalogo } from './pildoras';
import { IconoAlerta, IconoCalendario, IconoMas, IconoOk } from './iconos';
import { ayuda, boton, campo, etiqueta } from './ui';

const PESOS = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

/** Las fechas que se pueden pedir: desde una semana después de hoy hasta fin de año. */
export type Plazo = { minima: string; maxima: string; anticipacion: number };

export type ItemPedible = {
  id: number;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  fueraCatalogo: boolean;
  meses: { mes: number; cantidad: number }[];
  pedida: number;
  enEspera: number;
  sugerencia: { cantidad: number; mes: number | null };
};

/**
 * Un ítem del presupuesto en ejecución: lo planificado, lo que ya se pidió
 * y, para el jefe, el botón "Pedir". El formulario propone la cantidad del
 * próximo mes planificado (se puede cambiar) y pide la fecha en que se
 * necesita; mientras se escribe dice si cabe en lo que queda.
 */
export function ItemParaPedir({
  item, departamentoId, disponible, plazo, puedePedir,
}: { item: ItemPedible; departamentoId: number; disponible: number; plazo: Plazo | null; puedePedir: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const todoPedido = item.pedida >= item.cantidad;

  return (
    <li id={`item-${item.id}`} className="scroll-mt-28 px-6 py-4">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="min-w-[14rem] flex-1">
          <p className="font-medium text-ink">{item.descripcion}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-ink-2">
            <span className="tabular">{item.cantidad} × {PESOS.format(item.precioUnitario)} = {PESOS.format(item.subtotal)}</span>
            {item.fueraCatalogo && <FueraDeCatalogo />}
          </p>
          {item.meses.length > 0 && (
            <p className="mt-1 flex items-center gap-1.5 text-[15px] text-ink">
              <IconoCalendario className="size-4 shrink-0 text-ink-2" />Planificado: {textoMeses(item.meses)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-[15px] text-ink-2">
            {item.pedida === 0 ? 'Sin pedir todavía' : (
              <>
                <span className={`inline-flex items-center gap-1 ${todoPedido ? 'font-medium text-ok' : ''}`}>
                  {todoPedido && <IconoOk className="size-4" />}
                  Pedido: <b className="tabular font-semibold text-ink">{item.pedida}</b> de {item.cantidad}
                </span>
              </>
            )}
            {item.enEspera > 0 && (
              <span className="mt-0.5 flex items-center gap-1 text-warn">
                <IconoAlerta className="size-4" />{item.enEspera} esperando a Dirección
              </span>
            )}
          </p>
          {puedePedir && plazo && !abierto && (
            <button type="button" className={boton.secundario} onClick={() => setAbierto(true)} aria-expanded={false}>
              Pedir
            </button>
          )}
        </div>
      </div>

      {abierto && plazo && (
        <FormularioPedido item={item} departamentoId={departamentoId} disponible={disponible} plazo={plazo}
          onCancelar={() => setAbierto(false)} />
      )}
    </li>
  );
}

function FormularioPedido({
  item, departamentoId, disponible, plazo, onCancelar,
}: { item: ItemPedible; departamentoId: number; disponible: number; plazo: Plazo; onCancelar: () => void }) {
  const [cantidad, setCantidad] = useState<number | null>(item.sugerencia.cantidad);
  const id = `pedir-${item.id}`;
  const total = cantidad !== null && cantidad > 0 ? cantidad * item.precioUnitario : null;
  const ayudaCantidad = item.sugerencia.mes !== null
    ? `La planificada para ${MESES[item.sugerencia.mes - 1]}; puedes cambiarla.`
    : 'Ya pediste todo lo planificado; puedes pedir más si cabe en tu presupuesto.';

  return (
    <form action={pedirItem} className="mt-4 rounded-xl border border-accent/40 bg-accent-soft/40 p-5" aria-label={`Pedir ${item.descripcion}`}>
      <input type="hidden" name="departamentoId" value={departamentoId} />
      <input type="hidden" name="lineaId" value={item.id} />
      <p className="font-semibold text-ink">Pedido: {item.descripcion}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr]">
        <div>
          <label htmlFor={`${id}-cantidad`} className={etiqueta}>Cantidad</label>
          <CampoCantidad id={`${id}-cantidad`} name="cantidad" valorInicial={item.sugerencia.cantidad}
            etiqueta={item.descripcion} onCambio={setCantidad} />
          <p className="mt-1.5 max-w-[16rem] text-sm text-ink-2">{ayudaCantidad}</p>
        </div>
        <CampoFecha id={`${id}-fecha`} plazo={plazo} />
      </div>

      <div className="mt-4">
        <label htmlFor={`${id}-observacion`} className={etiqueta}>
          ¿Algo que deba saber el equipo de compra? <span className="font-normal text-ink-2">(opcional)</span>
        </label>
        <input id={`${id}-observacion`} name="observacion" maxLength={500} className={campo}
          placeholder="Por ejemplo: colores surtidos, entregar en la sala de arte" />
      </div>

      <Cabe total={total} disponible={disponible} />

      <div className="mt-4 flex flex-wrap gap-2">
        <button className={boton.primario} disabled={total === null}>Enviar pedido</button>
        <button type="button" className={boton.suave} onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

/** La fecha en que se necesita: desde una semana después de hoy hasta fin de año. */
function CampoFecha({ id, plazo }: { id: string; plazo: Plazo }) {
  return (
    <div>
      <label htmlFor={id} className={etiqueta}>¿Para cuándo lo necesitas?</label>
      <input id={id} name="necesariaPara" type="date" required min={plazo.minima} max={plazo.maxima}
        className={`${campo} max-w-[14rem]`} />
      <p className="mt-1.5 text-sm text-ink-2">
        Desde el {fechaLarga(plazo.minima)}: se pide con {plazo.anticipacion === 1 ? 'un día' : `${plazo.anticipacion} días`} de anticipación.
      </p>
    </div>
  );
}

/** Si el pedido cabe en lo que queda, en palabras. Lo decide la base al enviarlo; esto es para saberlo antes. */
function Cabe({ total, disponible }: { total: number | null; disponible: number }) {
  if (total === null) return null;
  const cabe = total <= disponible;
  return (
    <div className={`mt-4 flex items-start gap-2 rounded-lg px-4 py-3 text-[15px] ${cabe ? 'bg-surface' : 'bg-warn-soft'}`} aria-live="polite">
      {cabe
        ? <IconoOk className="mt-0.5 size-5 shrink-0 text-ok" />
        : <IconoAlerta className="mt-0.5 size-5 shrink-0 text-warn" />}
      <p className="text-ink">
        Total: <b className="tabular font-semibold">{PESOS.format(total)}</b>.{' '}
        {cabe
          ? `Cabe en lo que te queda (${PESOS.format(disponible)}): pasará directo a compra.`
          : `No alcanza con lo que te queda (${PESOS.format(disponible)}): faltan ${PESOS.format(total - disponible)}. Se enviará a Dirección para que decida si extiende tu presupuesto.`}
      </p>
    </div>
  );
}

type Cuenta = { id: number; codigo: string; nombre: string };

/** Pedir algo que no estaba en el presupuesto: con su precio estimado, su fecha y para qué es. */
export function PedidoExtra({
  departamentoId, disponible, plazo, cuentas,
}: { departamentoId: number; disponible: number; plazo: Plazo; cuentas: Cuenta[] }) {
  const [abierto, setAbierto] = useState(false);
  const [cantidad, setCantidad] = useState<number | null>(1);
  const [precio, setPrecio] = useState<number | null>(null);
  const id = 'pedido-extra';

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong px-5 py-4 text-[15px] font-semibold text-accent hover:border-accent hover:bg-accent-soft">
        <IconoMas className="size-5" />Pedir algo que no está en el presupuesto
      </button>
    );
  }

  const total = cantidad !== null && precio !== null && cantidad > 0 ? cantidad * precio : null;

  return (
    <form action={pedirFueraDelPresupuesto} id={id} className="rounded-2xl border border-line bg-surface p-6">
      <input type="hidden" name="departamentoId" value={departamentoId} />
      <h3 className="font-display text-xl font-semibold">Pedir algo que no está en el presupuesto</h3>
      <p className={`${ayuda} mt-1`}>
        Se pide igual, con su precio estimado y la fecha en que lo necesitas. Si cabe en lo que te queda, pasa directo a
        compra; si no, Dirección decide si extiende tu presupuesto. Contabilidad lo verá marcado como fuera del presupuesto.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-descripcion`} className={etiqueta}>¿Qué necesitas?</label>
          <input id={`${id}-descripcion`} name="descripcion" required maxLength={200} autoFocus className={campo}
            placeholder="Por ejemplo: pinceles finos para la unidad de pintura" />
        </div>
        <div>
          <label htmlFor={`${id}-cantidad`} className={etiqueta}>Cantidad</label>
          <CampoCantidad id={`${id}-cantidad`} name="cantidad" etiqueta="lo que pides" onCambio={setCantidad} />
        </div>
        <div>
          <label htmlFor={`${id}-precio`} className={etiqueta}>Precio estimado de cada uno, con IVA</label>
          <CampoPesos id={`${id}-precio`} name="precio" required placeholder="4.990" onCambio={setPrecio} />
        </div>
        <CampoFecha id={`${id}-fecha`} plazo={plazo} />
        <div>
          <label htmlFor={`${id}-cuenta`} className={etiqueta}>
            Tipo de gasto <span className="font-normal text-ink-2">(opcional, para contabilidad)</span>
          </label>
          <select id={`${id}-cuenta`} name="cuentaContableId" className={campo} defaultValue="">
            <option value="">No sé: que lo asigne contabilidad</option>
            {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre} ({c.codigo})</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-observacion`} className={etiqueta}>¿Para qué es?</label>
          <input id={`${id}-observacion`} name="observacion" required maxLength={500} className={campo}
            placeholder="Por ejemplo: para la unidad de pintura de 5° básico" />
        </div>
      </div>

      <Cabe total={total} disponible={disponible} />

      <div className="mt-5 flex flex-wrap gap-2">
        <button className={boton.primario} disabled={total === null}>Enviar pedido</button>
        <button type="button" className={boton.suave} onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
    </form>
  );
}
