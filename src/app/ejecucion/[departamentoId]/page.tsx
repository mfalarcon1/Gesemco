import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Encabezado, SinAcceso, SinDatos } from '@/components/encabezado';
import { Aviso, leerAviso } from '@/components/aviso';
import { BarraSaldo, Leyenda } from '@/components/barra-saldo';
import { TarjetaCifra } from '@/components/tarjeta-cifra';
import { ItemParaPedir, PedidoExtra, type Plazo } from '@/components/pedir';
import { ListaPedidos } from '@/components/lista-pedidos';
import { IconoAlerta, IconoFlecha, IconoInfo, IconoVolver } from '@/components/iconos';
import { ayuda, boton, tarjeta, td, tdNum, th, titulo, tituloPagina } from '@/components/ui';
import { esJefeDe, getSesion, veEjecucionColegio, veEjecucionDe, veGastoReal } from '@/lib/sesion';
import { saldosEjecucion, type SaldoDepartamento } from '@/lib/consultas';
import { cuentasContables, mesesDePresupuesto, resumenDepartamento, type Mes } from '@/lib/formulacion';
import { pedidos, programasParaPedir } from '@/lib/ejecucion';
import { enCurso } from '@/lib/estados';
import { conSigno, fechaLarga, hoyEnChile, MESES, money, pct, plural, sumarDias } from '@/lib/formato';

type Props = {
  params: Promise<{ departamentoId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * El presupuesto en ejecución de un departamento. El jefe pide desde aquí:
 * al lado de cada ítem, o algo que no estaba en el presupuesto, con la
 * fecha en que lo necesita. Ve lo que le queda, sus pedidos y el mes a mes.
 * Dirección y contabilidad ven lo mismo, sin pedir, y con lo pagado.
 */
export default async function PedidosDepartamento({ params, searchParams }: Props) {
  const sesion = await getSesion();
  if (!sesion) return <SinDatos />;

  const departamentoId = Number((await params).departamentoId);
  if (!Number.isInteger(departamentoId) || departamentoId <= 0) notFound();

  const soyJefe = esJefeDe(sesion, departamentoId);
  const activo = sesion.jefeDe?.id === departamentoId ? 'pedidos' : 'ejecucion';

  if (!veEjecucionDe(sesion, departamentoId)) {
    return (
      <>
        <Encabezado sesion={sesion} activo={activo} />
        <SinAcceso mensaje="Los pedidos de un departamento los ven su jefe, Dirección y contabilidad." />
      </>
    );
  }
  if (!sesion.anioEjecucion) {
    return (
      <>
        <Encabezado sesion={sesion} activo={activo} />
        <SinAcceso mensaje="No hay un año en ejecución: todavía no se puede pedir." />
      </>
    );
  }

  const anioE = sesion.anioEjecucion;
  const resumen = await resumenDepartamento(departamentoId, anioE.id);
  if (!resumen) notFound();

  const aviso = await leerAviso(await searchParams);

  if (resumen.estado !== 'aprobado' || !resumen.presupuestoId) {
    return (
      <>
        <Encabezado sesion={sesion} activo={activo} />
        <main className="mx-auto max-w-3xl px-5 py-16">
          <h1 className={`${tituloPagina} mb-3`}>{resumen.departamento} no tiene presupuesto {anioE.anio} aprobado</h1>
          <p className="text-ink-2">Los pedidos se hacen contra el presupuesto aprobado por contabilidad.</p>
        </main>
      </>
    );
  }

  const hoy = hoyEnChile();
  const anticipacion = sesion.colegio.anticipacionDias;
  const minima = sumarDias(hoy, anticipacion);
  const maxima = `${anioE.anio}-12-31`;
  const plazo: Plazo | null = minima <= maxima ? { minima, maxima, anticipacion } : null;

  const [[saldo], programas, lista, meses, cuentas] = await Promise.all([
    saldosEjecucion(sesion.colegio.id, anioE.id, [departamentoId]),
    programasParaPedir(resumen.presupuestoId, hoy, anticipacion),
    pedidos({ colegioId: sesion.colegio.id, anioId: anioE.id, departamentoId }),
    mesesDePresupuesto(resumen.presupuestoId),
    soyJefe ? cuentasContables() : Promise.resolve([]),
  ]);
  if (!saldo) notFound();

  const verReal = veGastoReal(sesion);
  const enCursoLista = lista.filter((p) => enCurso(p.estado));
  const terminados = lista.filter((p) => !enCurso(p.estado));
  const comprados = lista.filter((p) => p.estado === 'comprada');

  return (
    <>
      <Encabezado sesion={sesion} activo={activo} />
      <Aviso {...aviso} />
      <main className="mx-auto max-w-6xl px-5 pb-24 pt-8">
        {veEjecucionColegio(sesion) && (
          <Link href="/ejecucion" className="mb-4 inline-flex items-center gap-1.5 text-[15px] font-medium text-accent hover:underline">
            <IconoVolver className="size-4" />Ejecución {anioE.anio} del colegio
          </Link>
        )}

        <div className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="min-w-[16rem] flex-1">
            <p className="text-[15px] font-medium text-ink-2">Presupuesto {anioE.anio} · en curso</p>
            <h1 className={tituloPagina}>{soyJefe && sesion.jefeDe?.id === departamentoId ? `Pedidos de ${resumen.departamento}` : resumen.departamento}</h1>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-ink-2">Te queda</p>
            <p className={`text-[32px] font-semibold leading-tight tracking-tight ${saldo.disponible < 0 ? 'text-bad' : ''}`}>
              {money(saldo.disponible)}
            </p>
          </div>
        </div>

        <Saldo saldo={saldo} verReal={verReal} />

        {soyJefe && (
          <div className="mt-6">
            <QueHacer comprados={comprados.length} plazo={plazo} anio={anioE.anio} />
          </div>
        )}

        <section id="presupuesto" aria-labelledby="presupuesto-titulo" className="mt-10 scroll-mt-28">
          <h2 id="presupuesto-titulo" className={titulo}>{soyJefe ? 'Tu presupuesto, ítem por ítem' : 'El presupuesto, ítem por ítem'}</h2>
          <p className={`${ayuda} mb-4 mt-1 max-w-3xl`}>
            Lo planificado para cada mes es una guía: se puede pedir antes, después o más en un mes, mientras el total quepa
            en el presupuesto. Lo que se pide se descuenta a precio presupuesto.
          </p>
          <div className="flex flex-col gap-6">
            {programas.map((prog) => (
              <article key={prog.id} id={`programa-${prog.id}`} className={`${tarjeta} scroll-mt-28 overflow-hidden`}>
                <header className="flex flex-wrap items-start gap-4 border-b border-line px-6 py-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-xl font-semibold">{prog.nombre}</h3>
                    {prog.descripcion && <p className="mt-1 text-ink-2">{prog.descripcion}</p>}
                  </div>
                  <p className="text-right">
                    <span className="block text-lg font-semibold">{money(prog.total)}</span>
                    <span className="block text-sm text-ink-2">{plural(prog.lineas.length, 'ítem', 'ítems')}</span>
                  </p>
                </header>
                <ul className="divide-y divide-line">
                  {prog.lineas.map((l) => (
                    <ItemParaPedir key={`${l.id}-${l.pedida}-${l.enEspera}`} item={l} departamentoId={departamentoId}
                      disponible={saldo.disponible} plazo={plazo} puedePedir={soyJefe} />
                  ))}
                </ul>
              </article>
            ))}
            {soyJefe && plazo && (
              <PedidoExtra key={`extra-${lista.length}`} departamentoId={departamentoId} disponible={saldo.disponible}
                plazo={plazo} cuentas={cuentas} />
            )}
          </div>
        </section>

        <section id="mis-pedidos" aria-labelledby="pedidos-titulo" className="mt-12 scroll-mt-28">
          <h2 id="pedidos-titulo" className={titulo}>{soyJefe ? 'Mis pedidos' : 'Pedidos'} {anioE.anio}</h2>
          <p className={`${ayuda} mb-4 mt-1`}>
            {lista.length === 0 ? 'Todavía no hay pedidos.' : `${plural(enCursoLista.length, 'en curso', 'en curso')} · ${plural(terminados.length, 'terminado', 'terminados')}`}
          </p>
          {enCursoLista.length > 0 && (
            <div className={`${tarjeta} overflow-hidden`}>
              <ListaPedidos pedidos={enCursoLista} departamentoId={departamentoId} acciones={soyJefe} verReal={verReal} />
            </div>
          )}
          {terminados.length > 0 && (
            <details className={`${tarjeta} mt-4 overflow-hidden`} open={enCursoLista.length === 0}>
              <summary className="cursor-pointer px-6 py-4 text-[15px] font-semibold text-accent">
                {enCursoLista.length === 0 ? 'Pedidos terminados' : `Ver los ${plural(terminados.length, 'pedido terminado', 'pedidos terminados')}`}
              </summary>
              <div className="border-t border-line">
                <ListaPedidos pedidos={terminados} departamentoId={departamentoId} acciones={false} verReal={verReal} />
              </div>
            </details>
          )}
        </section>

        <MesAMes meses={meses} anio={anioE.anio} />
      </main>
    </>
  );
}

function Saldo({ saldo: s, verReal }: { saldo: SaldoDepartamento; verReal: boolean }) {
  const pedido = s.comprometido + s.ejecutado;
  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <TarjetaCifra titulo="Presupuesto vigente" valor={money(s.vigente)}
          nota={s.modificaciones ? `${money(s.aprobado)} aprobado + ${money(s.modificaciones)} de Dirección` : 'el aprobado por contabilidad'} />
        <TarjetaCifra titulo="Ya pedido" valor={money(pedido)}
          nota={`${money(s.comprometido)} por comprar · ${money(s.ejecutado)} comprado`} />
        <TarjetaCifra titulo="Te queda" valor={money(s.disponible)} nota={`${pct(pedido, s.vigente)}% del presupuesto usado`}
          tono={s.disponible < 0 ? 'bad' : 'normal'} />
        {s.pendientes > 0 && (
          <TarjetaCifra titulo="Esperando a Dirección" valor={money(s.enPendiente)}
            nota={`${plural(s.pendientes, 'pedido que no cupo', 'pedidos que no cupieron')}`} tono="warn" />
        )}
        {verReal && (
          <TarjetaCifra titulo="Gasto real" valor={money(s.gastoReal)}
            nota={s.desviacion === 0 ? 'igual a lo presupuestado' : `${conSigno(s.desviacion)} sobre lo presupuestado`} />
        )}
      </div>
      <div className={`${tarjeta} mt-3 p-5`}>
        <BarraSaldo {...s} />
        <Leyenda />
      </div>
    </>
  );
}

function QueHacer({ comprados, plazo, anio }: { comprados: number; plazo: Plazo | null; anio: number }) {
  if (comprados > 0) {
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-accent/30 bg-accent-soft px-6 py-5">
        <IconoInfo className="size-6 shrink-0 text-accent-ink" />
        <div className="min-w-[15rem] flex-1 text-accent-ink">
          <p className="text-lg font-semibold">
            {comprados === 1 ? 'Se compró 1 de tus pedidos: confirma cuando llegue' : `Se compraron ${comprados} de tus pedidos: confirma cuando lleguen`}
          </p>
          <p className="mt-1">Así contabilidad sabe que lo comprado llegó, y si llegó bien.</p>
        </div>
        <a href="#mis-pedidos" className={boton.primario}>Ver mis pedidos<IconoFlecha className="size-4" /></a>
      </div>
    );
  }
  if (!plazo) {
    return (
      <p className={`${tarjeta} flex items-start gap-3 px-6 py-5 text-ink-2`}>
        <IconoAlerta className="mt-0.5 size-5 shrink-0 text-warn" />
        Ya no quedan fechas para pedir contra el presupuesto {anio}: los pedidos se hacen con anticipación y dentro del año.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-start gap-4 rounded-2xl border border-line bg-surface px-6 py-5">
      <IconoInfo className="mt-0.5 size-6 shrink-0 text-accent" />
      <div className="min-w-[15rem] flex-1">
        <p className="text-lg font-semibold text-ink">Para pedir, usa «Pedir» al lado de cada ítem</p>
        <p className="mt-1 text-ink-2">
          Indica para cuándo lo necesitas: con {plazo.anticipacion === 1 ? 'un día' : `${plazo.anticipacion} días`} de
          anticipación, lo más pronto es el {fechaLarga(plazo.minima)}. Si cabe en lo que te queda, pasa directo al equipo de
          compra; si no, Dirección decide si extiende tu presupuesto.
        </p>
      </div>
    </div>
  );
}

/** Lo planificado y lo pedido de cada mes: los meses son una guía, no un límite. */
function MesAMes({ meses, anio }: { meses: Mes[]; anio: number }) {
  const filas = meses.map((m, i) => ({ ...m, i })).filter((m) => m.planificado > 0 || m.pedido > 0);
  if (filas.length === 0) return null;
  const totalPlan = meses.reduce((s, m) => s + m.planificado, 0);
  const totalPedido = meses.reduce((s, m) => s + m.pedido, 0);

  return (
    <section id="mes-a-mes" aria-labelledby="mes-titulo" className="mt-12 scroll-mt-28">
      <h2 id="mes-titulo" className={titulo}>Mes a mes, {anio}</h2>
      <p className={`${ayuda} mb-4 mt-1 max-w-3xl`}>
        Lo planificado al armar el presupuesto y lo pedido para cada mes, según la fecha en que se necesita. Pedir más o
        menos en un mes no importa: se ahorra o se gasta en otro mes, mientras el total quepa en el presupuesto.
      </p>
      <div className={`${tarjeta} relative overflow-x-auto`}>
        <table className="w-full min-w-[480px] border-collapse">
          <thead>
            <tr className="bg-surface-2">
              <th className={th}>Mes</th>
              <th className={`${th} text-right`}>Planificado</th>
              <th className={`${th} text-right`}>Pedido</th>
              <th className={`${th} text-right`}>Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((m) => (
              <tr key={m.i}>
                <td className={`${td} capitalize`}>{MESES[m.i]}</td>
                <td className={tdNum}>{money(m.planificado)}</td>
                <td className={tdNum}>{money(m.pedido)}</td>
                <td className={`${tdNum} text-ink-2`}>{m.pedido === m.planificado ? '—' : conSigno(m.pedido - m.planificado)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface-2 font-semibold">
              <td className="px-4 py-3">Total</td>
              <td className="tabular px-4 py-3 text-right">{money(totalPlan)}</td>
              <td className="tabular px-4 py-3 text-right">{money(totalPedido)}</td>
              <td className="tabular px-4 py-3 text-right text-ink-2">{totalPedido === totalPlan ? '—' : conSigno(totalPedido - totalPlan)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
