import Link from 'next/link';
import { Encabezado, SinDatos } from '@/components/encabezado';
import { BarraSaldo, Leyenda } from '@/components/barra-saldo';
import { TarjetaCifra } from '@/components/tarjeta-cifra';
import { EstadoPresupuestoPildora } from '@/components/pildoras';
import { IconoAlerta } from '@/components/iconos';
import { tarjeta, td, tdNum, th, titulo } from '@/components/ui';
import { esContabilidad, esDireccion, getSesion, type Sesion } from '@/lib/sesion';
import {
  notificacionesRecientes, pendientesDeDireccion, saldosEjecucion, totalizar, type SaldoDepartamento,
} from '@/lib/consultas';
import { resumenFormulacion, type EstadoPresupuesto } from '@/lib/formulacion';
import { fecha, money, pct } from '@/lib/formato';

// Las rutas que ya existen. Los avisos que apuntan a pantallas de la
// etapa 2 (todavía en construcción) se muestran sin enlace.
const RUTAS_ACTIVAS = ['/formulacion', '/catalogo', '/proyeccion'];

export default async function Inicio() {
  const sesion = await getSesion();
  if (!sesion) return <SinDatos />;

  const departamentosPropios = sesion.veTodoElColegio
    ? undefined
    : [...new Set([sesion.jefeDe?.id, ...sesion.profesorEn.map((d) => d.id)].filter((x): x is number => !!x))];

  const [saldos, formulacion, avisos, pendientes] = await Promise.all([
    sesion.anioEjecucion
      ? saldosEjecucion(sesion.colegio.id, sesion.anioEjecucion.id, departamentosPropios)
      : Promise.resolve([]),
    sesion.anioFormulacion ? resumenFormulacion(sesion.colegio.id, sesion.anioFormulacion.id) : Promise.resolve([]),
    notificacionesRecientes(sesion.usuario.id),
    esDireccion(sesion) ? pendientesDeDireccion(sesion.colegio.id) : Promise.resolve([]),
  ]);

  const miFormulacion = sesion.jefeDe ? formulacion.find((f) => f.departamentoId === sesion.jefeDe!.id) : undefined;

  return (
    <>
      <Encabezado sesion={sesion} activo="inicio" />
      <main className="mx-auto max-w-6xl px-5 pb-20 pt-7">
        {sesion.jefeDe && miFormulacion && sesion.anioFormulacion && (
          <MiFormulacion
            departamentoId={sesion.jefeDe.id}
            departamento={sesion.jefeDe.nombre}
            anio={sesion.anioFormulacion.anio}
            estado={miFormulacion.estado}
            formulado={miFormulacion.formulado}
            comentario={miFormulacion.comentarioDireccion}
          />
        )}

        {sesion.veTodoElColegio && sesion.anioFormulacion && formulacion.length > 0 && (
          <ResumenFormulacion sesion={sesion} filas={formulacion} anio={sesion.anioFormulacion.anio} />
        )}

        {pendientes.length > 0 && <PendientesDireccion pendientes={pendientes} />}

        {sesion.anioEjecucion && (
          <Ejecucion sesion={sesion} saldos={saldos} anio={sesion.anioEjecucion.anio} />
        )}

        <section>
          <h2 className={`${titulo} mb-3.5`}>Avisos</h2>
          <div className={`${tarjeta} divide-y divide-line`}>
            {avisos.length === 0 && <p className="px-4 py-6 text-center text-sm text-ink-3">No tienes avisos.</p>}
            {avisos.map((a) => {
              const activo = a.enlace && RUTAS_ACTIVAS.some((r) => a.enlace!.startsWith(r));
              const contenido = (
                <>
                  <p className="text-sm font-medium text-ink">{a.titulo}</p>
                  {a.mensaje && <p className="mt-0.5 text-sm text-ink-2">{a.mensaje}</p>}
                  <p className="mt-1 text-xs text-ink-3">{fecha(a.creadaEn)}</p>
                </>
              );
              return activo ? (
                <Link key={a.id} href={a.enlace!} className="block px-4 py-3 hover:bg-surface-2">{contenido}</Link>
              ) : (
                <div key={a.id} className="px-4 py-3">{contenido}</div>
              );
            })}
          </div>
        </section>

        <footer className="mt-10 border-t border-line pt-5 text-xs text-ink-3">
          Etapa 1 (formulación) en construcción. La etapa 2 (solicitudes de profesores, órdenes, pendientes y
          compras) ya está en la base de datos; sus pantallas vienen después.
        </footer>
      </main>
    </>
  );
}

function MiFormulacion({
  departamentoId, departamento, anio, estado, formulado, comentario,
}: {
  departamentoId: number; departamento: string; anio: number;
  estado: EstadoPresupuesto | null; formulado: number; comentario: string | null;
}) {
  const siguientePaso: Record<EstadoPresupuesto | 'sin_iniciar', string> = {
    sin_iniciar: 'Empieza creando los programas que tu departamento hará el próximo año.',
    borrador: 'Sigue armando tus programas y envíalo a Dirección cuando esté listo.',
    enviado: 'Dirección lo está revisando. Te llegará un aviso cuando lo resuelva.',
    devuelto: 'Dirección lo devolvió con comentarios: ajústalo y vuelve a enviarlo.',
    aprobado: 'Está aprobado. Indica cuántas unidades de cada línea necesitas en cada mes.',
  };

  return (
    <section className={`${tarjeta} mb-8 flex flex-wrap items-center gap-4 p-5`}>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h2 className={titulo}>Presupuesto {anio} de {departamento}</h2>
          <EstadoPresupuestoPildora estado={estado} />
        </div>
        <p className="text-sm text-ink-2">{siguientePaso[estado ?? 'sin_iniciar']}</p>
        {estado === 'devuelto' && comentario && (
          <p className="mt-2 text-sm text-ink"><b className="font-medium">Dirección:</b> {comentario}</p>
        )}
      </div>
      <div className="text-right">
        <p className="text-xs text-ink-3">Formulado</p>
        <p className="text-xl font-semibold">{money(formulado)}</p>
      </div>
      <Link href={`/formulacion/${departamentoId}`}
        className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-paper hover:opacity-90">
        Ir a mi presupuesto
      </Link>
    </section>
  );
}

function ResumenFormulacion({
  sesion, filas, anio,
}: {
  sesion: Sesion; filas: Awaited<ReturnType<typeof resumenFormulacion>>; anio: number;
}) {
  const cuenta = (e: EstadoPresupuesto | null) => filas.filter((f) => f.estado === e).length;
  const porRevisar = filas.filter((f) => f.estado === 'enviado');
  const formulado = filas.reduce((s, f) => s + f.formulado, 0);
  const aprobado = filas.reduce((s, f) => s + (f.montoAprobado ?? 0), 0);

  return (
    <section className="mb-8">
      <div className="mb-3.5 flex flex-wrap items-baseline gap-3">
        <h2 className={titulo}>Formulación {anio}</h2>
        <Link href="/formulacion" className="text-sm text-accent hover:underline">Ver todos los departamentos</Link>
      </div>

      {esDireccion(sesion) && porRevisar.length > 0 && (
        <div className="mb-4 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent-ink">
          <b className="font-semibold">
            {porRevisar.length === 1 ? 'Un presupuesto espera' : `${porRevisar.length} presupuestos esperan`} tu revisión:
          </b>{' '}
          {porRevisar.map((f, i) => (
            <span key={f.departamentoId}>
              {i > 0 && ', '}
              <Link href={`/formulacion/${f.departamentoId}`} className="underline underline-offset-2">{f.departamento}</Link>
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(168px,1fr))] gap-3">
        <TarjetaCifra titulo="Formulado" valor={money(formulado)}
          nota={`${filas.filter((f) => f.lineas > 0).length} departamentos con líneas`} />
        <TarjetaCifra titulo="Aprobados" valor={`${cuenta('aprobado')} de ${filas.length}`} nota={money(aprobado)} />
        <TarjetaCifra titulo="En revisión" valor={String(cuenta('enviado'))} nota="enviados a Dirección" />
        <TarjetaCifra titulo="En preparación" valor={String(cuenta('borrador') + cuenta('devuelto'))}
          nota={cuenta('devuelto') === 1 ? '1 devuelto con comentarios' : `${cuenta('devuelto')} devueltos con comentarios`} />
        <TarjetaCifra titulo="Sin iniciar" valor={String(cuenta(null))} nota="todavía sin programas" />
      </div>
    </section>
  );
}

function PendientesDireccion({ pendientes }: { pendientes: Awaited<ReturnType<typeof pendientesDeDireccion>> }) {
  return (
    <section className="mb-8">
      <h2 className={`${titulo} mb-1`}>Pendientes de pedido</h2>
      <p className="mb-3.5 text-sm text-ink-3">
        Órdenes que no cupieron en el disponible de su departamento. Su resolución se hace desde la etapa 2,
        que viene después.
      </p>
      <div className={`${tarjeta} divide-y divide-line`}>
        {pendientes.map((p) => (
          <div key={p.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
            <IconoAlerta className="mt-0.5 size-4 text-warn" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{p.departamento} · <span className="font-mono">{p.folio}</span></p>
              {p.observacion && <p className="text-sm text-ink-2">{p.observacion}</p>}
              <p className="mt-0.5 text-xs text-ink-3">Desde el {fecha(p.creadoEn)}</p>
            </div>
            <div className="text-right text-sm">
              <p className="tabular font-mono">{money(p.monto)}</p>
              <p className="text-xs text-warn">excede en {money(p.excedido)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Ejecucion({ sesion, saldos, anio }: { sesion: Sesion; saldos: SaldoDepartamento[]; anio: number }) {
  const total = totalizar(saldos);
  const usado = pct(total.comprometido + total.ejecutado, total.vigente);
  const verReal = esContabilidad(sesion) || esDireccion(sesion);

  const titular = sesion.veTodoElColegio
    ? `Ejecución ${anio}`
    : `Ejecución ${anio} · ${saldos.map((s) => s.departamento).join(' y ') || 'sin departamento'}`;

  return (
    <section className="mb-8">
      <div className="mb-3.5 flex flex-wrap items-baseline gap-3">
        <h2 className={titulo}>{titular}</h2>
        <p className="text-[13px] text-ink-3">Disponible = vigente − comprometido − ejecutado, a precio presupuesto</p>
      </div>

      <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(168px,1fr))] gap-3">
        <TarjetaCifra titulo="Presupuesto vigente" valor={money(total.vigente)}
          nota={total.modificaciones ? `incluye ${money(total.modificaciones)} en modificaciones` : 'sin modificaciones'} />
        <TarjetaCifra titulo="Comprometido" valor={money(total.comprometido)} nota="órdenes emitidas, por comprar" />
        <TarjetaCifra titulo="Ejecutado" valor={money(total.ejecutado)} nota="órdenes compradas o recibidas" />
        <TarjetaCifra titulo="Disponible" valor={money(total.disponible)} nota={`${usado}% del presupuesto usado`}
          tono={total.disponible < 0 ? 'bad' : 'normal'} />
        {verReal && (
          <TarjetaCifra titulo="Gasto real" valor={money(total.gastoReal)}
            nota={total.desviacion === 0 ? 'igual a lo presupuestado'
              : `${money(Math.abs(total.desviacion))} ${total.desviacion > 0 ? 'sobre' : 'bajo'} lo presupuestado`} />
        )}
      </div>

      <div className={`${tarjeta} mb-4 p-4`}>
        <BarraSaldo {...total} />
        <Leyenda />
      </div>

      {saldos.length > 1 && (
        <div className={`${tarjeta} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="bg-surface-2">
                  <th className={th}>Departamento</th>
                  <th className={`${th} text-right`}>Vigente</th>
                  <th className={`${th} text-right`}>Comprometido</th>
                  <th className={`${th} text-right`}>Ejecutado</th>
                  <th className={`${th} text-right`}>Disponible</th>
                  {verReal && <th className={`${th} text-right`}>Desviación</th>}
                  <th className={th}>Avance</th>
                </tr>
              </thead>
              <tbody>
                {saldos.map((s) => (
                  <tr key={s.departamentoId}>
                    <td className={td}>
                      {s.departamento}
                      {s.pendientes > 0 && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs text-warn">
                          <IconoAlerta className="size-3.5" />{s.pendientes} pendiente
                        </span>
                      )}
                    </td>
                    <td className={tdNum}>{money(s.vigente)}</td>
                    <td className={tdNum}>{money(s.comprometido)}</td>
                    <td className={tdNum}>{money(s.ejecutado)}</td>
                    <td className={`${tdNum} ${s.disponible < 0 ? 'text-bad' : ''}`}>{money(s.disponible)}</td>
                    {verReal && (
                      <td className={`${tdNum} text-ink-2`}>
                        {s.desviacion === 0 ? '—' : `${s.desviacion > 0 ? '+' : '−'}${money(Math.abs(s.desviacion))}`}
                      </td>
                    )}
                    <td className={td}>
                      <div className="min-w-[120px]">
                        <BarraSaldo {...s} />
                        <span className="mt-1 block text-[11px] text-ink-3">
                          {pct(s.comprometido + s.ejecutado, s.vigente)}% usado
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
