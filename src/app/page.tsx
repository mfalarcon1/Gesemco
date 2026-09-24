import Link from 'next/link';
import { Encabezado, SinDatos, rolVisible } from '@/components/encabezado';
import { BarraSaldo, Leyenda } from '@/components/barra-saldo';
import { TarjetaCifra } from '@/components/tarjeta-cifra';
import { EstadoPresupuestoPildora } from '@/components/pildoras';
import { Pasos } from '@/components/pasos';
import { ResumenFormulacion } from '@/components/resumen-formulacion';
import { IconoAlerta, IconoCalendario, IconoDescarga, IconoFlecha } from '@/components/iconos';
import { ayuda, boton, tarjeta, td, tdNum, th, titulo, tituloPagina } from '@/components/ui';
import { esContabilidad, esDireccion, getSesion, type Sesion } from '@/lib/sesion';
import {
  notificacionesRecientes, pendientesDeDireccion, saldosEjecucion, totalizar, type SaldoDepartamento,
} from '@/lib/consultas';
import {
  avanceMeses, proyeccionColegio, resumenFormulacion, type EstadoPresupuesto, type ResumenPresupuesto,
} from '@/lib/formulacion';
import { pasosDe, type Avance } from '@/lib/etapas';
import { fecha, money, pct, plural, primerNombre } from '@/lib/formato';

// Las rutas que ya existen. Los avisos que apuntan a pantallas de la
// etapa 2 (todavía en construcción) se muestran sin enlace.
const RUTAS_ACTIVAS = ['/formulacion', '/catalogo', '/proyeccion'];

export default async function Inicio() {
  const sesion = await getSesion();
  if (!sesion) return <SinDatos />;

  const departamentosPropios = sesion.veTodoElColegio
    ? undefined
    : [...new Set([sesion.jefeDe?.id, ...sesion.profesorEn.map((d) => d.id)].filter((x): x is number => !!x))];

  const anioF = sesion.anioFormulacion;
  const [saldos, formulacion, avisos, pendientes, proyeccion] = await Promise.all([
    sesion.anioEjecucion
      ? saldosEjecucion(sesion.colegio.id, sesion.anioEjecucion.id, departamentosPropios)
      : Promise.resolve([]),
    anioF ? resumenFormulacion(sesion.colegio.id, anioF.id) : Promise.resolve([]),
    notificacionesRecientes(sesion.usuario.id),
    esDireccion(sesion) ? pendientesDeDireccion(sesion.colegio.id) : Promise.resolve([]),
    anioF && esContabilidad(sesion) ? proyeccionColegio(sesion.colegio.id, anioF.id) : Promise.resolve(null),
  ]);

  const miFormulacion = sesion.jefeDe ? formulacion.find((f) => f.departamentoId === sesion.jefeDe!.id) : undefined;
  const miAvance: Avance = miFormulacion?.presupuestoId && miFormulacion.estado === 'aprobado'
    ? await avanceMeses(miFormulacion.presupuestoId)
    : { listos: 0, total: 0 };

  const soloProfesor = !sesion.jefeDe && !sesion.veTodoElColegio;

  return (
    <>
      <Encabezado sesion={sesion} activo="inicio" />
      <main className="mx-auto max-w-6xl space-y-10 px-5 pb-24 pt-8">
        <div>
          <h1 className={tituloPagina}>Hola, {primerNombre(sesion.usuario.nombre)}</h1>
          <p className="mt-1 text-[17px] text-ink-2">
            {rolVisible(sesion)} · {sesion.colegio.nombre}
            {soloProfesor && sesion.profesorEn.length > 0 && ` · clases en ${sesion.profesorEn.map((d) => d.nombre).join(' y ')}`}
          </p>
        </div>

        {sesion.jefeDe && miFormulacion && anioF && (
          <MiPresupuesto resumen={miFormulacion} anio={anioF.anio} avance={miAvance} />
        )}

        {esDireccion(sesion) && anioF && (
          <ParaRevisar filas={formulacion.filter((f) => f.estado === 'enviado')} />
        )}

        {proyeccion && anioF && (
          <TarjetaProyeccion anio={anioF.anio} filas={proyeccion} departamentos={formulacion.length} />
        )}

        {sesion.veTodoElColegio && anioF && formulacion.length > 0 && (
          <EstadoFormulacion filas={formulacion} anio={anioF.anio} />
        )}

        {pendientes.length > 0 && <PendientesDireccion pendientes={pendientes} />}

        {sesion.anioEjecucion && (
          <Ejecucion sesion={sesion} saldos={saldos} anio={sesion.anioEjecucion.anio} />
        )}

        {soloProfesor && (
          <p className={`${tarjeta} px-6 py-5 text-ink-2`}>
            Pronto podrás pedir materiales desde aquí: la solicitud llegará a tu jefe de departamento.
          </p>
        )}

        <section aria-labelledby="avisos">
          <h2 id="avisos" className={`${titulo} mb-4`}>Avisos</h2>
          <div className={`${tarjeta} divide-y divide-line`}>
            {avisos.length === 0 && <p className="px-6 py-8 text-center text-ink-2">No tienes avisos.</p>}
            {avisos.map((a) => {
              const activo = a.enlace && RUTAS_ACTIVAS.some((r) => a.enlace!.startsWith(r));
              const contenido = (
                <>
                  <p className="font-semibold text-ink">{a.titulo}</p>
                  {a.mensaje && <p className="mt-0.5 text-ink-2">{a.mensaje}</p>}
                  <p className="mt-1 text-sm text-ink-2">{fecha(a.creadaEn)}</p>
                </>
              );
              return activo ? (
                <Link key={a.id} href={a.enlace!} className="flex items-center gap-4 px-6 py-4 hover:bg-surface-2">
                  <span className="min-w-0 flex-1">{contenido}</span>
                  <IconoFlecha className="size-5 shrink-0 text-accent" />
                </Link>
              ) : (
                <div key={a.id} className="px-6 py-4">{contenido}</div>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}

// ---------------------------------------------------------------------
// Jefe de departamento: su presupuesto y qué hacer ahora
// ---------------------------------------------------------------------

function MiPresupuesto({ resumen: r, anio, avance }: { resumen: ResumenPresupuesto; anio: number; avance: Avance }) {
  const e = r.estado;
  const mesesListos = avance.total > 0 && avance.listos === avance.total;
  const presupuesto = `/formulacion/${r.departamentoId}`;

  const ahora: Record<EstadoPresupuesto | 'sin_iniciar', { texto: string; boton: string; href: string }> = {
    sin_iniciar: { texto: 'Empieza creando los programas que tu departamento hará el próximo año.', boton: 'Empezar mi presupuesto', href: presupuesto },
    borrador: { texto: 'Sigue agregando lo que necesitas y, cuando termines, envíalo a Dirección.', boton: 'Seguir con mi presupuesto', href: presupuesto },
    devuelto: { texto: 'Dirección te lo devolvió con un comentario: ajústalo y vuelve a enviarlo.', boton: 'Ver lo que pidió Dirección', href: presupuesto },
    enviado: { texto: 'Dirección lo está revisando. Te llegará un aviso cuando lo resuelva.', boton: 'Ver mi presupuesto', href: presupuesto },
    aprobado: mesesListos
      ? { texto: 'Está aprobado y todo tiene sus meses. No tienes nada pendiente.', boton: 'Ver mi presupuesto', href: presupuesto }
      : { texto: 'Está aprobado. Ahora indica en qué meses necesitas cada cosa.', boton: 'Indicar los meses', href: `${presupuesto}/meses` },
  };
  const paso = ahora[e ?? 'sin_iniciar'];

  return (
    <section aria-labelledby="mi-presupuesto" className={`${tarjeta} p-6`}>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="min-w-[15rem] flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="mi-presupuesto" className={titulo}>Tu presupuesto {anio} de {r.departamento}</h2>
            <EstadoPresupuestoPildora estado={e} />
          </div>
          <p className="mt-1 text-[17px] text-ink">{paso.texto}</p>
          {e === 'devuelto' && r.comentarioDireccion && (
            <blockquote className="mt-2 border-l-4 border-warn/50 pl-4 text-ink-2">“{r.comentarioDireccion}”</blockquote>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-ink-2">{e === 'aprobado' ? 'Monto aprobado' : 'Total'}</p>
          <p className="text-2xl font-semibold">{money(r.montoAprobado ?? r.formulado)}</p>
        </div>
      </div>

      <div className="mt-5">
        <Pasos pasos={pasosDe(r, avance)} />
      </div>

      <Link href={paso.href} className={`${boton.primario} mt-5`}>
        {e === 'aprobado' && !mesesListos && <IconoCalendario className="size-5" />}
        {paso.boton}<IconoFlecha className="size-4" />
      </Link>
    </section>
  );
}

// ---------------------------------------------------------------------
// Dirección y contabilidad
// ---------------------------------------------------------------------

function ParaRevisar({ filas }: { filas: ResumenPresupuesto[] }) {
  return (
    <section aria-labelledby="para-revisar">
      <h2 id="para-revisar" className={`${titulo} mb-4`}>Para revisar</h2>
      {filas.length === 0 ? (
        <p className={`${tarjeta} px-6 py-6 text-ink-2`}>No tienes presupuestos esperando tu revisión.</p>
      ) : (
        <ul className={`${tarjeta} divide-y divide-line`}>
          {filas.map((f) => (
            <li key={f.departamentoId} className="flex flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold">{f.departamento}</p>
                <p className={ayuda}>
                  Enviado el {fecha(f.enviadoEn)} · {plural(f.programas, 'programa', 'programas')} · {plural(f.lineas, 'ítem', 'ítems')}
                </p>
              </div>
              <p className="text-xl font-semibold">{money(f.formulado)}</p>
              <Link href={`/formulacion/${f.departamentoId}`} className={boton.primario}>
                Revisar {f.departamento}<IconoFlecha className="size-4" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TarjetaProyeccion({
  anio, filas, departamentos,
}: { anio: number; filas: Awaited<ReturnType<typeof proyeccionColegio>>; departamentos: number }) {
  const total = filas.reduce((s, f) => s + f.total, 0);
  const sinMes = filas.reduce((s, f) => s + f.sinMes, 0);
  return (
    <section aria-labelledby="proyeccion" className={`${tarjeta} flex flex-wrap items-center gap-x-6 gap-y-4 p-6`}>
      <div className="min-w-0 flex-1">
        <h2 id="proyeccion" className={titulo}>Proyección mensual {anio}</h2>
        <p className="mt-1 text-ink-2">
          {filas.length === 0
            ? 'Todavía no hay presupuestos aprobados.'
            : `${filas.length} de ${departamentos} departamentos aprobados · ${money(total)}${sinMes > 0 ? ` · ${money(sinMes)} todavía sin mes` : ''}`}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/proyeccion" className={boton.primario}>Ver la proyección<IconoFlecha className="size-4" /></Link>
        {filas.length > 0 && (
          <a href="/proyeccion/exportar" download className={boton.secundario}>
            <IconoDescarga className="size-4" />Descargar para Excel
          </a>
        )}
      </div>
    </section>
  );
}

function EstadoFormulacion({ filas, anio }: { filas: ResumenPresupuesto[]; anio: number }) {
  return (
    <section aria-labelledby="formulacion">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 id="formulacion" className={titulo}>Presupuestos {anio}</h2>
        <Link href="/formulacion" className="text-[15px] font-medium text-accent hover:underline">Ver todos los departamentos</Link>
      </div>
      <ResumenFormulacion filas={filas} />
    </section>
  );
}

function PendientesDireccion({ pendientes }: { pendientes: Awaited<ReturnType<typeof pendientesDeDireccion>> }) {
  return (
    <section aria-labelledby="pendientes">
      <h2 id="pendientes" className={`${titulo} mb-1`}>Pendientes de pedido</h2>
      <p className={`${ayuda} mb-4`}>
        Órdenes que no cupieron en el disponible de su departamento. Se resolverán desde la etapa 2, que viene después.
      </p>
      <div className={`${tarjeta} divide-y divide-line`}>
        {pendientes.map((p) => (
          <div key={p.id} className="flex flex-wrap items-start gap-3 px-6 py-4">
            <IconoAlerta className="mt-0.5 size-5 text-warn" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{p.departamento} · <span className="font-normal text-ink-2">orden {p.folio}</span></p>
              {p.observacion && <p className="text-ink-2">{p.observacion}</p>}
              <p className="mt-0.5 text-sm text-ink-2">Desde el {fecha(p.creadoEn)}</p>
            </div>
            <div className="text-right">
              <p className="tabular font-semibold">{money(p.monto)}</p>
              <p className="text-sm text-warn">excede en {money(p.excedido)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Ejecución del año en curso
// ---------------------------------------------------------------------

function Ejecucion({ sesion, saldos, anio }: { sesion: Sesion; saldos: SaldoDepartamento[]; anio: number }) {
  const total = totalizar(saldos);
  const usado = pct(total.comprometido + total.ejecutado, total.vigente);
  const verReal = esContabilidad(sesion) || esDireccion(sesion);

  const titular = sesion.veTodoElColegio
    ? `Presupuesto ${anio} en curso`
    : `Presupuesto ${anio} en curso · ${saldos.map((s) => s.departamento).join(' y ') || 'sin departamento'}`;

  return (
    <section aria-labelledby="ejecucion">
      <div className="mb-4">
        <h2 id="ejecucion" className={titulo}>{titular}</h2>
        <p className={`${ayuda} mt-1`}>
          Lo que queda: el presupuesto vigente, menos lo comprometido (órdenes por comprar) y lo ejecutado (ya comprado).
        </p>
      </div>

      <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
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

      <div className={`${tarjeta} mb-4 p-5`}>
        <BarraSaldo {...total} />
        <Leyenda />
      </div>

      {saldos.length > 1 && (
        <div className={`${tarjeta} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse">
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
                      <span className="font-medium">{s.departamento}</span>
                      {s.pendientes > 0 && (
                        <span className="ml-2 inline-flex items-center gap-1 text-sm text-warn">
                          <IconoAlerta className="size-4" />{s.pendientes} pendiente
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
                        <span className="mt-1 block text-[13px] text-ink-2">
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
