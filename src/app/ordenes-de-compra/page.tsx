import Link from 'next/link';
import { Encabezado, SinAcceso, SinDatos } from '@/components/encabezado';
import { EstadoPresupuestoPildora, FueraDeCatalogo } from '@/components/pildoras';
import { TarjetaCifra } from '@/components/tarjeta-cifra';
import { IconoDescarga } from '@/components/iconos';
import { ayuda, boton, tarjeta, td, tdNum, th, titulo, tituloPagina } from '@/components/ui';
import { getSesion, veOrdenesDeCompra } from '@/lib/sesion';
import {
  ordenDePeriodo, resumenFormulacion, resumenOrdenes, type DepartamentoEnOrden,
} from '@/lib/formulacion';
import { PERIODOS, esPeriodo, periodo as datosPeriodo, type NumeroPeriodo } from '@/lib/periodos';
import { entero, money, plural } from '@/lib/formato';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Lo que recibe GESEMCO para comprar: tres órdenes de compra al año, una por
 * periodo, del colegio completo y con el detalle de cada departamento. Solo
 * entran los presupuestos aprobados por contabilidad.
 */
export default async function OrdenesDeCompra({ searchParams }: Props) {
  const sesion = await getSesion();
  if (!sesion) return <SinDatos />;

  if (!veOrdenesDeCompra(sesion) || !sesion.anioFormulacion) {
    return (
      <>
        <Encabezado sesion={sesion} activo="ordenes" />
        <SinAcceso mensaje="Las órdenes de compra de cada periodo son para contabilidad (GESEMCO) y Dirección." />
      </>
    );
  }

  const { id: anioId, anio } = sesion.anioFormulacion;
  const valor = (await searchParams).periodo;
  const pedido = Number(Array.isArray(valor) ? valor[0] : valor);
  const elegido: NumeroPeriodo = esPeriodo(pedido) ? pedido : 1;

  const [filas, resumen, orden] = await Promise.all([
    resumenOrdenes(sesion.colegio.id, anioId),
    resumenFormulacion(sesion.colegio.id, anioId),
    ordenDePeriodo(sesion.colegio.id, anioId, elegido),
  ]);

  const porPeriodo = PERIODOS.map((p) => filas.reduce((s, f) => s + f.periodos[p.numero - 1], 0));
  const total = porPeriodo.reduce((s, x) => s + x, 0);
  const faltan = resumen.filter((r) => r.estado !== 'aprobado');
  const p = datosPeriodo(elegido);

  return (
    <>
      <Encabezado sesion={sesion} activo="ordenes" />
      <main className="mx-auto max-w-6xl px-5 pb-24 pt-8">
        <div className="mb-6 flex flex-wrap items-end gap-4">
          <div className="min-w-[16rem] flex-1">
            <h1 className={tituloPagina}>Órdenes de compra {anio}</h1>
            <p className="mt-2 max-w-3xl text-[17px] text-ink-2">
              Una orden por periodo, para el colegio completo, con el detalle de cada departamento. Solo entran los
              presupuestos que aprobó contabilidad. Montos a precio presupuesto, con IVA.
            </p>
          </div>
          {filas.length > 0 && (
            <a href="/ordenes-de-compra/exportar" className={boton.secundario} download>
              <IconoDescarga className="size-5" />Descargar el resumen (.csv)
            </a>
          )}
        </div>

        <div className="mb-8 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
          <TarjetaCifra titulo="Total del año" valor={money(total)}
            nota={`${filas.length} de ${resumen.length} departamentos aprobados`} />
          {PERIODOS.map((x, i) => {
            const departamentos = filas.filter((f) => f.periodos[i] > 0).length;
            return (
              <TarjetaCifra key={x.numero} titulo={`${x.nombre} · ${x.meses}`} valor={money(porPeriodo[i])}
                nota={departamentos === 0 ? 'sin pedidos todavía' : plural(departamentos, 'departamento', 'departamentos')} />
            );
          })}
        </div>

        {filas.length === 0 ? (
          <p className={`${tarjeta} px-6 py-10 text-center text-ink-2`}>
            Todavía no hay presupuestos {anio} aprobados por contabilidad. Cada presupuesto aprobado entra a las órdenes
            de los periodos en que tiene programas.
          </p>
        ) : (
          <>
            <section aria-labelledby="resumen" className="mb-10">
              <h2 id="resumen" className={`${titulo} mb-4`}>Cuánto pide cada departamento</h2>
              <div className={`${tarjeta} overflow-hidden`}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse">
                    <thead>
                      <tr className="bg-surface-2">
                        <th className={th}>Departamento</th>
                        <th className={th}>Centro de costo</th>
                        {PERIODOS.map((x) => (
                          <th key={x.numero} className={`${th} text-right`}>{x.nombre}</th>
                        ))}
                        <th className={`${th} text-right`}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((f) => (
                        <tr key={f.departamentoId}>
                          <td className={td}>
                            <Link href={`/formulacion/${f.departamentoId}`} className="font-medium text-accent hover:underline">
                              {f.departamento}
                            </Link>
                          </td>
                          <td className={`${td} text-ink-2`}>{f.centroCosto ?? '—'}</td>
                          {f.periodos.map((m, i) => (
                            <td key={PERIODOS[i].numero} className={`${tdNum} ${m === 0 ? 'text-ink-3' : ''}`}>
                              {m === 0 ? '—' : entero(m)}
                            </td>
                          ))}
                          <td className={`${tdNum} font-semibold`}>{entero(f.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-surface-2 font-semibold">
                        <td className="px-4 py-3" colSpan={2}>Total del colegio</td>
                        {porPeriodo.map((m, i) => (
                          <td key={PERIODOS[i].numero} className="tabular px-4 py-3 text-right">{entero(m)}</td>
                        ))}
                        <td className="tabular px-4 py-3 text-right">{entero(total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </section>

            <section id="detalle" aria-labelledby="detalle-titulo" className="mb-10 scroll-mt-24">
              <h2 id="detalle-titulo" className={`${titulo} mb-3`}>Detalle de cada orden</h2>
              <nav aria-label="Órdenes por periodo" className="mb-6 flex flex-wrap gap-1 border-b border-line">
                {PERIODOS.map((x, i) => {
                  const activo = x.numero === elegido;
                  return (
                    <Link key={x.numero} href={`/ordenes-de-compra?periodo=${x.numero}#detalle`} scroll={false}
                      aria-current={activo ? 'page' : undefined}
                      className={`-mb-px min-h-11 border-b-[3px] px-3 py-2.5 text-[15px] transition-colors sm:px-4 ${
                        activo ? 'border-accent font-semibold text-accent-ink' : 'border-transparent font-medium text-ink-2 hover:text-ink'
                      }`}>
                      {x.nombre} <span className="hidden font-normal text-ink-2 sm:inline">· {money(porPeriodo[i])}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="mb-5 flex flex-wrap items-end gap-4">
                <div className="min-w-[16rem] flex-1">
                  <h3 className="font-display text-[22px] font-bold">
                    Orden del {p.nombre.toLowerCase()} <span className="font-sans text-lg font-medium text-ink-2">· {p.meses}</span>
                  </h3>
                  <p className={`${ayuda} mt-1`}>
                    {orden.items === 0
                      ? 'Ningún presupuesto aprobado tiene programas en este periodo.'
                      : `${money(orden.total)} · ${plural(orden.items, 'ítem', 'ítems')} de ${plural(orden.departamentos.length, 'departamento', 'departamentos')}`}
                  </p>
                </div>
                {orden.items > 0 && (
                  <a href={`/ordenes-de-compra/exportar?periodo=${elegido}`} className={boton.primario} download>
                    <IconoDescarga className="size-5" />Descargar esta orden (.csv)
                  </a>
                )}
              </div>

              <div className="flex flex-col gap-6">
                {orden.departamentos.map((d) => <DepartamentoDeLaOrden key={d.departamentoId} departamento={d} />)}
              </div>
            </section>
          </>
        )}

        {faltan.length > 0 && (
          <section aria-labelledby="faltan">
            <h2 id="faltan" className={`${titulo} mb-1`}>Todavía no aprobados</h2>
            <p className={`${ayuda} mb-4`}>No entran en las órdenes hasta que contabilidad los apruebe.</p>
            <ul className={`${tarjeta} divide-y divide-line`}>
              {faltan.map((r) => (
                <li key={r.departamentoId} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3 sm:px-6">
                  <Link href={`/formulacion/${r.departamentoId}`} className="min-w-[9rem] flex-1 font-medium text-accent hover:underline">
                    {r.departamento}
                  </Link>
                  <EstadoPresupuestoPildora estado={r.estado} />
                  <span className="tabular ml-auto w-28 text-right text-ink-2">{r.estado ? money(r.formulado) : '—'}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}

function DepartamentoDeLaOrden({ departamento: d }: { departamento: DepartamentoEnOrden }) {
  return (
    <article aria-labelledby={`depto-${d.departamentoId}`} className={`${tarjeta} overflow-hidden`}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4">
        <h4 id={`depto-${d.departamentoId}`} className="font-display text-lg font-semibold">
          {d.departamento}
          {d.centroCosto && <span className="font-sans text-[15px] font-normal text-ink-2"> · centro de costo {d.centroCosto}</span>}
        </h4>
        <p className="font-semibold">
          {money(d.total)} <span className="text-[15px] font-normal text-ink-2">· {plural(d.items.length, 'ítem', 'ítems')}</span>
        </p>
      </header>
      {/* En celular cada ítem es una tarjeta, como en el presupuesto; desde md, una tabla. */}
      <ul className="divide-y divide-line border-t border-line md:hidden">
        {d.items.map((i) => (
          <li key={i.lineaId} className="px-5 py-3">
            <p className="font-medium">
              {i.descripcion}
              {i.fueraCatalogo && <span className="ml-2 inline-block align-middle"><FueraDeCatalogo /></span>}
            </p>
            <p className="text-sm text-ink-2">{i.programa}{i.cuenta && ` · cuenta ${i.cuenta}`}</p>
            <p className="tabular mt-1">
              {entero(i.cantidad)} × {money(i.precioUnitario)} = <b className="font-semibold">{money(i.subtotal)}</b>
            </p>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="bg-surface-2">
              <th className={th}>Programa</th>
              <th className={th}>Ítem</th>
              <th className={`${th} text-right`}>Cantidad</th>
              <th className={`${th} text-right`}>Precio c/u</th>
              <th className={`${th} text-right`}>Total</th>
              <th className={th}>Cuenta contable</th>
            </tr>
          </thead>
          <tbody>
            {d.items.map((i) => (
              <tr key={i.lineaId}>
                <td className={`${td} text-ink-2`}>{i.programa}</td>
                <td className={td}>
                  <span className="font-medium">{i.descripcion}</span>
                  {i.fueraCatalogo && <span className="ml-2 inline-block align-middle"><FueraDeCatalogo /></span>}
                </td>
                <td className={tdNum}>{entero(i.cantidad)}</td>
                <td className={tdNum}>{money(i.precioUnitario)}</td>
                <td className={`${tdNum} font-semibold`}>{money(i.subtotal)}</td>
                <td className={`${td} text-ink-2`}>{i.cuenta ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
