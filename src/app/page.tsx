import { getSesion, usuariosDisponibles } from '@/lib/sesion';
import { saldosPorAsignatura, saldosPorDepartamento, totalizar, ultimasOrdenes } from '@/lib/consultas';
import { money, pctUsado, fecha, iniciales } from '@/lib/formato';
import { SelectorUsuario } from '@/components/selector-usuario';
import { BarraSaldo, Leyenda } from '@/components/barra-saldo';
import { TarjetaCifra, PildoraEstado } from '@/components/tarjeta-cifra';

export default async function Página() {
  const sesion = await getSesion();

  if (!sesion) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16">
        <h1 className="mb-3 font-display text-2xl font-semibold">Sin datos todavía</h1>
        <p className="text-ink-2">
          La base está conectada pero no encuentro un colegio con un año presupuestario abierto.
          Corre <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-sm">db/esquema_gesemco.sql</code>{' '}
          completo, incluida la sección de datos de prueba.
        </p>
      </main>
    );
  }

  const { usuario, alcance, anio, colegio, etiquetaRol, rol } = sesion;
  const vistaAmplia = alcance.tipo === 'colegio';

  const [usuarios, saldos, porDepartamento, ordenes] = await Promise.all([
    usuariosDisponibles(),
    saldosPorAsignatura(alcance, anio.id),
    vistaAmplia ? saldosPorDepartamento(anio.id) : Promise.resolve([]),
    ultimasOrdenes(alcance, anio.id),
  ]);

  const total = totalizar(saldos);
  const pct = pctUsado(total.asignado, total.comprometido, total.ejecutado);
  const tonoDisponible = total.disponible < 0 ? 'bad' : pct >= 85 ? 'warn' : 'ok';

  const dondeMira =
    alcance.tipo === 'colegio' ? `${colegio.nombre}, los tres departamentos`
    : alcance.tipo === 'departamento' ? `Departamento de ${alcance.nombre}`
    : `${saldos.length} ${saldos.length === 1 ? 'asignatura' : 'asignaturas'} a tu cargo`;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-3">
          <div className="mr-auto flex items-center gap-3">
            <div className="grid size-8 place-items-center rounded-lg bg-accent font-display text-[13px] font-bold text-paper">
              GE
            </div>
            <div>
              <b className="block font-display text-sm font-semibold leading-tight">Presupuesto Escolar</b>
              <span className="block text-[11px] leading-tight text-ink-3">{colegio.nombre} · GESEMCO</span>
            </div>
          </div>
          <span className="rounded-full border border-line bg-surface-2 px-3 py-1 font-mono text-[11px] text-ink-2">
            Año {anio.anio} · {anio.estado}
          </span>
          <SelectorUsuario usuarios={usuarios} actual={usuario.id} />
        </div>
      </header>

      <div className="border-b border-line bg-surface-2">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-2.5">
          <div className="grid size-7 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-ink">
            {iniciales(usuario.nombre)}
          </div>
          <div>
            <b className="text-sm font-semibold">{usuario.nombre}</b>
            <span className="text-[13px] text-ink-3"> · {etiquetaRol}</span>
          </div>
          <span className="ml-auto text-xs text-ink-3">{dondeMira}</span>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-5 pb-20 pt-7">
        <section className="mb-8">
          <div className="mb-3.5 flex flex-wrap items-baseline gap-3">
            <h1 className="font-display text-lg font-semibold">Saldos</h1>
            <p className="text-[13px] text-ink-3">Disponible = asignado − comprometido − ejecutado</p>
          </div>

          <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(168px,1fr))] gap-3">
            <TarjetaCifra titulo="Presupuesto asignado" valor={money(total.asignado)} nota={dondeMira} />
            <TarjetaCifra titulo="Comprometido" valor={money(total.comprometido)} nota="en aprobación o aprobadas" />
            <TarjetaCifra titulo="Ejecutado" valor={money(total.ejecutado)} nota="recepcionadas o pagadas" />
            <TarjetaCifra titulo="Disponible" valor={money(total.disponible)} nota={`${pct}% del presupuesto usado`} tono={tonoDisponible} />
          </div>

          <div className="rounded-xl border border-line bg-surface p-4">
            <BarraSaldo {...total} />
            <Leyenda />
          </div>
        </section>

        {vistaAmplia && porDepartamento.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3.5 font-display text-lg font-semibold">Por departamento</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(272px,1fr))] gap-3">
              {porDepartamento.map((d) => (
                <div key={d.departamentoId} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-sm font-semibold">{d.departamento}</h3>
                      <p className="mt-0.5 text-[11px] text-ink-3">
                        {pctUsado(d.asignado, d.comprometido, d.ejecutado)}% usado
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] uppercase tracking-wider text-ink-3">Disponible</span>
                      <span className={`tabular font-mono text-base font-medium ${d.disponible < 0 ? 'text-bad' : ''}`}>
                        {money(d.disponible)}
                      </span>
                    </div>
                  </div>
                  <BarraSaldo {...d} />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mb-8">
          <h2 className="mb-3.5 font-display text-lg font-semibold">Ejecución por asignatura</h2>
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-2 text-[11px] uppercase tracking-wider text-ink-3">
                    <th className="border-b border-line px-3.5 py-2.5 text-left font-medium">Asignatura</th>
                    {vistaAmplia && <th className="border-b border-line px-3.5 py-2.5 text-left font-medium">Departamento</th>}
                    <th className="border-b border-line px-3.5 py-2.5 text-right font-medium">Asignado</th>
                    <th className="border-b border-line px-3.5 py-2.5 text-right font-medium">Comprometido</th>
                    <th className="border-b border-line px-3.5 py-2.5 text-right font-medium">Ejecutado</th>
                    <th className="border-b border-line px-3.5 py-2.5 text-right font-medium">Disponible</th>
                    <th className="border-b border-line px-3.5 py-2.5 text-left font-medium">Avance</th>
                  </tr>
                </thead>
                <tbody>
                  {saldos.map((s) => (
                    <tr key={s.asignaturaId}>
                      <td className="border-b border-line px-3.5 py-3">{s.asignatura}</td>
                      {vistaAmplia && <td className="border-b border-line px-3.5 py-3 text-ink-2">{s.departamento}</td>}
                      <td className="tabular border-b border-line px-3.5 py-3 text-right font-mono">{money(s.asignado)}</td>
                      <td className="tabular border-b border-line px-3.5 py-3 text-right font-mono">{money(s.comprometido)}</td>
                      <td className="tabular border-b border-line px-3.5 py-3 text-right font-mono">{money(s.ejecutado)}</td>
                      <td className={`tabular border-b border-line px-3.5 py-3 text-right font-mono ${s.disponible < 0 ? 'text-bad' : ''}`}>
                        {money(s.disponible)}
                      </td>
                      <td className="border-b border-line px-3.5 py-3">
                        <div className="min-w-[110px]">
                          <BarraSaldo {...s} />
                          <span className="mt-1 block text-[11px] text-ink-3">
                            {pctUsado(s.asignado, s.comprometido, s.ejecutado)}% usado
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {saldos.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-ink-3">
                        No hay asignaturas con presupuesto asignado en tu alcance.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3.5 font-display text-lg font-semibold">Últimas órdenes</h2>
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-2 text-[11px] uppercase tracking-wider text-ink-3">
                    <th className="border-b border-line px-3.5 py-2.5 text-left font-medium">Folio</th>
                    <th className="border-b border-line px-3.5 py-2.5 text-left font-medium">Detalle</th>
                    <th className="border-b border-line px-3.5 py-2.5 text-left font-medium">Asignatura</th>
                    <th className="border-b border-line px-3.5 py-2.5 text-right font-medium">Monto</th>
                    <th className="border-b border-line px-3.5 py-2.5 text-left font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenes.map((o) => (
                    <tr key={o.id}>
                      <td className="tabular border-b border-line px-3.5 py-3 align-top font-mono text-[13px]">
                        {o.folio}
                        <span className="mt-0.5 block text-xs text-ink-3">{fecha(o.fechaSolicitud)}</span>
                      </td>
                      <td className="border-b border-line px-3.5 py-3 align-top">
                        {o.justificacion ?? 'Sin justificación'}
                        <span className="mt-0.5 block text-xs text-ink-3">
                          {o.proveedor ?? 'Sin proveedor'} · {o.solicitante}
                        </span>
                      </td>
                      <td className="border-b border-line px-3.5 py-3 align-top text-ink-2">{o.asignatura}</td>
                      <td className="tabular border-b border-line px-3.5 py-3 text-right align-top font-mono">
                        {money(o.montoTotal)}
                      </td>
                      <td className="border-b border-line px-3.5 py-3 align-top">
                        <PildoraEstado estado={o.estado} />
                      </td>
                    </tr>
                  ))}
                  {ordenes.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-ink-3">
                        Todavía no hay órdenes de compra este año.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <footer className="mt-10 border-t border-line pt-5 text-xs text-ink-3">
          Fase 1 en construcción · rol activo: {rol}. Lo que sigue: ingreso de orden de compra con
          validación de saldo, bandeja de aprobación y excepciones por sobregiro.
        </footer>
      </main>
    </>
  );
}
