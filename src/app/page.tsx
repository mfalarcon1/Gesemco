import Link from 'next/link';
import { Encabezado, SinDatos, rolVisible } from '@/components/encabezado';
import { BarraSaldo, Leyenda } from '@/components/barra-saldo';
import { TarjetaCifra } from '@/components/tarjeta-cifra';
import { EstadoPresupuestoPildora } from '@/components/pildoras';
import { Pasos } from '@/components/pasos';
import { ResumenFormulacion } from '@/components/resumen-formulacion';
import { IconoAlerta, IconoCalendario, IconoDescarga, IconoFlecha, IconoOk, IconoReloj } from '@/components/iconos';
import { ayuda, boton, tarjeta, titulo, tituloPagina } from '@/components/ui';
import {
  esContabilidad, esDireccion, esEquipoCompra, getSesion, veEjecucionColegio, veGastoReal, type Sesion,
} from '@/lib/sesion';
import { notificacionesRecientes, saldosEjecucion, totalizar, type SaldoDepartamento } from '@/lib/consultas';
import {
  proyeccionColegio, resumenFormulacion, type EstadoPresupuesto, type FilaProyeccion, type ResumenPresupuesto,
} from '@/lib/formulacion';
import { pedidos, solicitudesPendientes, type Pedido, type Solicitud } from '@/lib/ejecucion';
import { esperaRevision, pasosDe, ultimaNovedad } from '@/lib/etapas';
import {
  conSigno, diasEntre, fecha, fechaCorta, hoyEnChile, money, pct, plazo, plural, primerNombre,
} from '@/lib/formato';

type Revisores = { direccion: boolean; contabilidad: boolean };

export default async function Inicio() {
  const sesion = await getSesion();
  if (!sesion) return <SinDatos />;

  const anioF = sesion.anioFormulacion;
  const anioE = sesion.anioEjecucion;
  const revisores: Revisores = { direccion: esDireccion(sesion), contabilidad: esContabilidad(sesion) };
  const compras = esEquipoCompra(sesion);
  const jefe = sesion.jefeDe;

  const [formulacion, avisos, proyeccion, solicitudes, saldos, misPedidos, porComprar] = await Promise.all([
    anioF ? resumenFormulacion(sesion.colegio.id, anioF.id) : Promise.resolve([]),
    notificacionesRecientes(sesion.usuario.id),
    anioF && revisores.contabilidad ? proyeccionColegio(sesion.colegio.id, anioF.id) : Promise.resolve(null),
    anioE && revisores.direccion ? solicitudesPendientes(sesion.colegio.id, anioE.id) : Promise.resolve([]),
    anioE && (veEjecucionColegio(sesion) || jefe)
      ? saldosEjecucion(sesion.colegio.id, anioE.id, veEjecucionColegio(sesion) ? undefined : [jefe!.id])
      : Promise.resolve([]),
    anioE && jefe
      ? pedidos({ colegioId: sesion.colegio.id, anioId: anioE.id, departamentoId: jefe.id, estados: ['pendiente_direccion', 'emitida', 'comprada'] })
      : Promise.resolve([]),
    anioE && compras
      ? pedidos({ colegioId: sesion.colegio.id, anioId: anioE.id, estados: ['emitida'], orden: 'urgente' })
      : Promise.resolve([]),
  ]);

  const miFormulacion = jefe ? formulacion.find((f) => f.departamentoId === jefe.id) : undefined;
  const miSaldo = jefe ? saldos.find((s) => s.departamentoId === jefe.id) : undefined;

  return (
    <>
      <Encabezado sesion={sesion} activo="inicio" />
      <main className="mx-auto max-w-6xl space-y-10 px-5 pb-24 pt-8">
        <div>
          <h1 className={tituloPagina}>Hola, {primerNombre(sesion.usuario.nombre)}</h1>
          <p className="mt-1 text-[17px] text-ink-2">{rolVisible(sesion)} · {sesion.colegio.nombre}</p>
        </div>

        {jefe && miFormulacion && anioF && <MiPresupuesto resumen={miFormulacion} anio={anioF.anio} />}

        {jefe && anioE && miSaldo && (
          <MisPedidos departamentoId={jefe.id} anio={anioE.anio} saldo={miSaldo} enCurso={misPedidos} />
        )}

        {compras && anioE && <PorComprar anio={anioE.anio} lista={porComprar} />}

        {revisores.direccion && anioE && <Solicitudes lista={solicitudes} />}

        {(revisores.direccion || revisores.contabilidad) && anioF && (
          <ParaRevisar filas={formulacion.filter((f) => esperaRevision(f, revisores))} revisores={revisores} />
        )}

        {proyeccion && anioF && (
          <TarjetaProyeccion anio={anioF.anio} filas={proyeccion} departamentos={formulacion.length} />
        )}

        {(revisores.direccion || revisores.contabilidad) && anioF && formulacion.length > 0 && (
          <EstadoFormulacion filas={formulacion} anio={anioF.anio} />
        )}

        {veEjecucionColegio(sesion) && anioE && <Ejecucion sesion={sesion} saldos={saldos} anio={anioE.anio} />}

        {!sesion.rol && (
          <p className={`${tarjeta} px-6 py-5 text-ink-2`}>
            Todavía no tienes un rol asignado. Pídele al administrador del sistema que te lo asigne.
          </p>
        )}

        <section aria-labelledby="avisos">
          <h2 id="avisos" className={`${titulo} mb-4`}>Avisos</h2>
          <div className={`${tarjeta} divide-y divide-line`}>
            {avisos.length === 0 && <p className="px-6 py-8 text-center text-ink-2">No tienes avisos.</p>}
            {avisos.map((a) => {
              const contenido = (
                <>
                  <p className="font-semibold text-ink">{a.titulo}</p>
                  {a.mensaje && <p className="mt-0.5 text-ink-2">{a.mensaje}</p>}
                  <p className="mt-1 text-sm text-ink-2">{fecha(a.creadaEn)}</p>
                </>
              );
              return a.enlace ? (
                <Link key={a.id} href={a.enlace} className="flex items-center gap-4 px-6 py-4 hover:bg-surface-2">
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
// Jefe de departamento: su presupuesto del próximo año y sus pedidos
// ---------------------------------------------------------------------

function MiPresupuesto({ resumen: r, anio }: { resumen: ResumenPresupuesto; anio: number }) {
  const e = r.estado;
  const reenviado = e === 'revision_contabilidad' && r.comentarioContabilidad !== null;
  const faltanMeses = r.lineasSinMes > 0 && (e === 'borrador' || e === 'devuelto' || e === 'con_reparos');

  const ahora: Record<EstadoPresupuesto | 'sin_iniciar', { texto: string; boton: string }> = {
    sin_iniciar: {
      texto: 'Empieza creando los programas que tu departamento hará el próximo año.',
      boton: 'Empezar mi presupuesto',
    },
    borrador: {
      texto: r.lineas === 0
        ? 'Agrega lo que necesitas a tus programas.'
        : faltanMeses
          ? 'Indica en qué meses usarás cada ítem y, cuando termines, envíalo a Dirección.'
          : 'Todos tus ítems tienen sus meses: cuando termines, envíalo a Dirección.',
      boton: 'Seguir con mi presupuesto',
    },
    devuelto: { texto: 'Dirección te lo devolvió con un comentario: ajústalo y vuelve a enviarlo.', boton: 'Ver lo que pidió Dirección' },
    enviado: { texto: 'Dirección lo está revisando. Te llegará un aviso cuando lo resuelva.', boton: 'Ver mi presupuesto' },
    revision_contabilidad: {
      texto: reenviado
        ? 'Lo reenviaste con los reparos corregidos y contabilidad lo está revisando. Te llegará un aviso cuando lo resuelva.'
        : 'Dirección lo aprobó y ahora lo revisa contabilidad. Te llegará un aviso cuando lo resuelva.',
      boton: 'Ver mi presupuesto',
    },
    con_reparos: {
      texto: 'Contabilidad te envió reparos: corrígelos y vuelve a enviárselo. Va directo a contabilidad, sin pasar otra vez por Dirección.',
      boton: 'Ver los reparos',
    },
    aprobado: {
      texto: `Está aprobado, con sus meses. Durante ${anio} pedirás desde aquí lo que necesites. No tienes nada pendiente.`,
      boton: 'Ver mi presupuesto',
    },
  };
  const paso = ahora[e ?? 'sin_iniciar'];
  const comentario = e === 'devuelto' ? r.comentarioDireccion : e === 'con_reparos' ? r.comentarioContabilidad : null;
  const armando = e === null || e === 'borrador' || e === 'devuelto';

  return (
    <section aria-labelledby="mi-presupuesto" className={`${tarjeta} p-6`}>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="min-w-[15rem] flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="mi-presupuesto" className={titulo}>Tu presupuesto {anio} de {r.departamento}</h2>
            <EstadoPresupuestoPildora estado={e} />
          </div>
          <p className="mt-1 text-[17px] text-ink">{paso.texto}</p>
          {comentario && (
            <blockquote className="mt-2 border-l-4 border-warn/50 pl-4 text-ink-2">“{comentario}”</blockquote>
          )}
          {faltanMeses && r.lineas > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-[15px] font-medium text-warn">
              <IconoCalendario className="size-4" />
              {r.lineasSinMes === 1 ? 'A 1 ítem le faltan sus meses' : `A ${r.lineasSinMes} ítems les faltan sus meses`}
            </p>
          )}
          {e !== 'aprobado' && (armando ? r.formulacionHasta : r.aprobacionHasta) && (
            <p className={`${ayuda} mt-2`}>
              {armando ? `Se arma hasta el ${fecha(r.formulacionHasta)}.` : `Se aprueba hasta el ${fecha(r.aprobacionHasta)}.`}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-ink-2">{e === 'aprobado' ? 'Monto aprobado' : 'Total'}</p>
          <p className="text-2xl font-semibold">{money(r.montoAprobado ?? r.formulado)}</p>
        </div>
      </div>

      <div className="mt-5">
        <Pasos pasos={pasosDe(r)} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`/formulacion/${r.departamentoId}`} className={boton.primario}>
          {paso.boton}<IconoFlecha className="size-4" />
        </Link>
        {faltanMeses && r.lineas > 0 && (
          <Link href={`/formulacion/${r.departamentoId}/meses`} className={boton.secundario}>
            <IconoCalendario className="size-4" />Indicar los meses
          </Link>
        )}
      </div>
    </section>
  );
}

function MisPedidos({
  departamentoId, anio, saldo: s, enCurso,
}: { departamentoId: number; anio: number; saldo: SaldoDepartamento; enCurso: Pedido[] }) {
  const cuenta = (estado: Pedido['estado']) => enCurso.filter((p) => p.estado === estado).length;
  const comprados = cuenta('comprada');
  const enlace = `/ejecucion/${departamentoId}`;

  return (
    <section aria-labelledby="mis-pedidos" className={`${tarjeta} p-6`}>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="min-w-[15rem] flex-1">
          <h2 id="mis-pedidos" className={titulo}>Tus pedidos {anio}</h2>
          <p className="mt-1 text-[17px] text-ink">
            Pide lo que necesitas al lado de cada ítem de tu presupuesto, con la fecha en que lo necesitas.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-ink-2">Te queda</p>
          <p className={`text-2xl font-semibold ${s.disponible < 0 ? 'text-bad' : ''}`}>{money(s.disponible)}</p>
          <p className="text-sm text-ink-2">de {money(s.vigente)}</p>
        </div>
      </div>

      <div className="mt-4 max-w-xl"><BarraSaldo {...s} /><Leyenda /></div>

      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[15px]" aria-label="Tus pedidos en curso">
        <li className="flex items-center gap-1.5"><IconoReloj className="size-4 text-accent" />{plural(cuenta('emitida'), 'por comprar', 'por comprar')}</li>
        {cuenta('pendiente_direccion') > 0 && (
          <li className="flex items-center gap-1.5 text-warn"><IconoAlerta className="size-4" />{plural(cuenta('pendiente_direccion'), 'esperando a Dirección', 'esperando a Dirección')}</li>
        )}
        {comprados > 0 && (
          <li className="flex items-center gap-1.5 font-semibold text-accent-ink">
            <IconoOk className="size-4" />{comprados === 1 ? '1 comprado: confirma cuando llegue' : `${comprados} comprados: confirma cuando lleguen`}
          </li>
        )}
      </ul>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={enlace} className={boton.primario}>Hacer un pedido<IconoFlecha className="size-4" /></Link>
        {comprados > 0 && <Link href={`${enlace}#mis-pedidos`} className={boton.secundario}>Confirmar lo que llegó</Link>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Equipo de compra
// ---------------------------------------------------------------------

function PorComprar({ anio, lista }: { anio: number; lista: Pedido[] }) {
  const hoy = hoyEnChile();
  const primeros = lista.slice(0, 5);
  return (
    <section aria-labelledby="por-comprar" className={`${tarjeta} p-6`}>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="min-w-[15rem] flex-1">
          <h2 id="por-comprar" className={titulo}>Por comprar</h2>
          <p className="mt-1 text-[17px] text-ink">
            {lista.length === 0
              ? `No hay órdenes de compra ${anio} pendientes.`
              : `${plural(lista.length, 'orden de compra', 'órdenes de compra')} por ${money(lista.reduce((s, p) => s + p.monto, 0))}. Primero lo que se necesita antes.`}
          </p>
        </div>
        <Link href="/compras" className={boton.primario}>Ir a compras<IconoFlecha className="size-4" /></Link>
      </div>
      {primeros.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {primeros.map((p) => {
            const n = diasEntre(hoy, p.necesariaPara);
            return (
              <li key={p.ordenId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <span className="w-20 shrink-0 font-semibold">{fechaCorta(p.necesariaPara)}</span>
                <span className="min-w-[12rem] flex-1">
                  <span className="block font-medium">{p.detalle}</span>
                  <span className="block text-sm text-ink-2">{p.departamento}</span>
                </span>
                <span className={`flex items-center gap-1 text-sm ${n < 0 ? 'font-semibold text-bad' : n <= 3 ? 'font-semibold text-warn' : 'text-ink-2'}`}>
                  {n <= 3 && <IconoReloj className="size-4" />}{plazo(hoy, p.necesariaPara)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------
// Dirección y contabilidad
// ---------------------------------------------------------------------

function Solicitudes({ lista }: { lista: Solicitud[] }) {
  return (
    <section aria-labelledby="solicitudes">
      <h2 id="solicitudes" className={`${titulo} mb-4`}>Solicitudes para extender un presupuesto</h2>
      {lista.length === 0 ? (
        <p className={`${tarjeta} px-6 py-6 text-ink-2`}>Ningún pedido espera tu decisión.</p>
      ) : (
        <ul className={`${tarjeta} divide-y divide-line`}>
          {lista.map((s) => (
            <li key={s.ordenId} className="flex flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4">
              <IconoAlerta className="size-5 shrink-0 text-warn" />
              <div className="min-w-[15rem] flex-1">
                <p className="text-lg font-semibold">{s.departamento} pide {money(s.faltaHoy)} más</p>
                <p className={ayuda}>{s.detalle} · para el {fechaCorta(s.necesariaPara)} · pedido el {fecha(s.pedidoEn)}</p>
              </div>
              <Link href={`/solicitudes#solicitud-${s.ordenId}`} className={boton.primario}>
                Resolver<IconoFlecha className="size-4" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Los presupuestos que esperan a quien mira: a Dirección, los enviados; a
 * contabilidad, los que Dirección aprobó o volvieron con los reparos
 * corregidos. El administrador ve ambos.
 */
function ParaRevisar({ filas, revisores }: { filas: ResumenPresupuesto[]; revisores: Revisores }) {
  return (
    <section aria-labelledby="para-revisar">
      <h2 id="para-revisar" className={`${titulo} mb-4`}>Presupuestos para revisar</h2>
      {filas.length === 0 ? (
        <p className={`${tarjeta} px-6 py-6 text-ink-2`}>
          No tienes presupuestos esperando tu revisión.
          {revisores.contabilidad && !revisores.direccion && ' Te llegan cuando Dirección los aprueba.'}
        </p>
      ) : (
        <ul className={`${tarjeta} divide-y divide-line`}>
          {filas.map((f) => (
            <li key={f.departamentoId} className="flex flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4">
              <div className="min-w-[15rem] flex-1">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-lg font-semibold">
                  {f.departamento}
                  {revisores.direccion && revisores.contabilidad && <EstadoPresupuestoPildora estado={f.estado} />}
                </p>
                <p className={ayuda}>
                  {ultimaNovedad(f)} · {plural(f.programas, 'programa', 'programas')} · {plural(f.lineas, 'ítem', 'ítems')}
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

/** Para contabilidad: lo que se necesitará cada mes del año que se formula. */
function TarjetaProyeccion({ anio, filas, departamentos }: { anio: number; filas: FilaProyeccion[]; departamentos: number }) {
  const total = filas.reduce((s, f) => s + f.total, 0);
  return (
    <section aria-labelledby="proyeccion" className={`${tarjeta} p-6`}>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
        <div className="min-w-[15rem] flex-1">
          <h2 id="proyeccion" className={titulo}>Proyección mensual {anio}</h2>
          <p className="mt-1 text-ink-2">
            {filas.length === 0
              ? 'Todavía no hay presupuestos aprobados. Cada uno que apruebes suma sus meses a la proyección.'
              : `${filas.length} de ${departamentos} departamentos aprobados · ${money(total)} en el año, mes a mes`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/proyeccion" className={boton.primario}>Ver la proyección<IconoFlecha className="size-4" /></Link>
          {filas.length > 0 && (
            <a href="/proyeccion/exportar" download className={boton.secundario}>
              <IconoDescarga className="size-4" />Descargar
            </a>
          )}
        </div>
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

function Ejecucion({ sesion, saldos, anio }: { sesion: Sesion; saldos: SaldoDepartamento[]; anio: number }) {
  const total = totalizar(saldos);
  const usado = pct(total.comprometido + total.ejecutado, total.vigente);

  return (
    <section aria-labelledby="ejecucion">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 id="ejecucion" className={titulo}>Presupuesto {anio} en curso</h2>
        <Link href="/ejecucion" className="text-[15px] font-medium text-accent hover:underline">Ver cada departamento y el mes a mes</Link>
      </div>
      <div className="mb-3 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <TarjetaCifra titulo="Presupuesto vigente" valor={money(total.vigente)}
          nota={total.modificaciones ? `incluye ${money(total.modificaciones)} en extensiones` : 'sin extensiones'} />
        <TarjetaCifra titulo="Por comprar" valor={money(total.comprometido)} nota="en la lista del equipo de compra" />
        <TarjetaCifra titulo="Comprado" valor={money(total.ejecutado)} nota="a precio presupuesto" />
        <TarjetaCifra titulo="Disponible" valor={money(total.disponible)} nota={`${usado}% del presupuesto usado`}
          tono={total.disponible < 0 ? 'bad' : 'normal'} />
        {veGastoReal(sesion) && (
          <TarjetaCifra titulo="Gasto real" valor={money(total.gastoReal)}
            nota={total.desviacion === 0 ? 'igual a lo presupuestado' : `${conSigno(total.desviacion)} sobre lo presupuestado`} />
        )}
      </div>
      <div className={`${tarjeta} p-5`}>
        <BarraSaldo {...total} />
        <Leyenda />
      </div>
    </section>
  );
}
