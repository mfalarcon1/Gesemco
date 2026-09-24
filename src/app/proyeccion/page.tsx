import Link from 'next/link';
import { Encabezado, SinAcceso, SinDatos } from '@/components/encabezado';
import { ColumnasMensuales } from '@/components/columnas-mensuales';
import { EstadoPresupuestoPildora } from '@/components/pildoras';
import { TarjetaCifra } from '@/components/tarjeta-cifra';
import { boton, tarjeta, titulo } from '@/components/ui';
import { getSesion, veProyeccion } from '@/lib/sesion';
import { proyeccionColegio, resumenFormulacion } from '@/lib/formulacion';
import { entero, MESES_CORTOS, money } from '@/lib/formato';

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
  const sinMes = filas.reduce((s, f) => s + f.sinMes, 0);
  const total = filas.reduce((s, f) => s + f.total, 0);
  const faltan = resumen.filter((r) => r.estado !== 'aprobado');
  const celda = 'tabular border-b border-line px-2 py-2 text-right font-mono text-xs';

  return (
    <>
      <Encabezado sesion={sesion} activo="proyeccion" />
      <main className="mx-auto max-w-6xl px-5 pb-20 pt-7">
        <div className="mb-5 flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="mb-1 font-display text-2xl font-semibold">Proyección mensual {anio}</h1>
            <p className="max-w-3xl text-sm text-ink-2">
              Cuánta caja necesita cada departamento cada mes, según los meses que asignó cada jefe. Solo cuentan
              los presupuestos aprobados; lo que todavía no tiene mes aparece aparte.
            </p>
          </div>
          <a href="/proyeccion/exportar" className={boton.secundario} download>
            Descargar para Excel (.csv)
          </a>
        </div>

        <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(168px,1fr))] gap-3">
          <TarjetaCifra titulo="Total aprobado" valor={money(total)}
            nota={`${filas.length} de ${resumen.length} departamentos`} />
          <TarjetaCifra titulo="Con mes asignado" valor={money(total - sinMes)} />
          <TarjetaCifra titulo="Sin mes asignado" valor={money(sinMes)}
            nota={sinMes === 0 ? 'todo calendarizado' : 'los jefes aún deben asignarlo'} />
          <TarjetaCifra titulo="Mes más alto"
            valor={total - sinMes > 0 ? money(Math.max(...porMes)) : '—'}
            nota={total - sinMes > 0 ? MESES_CORTOS[porMes.indexOf(Math.max(...porMes))] : 'sin meses asignados'} />
        </div>

        {filas.length === 0 ? (
          <p className={`${tarjeta} px-4 py-10 text-center text-sm text-ink-3`}>
            Todavía no hay presupuestos {anio} aprobados.
          </p>
        ) : (
          <>
            <section className={`${tarjeta} mb-6 p-5`}>
              <h2 className={`${titulo} mb-4`}>Total del colegio por mes</h2>
              <ColumnasMensuales meses={porMes} descripcion={`Proyección mensual ${anio} del colegio`} />
            </section>

            <section className={`${tarjeta} mb-6 overflow-hidden`}>
              <p className="border-b border-line px-3 py-2 text-xs text-ink-3">
                Montos en pesos, con IVA. Un guion es un mes sin monto.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse">
                  <thead>
                    <tr className="bg-surface-2 text-[11px] uppercase tracking-wider text-ink-3">
                      <th className="border-b border-line px-3 py-2.5 text-left font-medium">Departamento</th>
                      {MESES_CORTOS.map((m) => (
                        <th key={m} className="border-b border-line px-2 py-2.5 text-right font-medium">{m}</th>
                      ))}
                      <th className="border-b border-line px-2 py-2.5 text-right font-medium">Sin mes</th>
                      <th className="border-b border-line px-3 py-2.5 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.departamentoId}>
                        <td className="border-b border-line px-3 py-2 text-sm">
                          <Link href={`/formulacion/${f.departamentoId}`} className="text-accent hover:underline">
                            {f.departamento}
                          </Link>
                        </td>
                        {f.meses.map((m, i) => (
                          <td key={MESES_CORTOS[i]} className={`${celda} ${m === 0 ? 'text-ink-3' : ''}`}>
                            {m === 0 ? '—' : entero(m)}
                          </td>
                        ))}
                        <td className={`${celda} ${f.sinMes === 0 ? 'text-ink-3' : 'text-ink-2'}`}>
                          {f.sinMes === 0 ? '—' : entero(f.sinMes)}
                        </td>
                        <td className={`${celda} px-3 font-medium`}>{entero(f.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-surface-2 font-medium">
                      <td className="px-3 py-2.5 text-sm">Total</td>
                      {porMes.map((m, i) => (
                        <td key={MESES_CORTOS[i]} className="tabular px-2 py-2.5 text-right font-mono text-xs">
                          {m === 0 ? '—' : entero(m)}
                        </td>
                      ))}
                      <td className="tabular px-2 py-2.5 text-right font-mono text-xs">{entero(sinMes)}</td>
                      <td className="tabular px-3 py-2.5 text-right font-mono text-xs">{entero(total)}</td>
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
            <p className="mb-3 text-sm text-ink-3">No entran en la proyección hasta que Dirección los apruebe.</p>
            <ul className={`${tarjeta} divide-y divide-line`}>
              {faltan.map((r) => (
                <li key={r.departamentoId} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                  <Link href={`/formulacion/${r.departamentoId}`} className="min-w-0 flex-1 text-accent hover:underline">
                    {r.departamento}
                  </Link>
                  <EstadoPresupuestoPildora estado={r.estado} />
                  <span className="tabular w-32 text-right font-mono text-ink-2">
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
