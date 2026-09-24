import { EstadoPresupuestoPildora } from './pildoras';
import { Medidor } from './medidor';
import { ayuda, tarjeta } from './ui';
import type { EstadoPresupuesto, ResumenPresupuesto } from '@/lib/formulacion';
import { money } from '@/lib/formato';

const ORDEN: (EstadoPresupuesto | null)[] = ['aprobado', 'enviado', 'devuelto', 'borrador', null];

/** Cuántos departamentos van en cada estado, con el avance hacia "todos aprobados". */
export function ResumenFormulacion({ filas }: { filas: ResumenPresupuesto[] }) {
  const cuenta = (e: EstadoPresupuesto | null) => filas.filter((f) => f.estado === e).length;
  const aprobados = cuenta('aprobado');
  const formulado = filas.reduce((s, f) => s + f.formulado, 0);
  const aprobado = filas.reduce((s, f) => s + (f.montoAprobado ?? 0), 0);

  return (
    <div className={`${tarjeta} p-6`}>
      <p className="mb-2 text-lg font-semibold">{aprobados} de {filas.length} departamentos aprobados</p>
      <div className="max-w-xl"><Medidor valor={aprobados} total={filas.length} etiqueta="Departamentos aprobados" /></div>
      <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-3" aria-label="Departamentos por estado">
        {ORDEN.filter((e) => cuenta(e) > 0).map((e) => (
          <li key={e ?? 'sin-iniciar'} className="flex items-center gap-2">
            <EstadoPresupuestoPildora estado={e} />
            <span className="text-[15px] font-semibold">{cuenta(e)}</span>
          </li>
        ))}
      </ul>
      <p className={`${ayuda} mt-4`}>Pedido en total: {money(formulado)} · ya aprobado: {money(aprobado)}</p>
    </div>
  );
}
