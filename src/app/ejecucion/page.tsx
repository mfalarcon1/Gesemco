import Link from 'next/link';
import { Encabezado, SinAcceso, SinDatos } from '@/components/encabezado';
import { BarraSaldo, Leyenda } from '@/components/barra-saldo';
import { TarjetaCifra } from '@/components/tarjeta-cifra';
import { EstadoPedidoPildora } from '@/components/pildoras';
import { IconoAlerta, IconoDescarga } from '@/components/iconos';
import { ayuda, boton, tarjeta, td, tdNum, th, titulo, tituloPagina } from '@/components/ui';
import { esDireccion, getSesion, veEjecucionColegio } from '@/lib/sesion';
import { saldosEjecucion, totalizar } from '@/lib/consultas';
import { mesesColegio, pedidos, sumarMeses } from '@/lib/ejecucion';
import { conSigno, fechaCorta, MESES, money, pct, plural } from '@/lib/formato';

/**
 * La ejecución del colegio para Dirección y contabilidad: cuánto lleva
 * pedido y comprado cada departamento y cuánto le queda, lo planificado
 * contra lo pedido mes a mes, lo pagado de verdad y las planillas para Excel.
 */
export default async function Ejecucion() {
  const sesion = await getSesion();
  if (!sesion) return <SinDatos />;

  if (!veEjecucionColegio(sesion) || !sesion.anioEjecucion) {
    return (
      <>
        <Encabezado sesion={sesion} activo="ejecucion" />
        <SinAcceso mensaje="La ejecución del colegio completo es para Dirección y contabilidad." />
      </>
    );
  }

  const anioE = sesion.anioEjecucion;
  const [saldos, meses, comprados] = await Promise.all([
    saldosEjecucion(sesion.colegio.id, anioE.id),
    mesesColegio(sesion.colegio.id, anioE.id),
    pedidos({ colegioId: sesion.colegio.id, anioId: anioE.id, estados: ['comprada', 'recibida'], limite: 12 }),
  ]);
  const total = totalizar(saldos);
  const porMes = sumarMeses(meses);
  const usado = pct(total.comprometido + total.ejecutado, total.vigente);

  return (
    <>
      <Encabezado sesion={sesion} activo="ejecucion" />
      <main className="mx-auto max-w-6xl space-y-10 px-5 pb-24 pt-8">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[16rem] flex-1">
            <h1 className={tituloPagina}>Ejecución {anioE.anio}</h1>
            <p className="mt-2 max-w-3xl text-[17px] text-ink-2">
              Lo que cada departamento lleva pedido y comprado, siempre a precio presupuesto, y lo que le queda. Lo pagado
              de verdad se anota aparte: la diferencia es la desviación.
            </p>
          </div>
        </div>

        <section aria-labelledby="planillas" className={`${tarjeta} flex flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4`}>
          <h2 id="planillas" className="text-[15px] font-semibold">Para Excel (.csv)</h2>
          <div className="flex flex-wrap gap-2">
            <a href="/ejecucion/exportar?tipo=resumen" download className={boton.secundario}>
              <IconoDescarga className="size-4" />Resumen por departamento
            </a>
            <a href="/ejecucion/exportar?tipo=meses" download className={boton.secundario}>
              <IconoDescarga className="size-4" />Mes a mes
            </a>
            <a href="/ejecucion/exportar?tipo=detalle" download className={boton.secundario}>
              <IconoDescarga className="size-4" />Detalle de cada pedido
            </a>
          </div>
        </section>

        <section aria-labelledby="colegio">
          <h2 id="colegio" className="sr-only">El colegio completo</h2>
          <div className="mb-3 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
            <TarjetaCifra titulo="Presupuesto vigente" valor={money(total.vigente)}
              nota={total.modificaciones ? `incluye ${money(total.modificaciones)} en extensiones` : 'sin extensiones'} />
            <TarjetaCifra titulo="Por comprar" valor={money(total.comprometido)} nota="pedidos en la lista del equipo de compra" />
            <TarjetaCifra titulo="Comprado" valor={money(total.ejecutado)} nota="a precio presupuesto" />
            <TarjetaCifra titulo="Disponible" valor={money(total.disponible)} nota={`${usado}% del presupuesto usado`}
              tono={total.disponible < 0 ? 'bad' : 'normal'} />
            <TarjetaCifra titulo="Gasto real" valor={money(total.gastoReal)}
              nota={total.desviacion === 0 ? 'igual a lo presupuestado' : `${conSigno(total.desviacion)} sobre lo presupuestado`} />
          </div>
          <div className={`${tarjeta} p-5`}>
            <BarraSaldo {...total} />
            <Leyenda />
          </div>
          {total.pendientes > 0 && (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-[15px] text-warn">
              <IconoAlerta className="size-4" />
              {plural(total.pendientes, 'pedido espera', 'pedidos esperan')} a Dirección, por {money(total.enPendiente)}.
              {esDireccion(sesion) && <Link href="/solicitudes" className="font-semibold text-accent hover:underline">Resolverlos</Link>}
            </p>
          )}
        </section>

        <section aria-labelledby="departamentos">
          <h2 id="departamentos" className={`${titulo} mb-4`}>Por departamento</h2>
          <div className={`${tarjeta} overflow-hidden`}>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse">
                <thead>
                  <tr className="bg-surface-2">
                    <th className={th}>Departamento</th>
                    <th className={`${th} text-right`}>Vigente</th>
                    <th className={`${th} text-right`}>Por comprar</th>
                    <th className={`${th} text-right`}>Comprado</th>
                    <th className={`${th} text-right`}>Disponible</th>
                    <th className={`${th} text-right`}>Desviación</th>
                    <th className={th}>Avance</th>
                  </tr>
                </thead>
                <tbody>
                  {saldos.map((s) => (
                    <tr key={s.departamentoId} className="hover:bg-surface-2">
                      <td className={td}>
                        <Link href={`/ejecucion/${s.departamentoId}`} className="font-medium text-accent hover:underline">{s.departamento}</Link>
                        {s.pendientes > 0 && (
                          <span className="mt-0.5 flex items-center gap-1 text-sm text-warn">
                            <IconoAlerta className="size-4" />{s.pendientes === 1 ? '1 espera a Dirección' : `${s.pendientes} esperan a Dirección`}
                          </span>
                        )}
                      </td>
                      <td className={tdNum}>{money(s.vigente)}</td>
                      <td className={tdNum}>{money(s.comprometido)}</td>
                      <td className={tdNum}>{money(s.ejecutado)}</td>
                      <td className={`${tdNum} ${s.disponible < 0 ? 'text-bad' : ''}`}>{money(s.disponible)}</td>
                      <td className={`${tdNum} text-ink-2`}>{s.desviacion === 0 ? '—' : conSigno(s.desviacion)}</td>
                      <td className={td}>
                        <div className="min-w-[120px]">
                          <BarraSaldo {...s} />
                          <span className="mt-1 block text-[13px] text-ink-2">{pct(s.comprometido + s.ejecutado, s.vigente)}% usado</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section aria-labelledby="meses">
          <h2 id="meses" className={titulo}>Mes a mes</h2>
          <p className={`${ayuda} mb-4 mt-1 max-w-3xl`}>
            Lo planificado por los jefes al formular, contra lo pedido para cada mes según la fecha en que se necesita.
            Sirve para tener el dinero a tiempo: los jefes pueden pedir antes, después o más en un mes, mientras el total de
            su departamento quepa en el presupuesto.
          </p>
          <div className={`${tarjeta} relative overflow-x-auto`}>
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr className="bg-surface-2">
                  <th className={th}>Mes</th>
                  <th className={`${th} text-right`}>Planificado</th>
                  <th className={`${th} text-right`}>Pedido</th>
                  <th className={`${th} text-right`}>Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {porMes.map((m, i) => (
                  <tr key={MESES[i]}>
                    <td className={`${td} capitalize`}>{MESES[i]}</td>
                    <td className={tdNum}>{m.planificado === 0 ? '—' : money(m.planificado)}</td>
                    <td className={tdNum}>{m.pedido === 0 ? '—' : money(m.pedido)}</td>
                    <td className={`${tdNum} text-ink-2`}>{m.pedido === m.planificado ? '—' : conSigno(m.pedido - m.planificado)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-2 font-semibold">
                  <td className="px-4 py-3">Total</td>
                  <td className="tabular px-4 py-3 text-right">{money(porMes.reduce((s, m) => s + m.planificado, 0))}</td>
                  <td className="tabular px-4 py-3 text-right">{money(porMes.reduce((s, m) => s + m.pedido, 0))}</td>
                  <td className="tabular px-4 py-3 text-right text-ink-2">
                    {conSigno(porMes.reduce((s, m) => s + m.pedido - m.planificado, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {comprados.length > 0 && (
          <section aria-labelledby="compras">
            <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 id="compras" className={titulo}>Últimas compras</h2>
              <a href="/ejecucion/exportar?tipo=detalle" download className="text-[15px] font-medium text-accent hover:underline">
                Descargar el detalle de todo el año
              </a>
            </div>
            <div className={`${tarjeta} relative overflow-x-auto`}>
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="bg-surface-2">
                    <th className={th}>Para el</th>
                    <th className={th}>Departamento</th>
                    <th className={th}>Pedido</th>
                    <th className={th}>Cuenta contable</th>
                    <th className={`${th} text-right`}>Presupuesto</th>
                    <th className={`${th} text-right`}>Pagado</th>
                    <th className={`${th} text-right`}>Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {comprados.map((p) => (
                    <tr key={p.ordenId}>
                      <td className={td}>{fechaCorta(p.necesariaPara)}</td>
                      <td className={td}>
                        <Link href={`/ejecucion/${p.departamentoId}#pedido-${p.ordenId}`} className="text-accent hover:underline">{p.departamento}</Link>
                      </td>
                      <td className={td}>
                        <span className="block">{p.detalle}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-2">
                          {p.folio}<EstadoPedidoPildora estado={p.estado} />
                        </span>
                      </td>
                      <td className={`${td} text-ink-2`}>{p.cuenta ?? 'Sin asignar'}</td>
                      <td className={tdNum}>{money(p.monto)}</td>
                      <td className={tdNum}>{money(p.pagado)}</td>
                      <td className={`${tdNum} text-ink-2`}>{p.diferencia ? conSigno(p.diferencia) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={`${ayuda} mt-2`}>
              Las doce más recientes. El detalle completo de cada departamento está en su página.
            </p>
          </section>
        )}
      </main>
    </>
  );
}
