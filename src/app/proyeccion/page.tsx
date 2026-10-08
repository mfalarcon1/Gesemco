import Link from 'next/link';
import { Encabezado, SinAcceso, SinDatos } from '@/components/encabezado';
import { ColumnasMensuales } from '@/components/columnas-mensuales';
import { EstadoPresupuestoPildora } from '@/components/pildoras';
import { TarjetaCifra } from '@/components/tarjeta-cifra';
import { IconoDescarga } from '@/components/iconos';
import { ayuda, boton, tarjeta, titulo, tituloPagina } from '@/components/ui';
import { getSesion, veProyeccion } from '@/lib/sesion';
import { proyeccionColegio, resumenFormulacion } from '@/lib/formulacion';
import { entero, MESES, MESES_CORTOS, money } from '@/lib/formato';

/**
 * Lo que recibe GESEMCO de la formulación: cuánto dinero necesitará cada
 * departamento en cada mes del año que se formula, según los meses que
 * indicó su jefe. Solo lo aprobado por contabilidad.
 */
export default async function Proyeccion() {
  const sesion = await getSesion();
  if (!sesion) return <SinDatos />;

  if (!veProyeccion(sesion) || !sesion.anioFormulacion) {
    return (
      <>
        <Encabezado sesion={sesion} activo="proyeccion" />
        <SinAcceso mensaje="La proyección mensual es para contabilidad (GESEMCO) y Dirección." />
      </>
    );
  }

  const { id: anioId, anio } = sesion.anioFormulacion;
  const [filas, resumen] = await Promise.all([
    proyeccionColegio(sesion.colegio.id, anioId),
    resumenFormulacion(sesion.colegio.id, anioId),
  ]);

  const porMes = Array.from({ length: 12 }, (_, i) => filas.reduce((s, f) => s + f.meses[i], 0));
  const total = filas.reduce((s, f) => s + f.total, 0);
  const maximo = Math.max(...porMes);
  const faltan = resumen.filter((r) => r.estado !== 'aprobado');
  const celda = 'tabular border-b border-line px-2 py-2.5 text-right text-sm';

  return (
    <>
      <Encabezado sesion={sesion} activo="proyeccion" />
      <main className="mx-auto max-w-6xl px-5 pb-24 pt-8">
        <div className="mb-6 flex flex-wrap items-end gap-4">
          <div className="min-w-[16rem] flex-1">
            <h1 className={tituloPagina}>Proyección mensual {anio}</h1>
            <p className="mt-2 max-w-3xl text-[17px] text-ink-2">
              Cuánto dinero necesitará cada departamento en cada mes, según los meses que indicó su jefe para cada ítem.
              Solo cuentan los presupuestos aprobados por contabilidad.
            </p>
          </div>
          {filas.length > 0 && (
            <a href="/proyeccion/exportar" className={boton.primario} download>
              <IconoDescarga className="size-5" />Descargar para Excel (.csv)
            </a>
          )}
        </div>

        <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
          <TarjetaCifra titulo="Total aprobado" valor={money(total)}
            nota={`${filas.length} de ${resumen.length} departamentos`} />
          <TarjetaCifra titulo="Mes más alto" valor={total > 0 ? money(maximo) : '—'}
            nota={total > 0 ? MESES[porMes.indexOf(maximo)] : 'sin presupuestos aprobados'} />
          <TarjetaCifra titulo="Todavía no aprobados" valor={String(faltan.length)}
            nota={faltan.length === 0 ? 'todos los departamentos listos' : 'no entran a la proyección'} />
        </div>

        {filas.length === 0 ? (
          <p className={`${tarjeta} mb-6 px-6 py-10 text-center text-ink-2`}>
            Todavía no hay presupuestos {anio} aprobados por contabilidad.
          </p>
        ) : (
          <>
            <section className={`${tarjeta} mb-6 p-6`}>
              <h2 className={`${titulo} mb-4`}>Total del colegio por mes</h2>
              <ColumnasMensuales meses={porMes} descripcion={`Proyección mensual ${anio} del colegio`} />
            </section>

            <section className={`${tarjeta} mb-6 overflow-hidden`}>
              <p className={`${ayuda} border-b border-line px-4 py-3`}>
                Montos en pesos, con IVA, a precio presupuesto. Un guion es un mes sin monto.
              </p>
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse">
                  <thead>
                    <tr className="bg-surface-2 text-[13px] font-semibold text-ink-2">
                      <th className="border-b border-line px-4 py-3 text-left">Departamento</th>
                      {MESES_CORTOS.map((m) => (
                        <th key={m} className="border-b border-line px-2 py-3 text-right capitalize">{m}</th>
                      ))}
                      <th className="border-b border-line px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.departamentoId}>
                        <td className="border-b border-line px-4 py-2.5">
                          <Link href={`/formulacion/${f.departamentoId}`} className="font-medium text-accent hover:underline">
                            {f.departamento}
                          </Link>
                        </td>
                        {f.meses.map((m, i) => (
                          <td key={MESES_CORTOS[i]} className={`${celda} ${m === 0 ? 'text-ink-3' : ''}`}>
                            {m === 0 ? '—' : entero(m)}
                          </td>
                        ))}
                        <td className={`${celda} px-4 font-semibold`}>{entero(f.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-surface-2 font-semibold">
                      <td className="px-4 py-3">Total</td>
                      {porMes.map((m, i) => (
                        <td key={MESES_CORTOS[i]} className="tabular px-2 py-3 text-right text-sm">
                          {m === 0 ? '—' : entero(m)}
                        </td>
                      ))}
                      <td className="tabular px-4 py-3 text-right text-sm">{entero(total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </>
        )}

        {faltan.length > 0 && (
          <section>
            <h2 className={`${titulo} mb-1`}>Todavía no aprobados</h2>
            <p className={`${ayuda} mb-4`}>Entran a la proyección cuando contabilidad los aprueba.</p>
            <ul className={`${tarjeta} divide-y divide-line`}>
              {faltan.map((r) => (
                <li key={r.departamentoId} className="flex flex-wrap items-center gap-3 px-6 py-3">
                  <Link href={`/formulacion/${r.departamentoId}`} className="min-w-0 flex-1 font-medium text-accent hover:underline">
                    {r.departamento}
                  </Link>
                  <EstadoPresupuestoPildora estado={r.estado} />
                  <span className="tabular w-32 text-right text-ink-2">
                    {r.estado ? money(r.formulado) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
