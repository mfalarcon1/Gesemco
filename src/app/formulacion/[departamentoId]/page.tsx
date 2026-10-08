import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Encabezado, SinAcceso, SinDatos } from '@/components/encabezado';
import { Aviso, leerAviso } from '@/components/aviso';
import { EstadoPresupuestoPildora } from '@/components/pildoras';
import { Pasos } from '@/components/pasos';
import { BotonConConfirmacion } from '@/components/confirmar';
import { ColumnasMensuales } from '@/components/columnas-mensuales';
import { ItemPresupuesto } from '@/components/item-presupuesto';
import { ItemAMano } from '@/components/item-a-mano';
import { NuevoPrograma } from '@/components/nuevo-programa';
import { COLUMNAS_ITEM, type ModoItem } from '@/components/columnas-item';
import {
  IconoAlerta, IconoBuscar, IconoCalendario, IconoFlecha, IconoOk, IconoReloj, IconoVolver,
} from '@/components/iconos';
import { ayuda, boton, campo, tarjeta, titulo, tituloPagina } from '@/components/ui';
import {
  esContabilidad, esDireccion, esJefeDe, getSesion, participaEnFormulacion, veProyeccion,
} from '@/lib/sesion';
import {
  cuentasContables, esEditable, mesesDePresupuesto, programasConLineas, resumenDepartamento,
  type Mes, type ProgramaConLineas, type ResumenPresupuesto,
} from '@/lib/formulacion';
import { fecha, MESES, money, plural } from '@/lib/formato';
import { pasosDe } from '@/lib/etapas';
import {
  aprobarContabilidad, aprobarDireccion, devolverPresupuesto, eliminarPrograma, enviarADireccion,
  enviarReparos, reenviarAContabilidad, retirarEnvio,
} from '../acciones';

type Props = {
  params: Promise<{ departamentoId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type Cuenta = Awaited<ReturnType<typeof cuentasContables>>[number];

export default async function PresupuestoDepartamento({ params, searchParams }: Props) {
  const sesion = await getSesion();
  if (!sesion) return <SinDatos />;

  const departamentoId = Number((await params).departamentoId);
  if (!Number.isInteger(departamentoId) || departamentoId <= 0) notFound();

  const puedeVer = participaEnFormulacion(sesion) && (sesion.veTodoElColegio || sesion.jefeDe?.id === departamentoId);
  if (!puedeVer) {
    return (
      <>
        <Encabezado sesion={sesion} activo="formulacion" />
        <SinAcceso mensaje="El presupuesto de un departamento lo ven su jefe, Dirección y contabilidad." />
      </>
    );
  }
  if (!sesion.anioFormulacion) {
    return (
      <>
        <Encabezado sesion={sesion} activo="formulacion" />
        <SinAcceso mensaje="No hay un año abierto para formular." />
      </>
    );
  }

  const resumen = await resumenDepartamento(departamentoId, sesion.anioFormulacion.id);
  if (!resumen) notFound();

  const [programas, cuentas, meses] = await Promise.all([
    resumen.presupuestoId ? programasConLineas(resumen.presupuestoId) : Promise.resolve([]),
    cuentasContables(),
    resumen.presupuestoId ? mesesDePresupuesto(resumen.presupuestoId) : Promise.resolve(null),
  ]);

  const soyJefe = esJefeDe(sesion, departamentoId);
  const editable = soyJefe && esEditable(resumen.estado);
  const aviso = await leerAviso(await searchParams);
  const anio = sesion.anioFormulacion.anio;

  const lineas = programas.flatMap((p) => p.lineas);
  const modo: ModoItem = editable ? 'editable' : 'lectura';
  const enlaceMeses = `/formulacion/${departamentoId}/meses`;

  return (
    <>
      <Encabezado sesion={sesion} activo="formulacion" />
      <Aviso {...aviso} />
      <main className="mx-auto max-w-6xl px-5 pb-24 pt-8">
        {sesion.veTodoElColegio && (
          <Link href="/formulacion" className="mb-4 inline-flex items-center gap-1.5 text-[15px] font-medium text-accent hover:underline">
            <IconoVolver className="size-4" />Todos los presupuestos {anio}
          </Link>
        )}

        <div className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="min-w-[16rem] flex-1">
            <p className="text-[15px] font-medium text-ink-2">
              Presupuesto {anio}
              {resumen.estado !== 'aprobado' && <Plazos resumen={resumen} />}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className={tituloPagina}>{resumen.departamento}</h1>
              <EstadoPresupuestoPildora estado={resumen.estado} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-ink-2">{resumen.estado === 'aprobado' ? 'Monto aprobado' : 'Total'}</p>
            <p className="text-[32px] font-semibold leading-tight tracking-tight">
              {money(resumen.montoAprobado ?? resumen.formulado)}
            </p>
          </div>
        </div>

        <Pasos pasos={pasosDe(resumen)} />

        <div className="mt-6">
          <QueHacer resumen={resumen} soyJefe={soyJefe} soyDireccion={esDireccion(sesion)}
            soyContabilidad={esContabilidad(sesion)} verProyeccion={veProyeccion(sesion)} />
        </div>

        <section id="programas" className="mt-10 scroll-mt-28">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div>
              <h2 className={titulo}>Programas</h2>
              {programas.length > 0 && (
                <p className={ayuda}>
                  {plural(programas.length, 'programa', 'programas')} · {plural(lineas.length, 'ítem', 'ítems')}
                  {resumen.fueraCatalogo > 0 && ` · ${money(resumen.fueraCatalogo)} fuera del catálogo`}
                </p>
              )}
            </div>
            {lineas.length > 0 && (
              <Link href={enlaceMeses}
                className={editable && resumen.lineasSinMes > 0 ? boton.primario : boton.secundario}>
                <IconoCalendario className="size-5" />
                {editable ? (resumen.lineasSinMes > 0 ? 'Indicar los meses' : 'Revisar los meses') : 'Ver los meses en una grilla'}
              </Link>
            )}
          </div>

          {programas.length === 0 ? (
            editable ? (
              <Bienvenida departamentoId={departamentoId} anio={anio} />
            ) : (
              <p className={`${tarjeta} px-6 py-10 text-center text-ink-2`}>El departamento todavía no crea programas.</p>
            )
          ) : (
            <div className="flex flex-col gap-6">
              {programas.map((p) => (
                <TarjetaPrograma key={p.id} programa={p} departamentoId={departamentoId} modo={modo}
                  editable={editable} mostrarCuenta={sesion.veTodoElColegio} cuentas={cuentas} />
              ))}
              {/* Las keys salen de los datos: cuando una acción sale bien los datos cambian y el
                  formulario se cierra; si sale mal, sigue abierto con lo que se escribió. */}
              {editable && <NuevoPrograma key={`nuevo-${programas.length}`} departamentoId={departamentoId} />}
            </div>
          )}
        </section>

        {meses && lineas.length > 0 && (
          <MesAMes meses={meses} resumen={resumen} anio={anio} />
        )}
      </main>
    </>
  );
}

/** Hasta cuándo se arma y hasta cuándo se aprueba: informativo. */
function Plazos({ resumen: r }: { resumen: ResumenPresupuesto }) {
  const armando = r.estado === null || r.estado === 'borrador' || r.estado === 'devuelto';
  if (armando && r.formulacionHasta) return <> · se arma hasta el {fecha(r.formulacionHasta)}</>;
  if (r.aprobacionHasta) return <> · se aprueba hasta el {fecha(r.aprobacionHasta)}</>;
  return null;
}

// ---------------------------------------------------------------------
// En qué va el presupuesto y qué hay que hacer ahora
// ---------------------------------------------------------------------

/**
 * Con ítems sin meses no se puede enviar (la base lo exige): en vez del
 * botón de envío, la acción que toca es indicar los meses.
 */
function FaltanMeses({ resumen: r }: { resumen: ResumenPresupuesto }) {
  return (
    <Link href={`/formulacion/${r.departamentoId}/meses`} className={boton.primario}>
      <IconoCalendario className="size-5" />Indicar los meses
    </Link>
  );
}

function QueHacer({
  resumen: r, soyJefe, soyDireccion, soyContabilidad, verProyeccion,
}: {
  resumen: ResumenPresupuesto; soyJefe: boolean; soyDireccion: boolean; soyContabilidad: boolean; verProyeccion: boolean;
}) {
  const oculto = <input type="hidden" name="departamentoId" value={r.departamentoId} />;
  const sinMes = r.lineasSinMes > 0;
  const avisoMeses = sinMes
    ? ` Antes de enviarlo, indica los meses: ${r.lineasSinMes === 1 ? 'a 1 ítem le faltan' : `a ${r.lineasSinMes} ítems les faltan`}.`
    : '';

  if (r.estado === 'enviado' && soyDireccion) return <DecisionDireccion resumen={r} />;
  if (r.estado === 'revision_contabilidad' && soyContabilidad) return <DecisionContabilidad resumen={r} />;

  if (r.estado === 'devuelto') {
    return (
      <Comentario
        titulo={`${soyJefe ? 'Dirección te devolvió el presupuesto' : 'Dirección devolvió el presupuesto'} el ${fecha(r.resueltoDireccionEn)}`}
        comentario={r.comentarioDireccion}
        explicacion={soyJefe
          ? `Ajusta lo que te pidió en los programas de abajo y vuelve a enviarlo a Dirección.${avisoMeses}`
          : 'El jefe lo está ajustando.'}
        accion={soyJefe && (sinMes ? <FaltanMeses resumen={r} /> : (
          <form action={enviarADireccion}>
            {oculto}
            <button className={boton.primario}>Enviar de nuevo a Dirección</button>
          </form>
        ))}
      />
    );
  }

  if (r.estado === 'con_reparos') {
    return (
      <Comentario
        titulo={`${soyJefe ? 'Contabilidad te envió reparos' : 'Contabilidad envió reparos'} el ${fecha(r.resueltoContabilidadEn)}`}
        comentario={r.comentarioContabilidad}
        explicacion={soyJefe
          ? `Corrige lo que te pidió en los programas de abajo. Cuando lo reenvíes, vuelve directo a contabilidad, sin pasar otra vez por Dirección.${avisoMeses}`
          : 'El jefe lo está corrigiendo. Cuando lo reenvíe, vuelve directo a contabilidad.'}
        accion={soyJefe && (sinMes ? <FaltanMeses resumen={r} /> : (
          <form action={reenviarAContabilidad}>
            {oculto}
            <button className={boton.primario} disabled={r.lineas === 0}>Enviar de nuevo a contabilidad</button>
          </form>
        ))}
      />
    );
  }

  if (r.estado === 'enviado') {
    return (
      <Informacion icono={<IconoReloj className="mt-0.5 size-6 shrink-0 text-accent-ink" />}
        titulo={`${soyJefe ? 'Dirección está revisando tu presupuesto' : 'En revisión de Dirección'} desde el ${fecha(r.enviadoEn)}`}
        texto={soyJefe
          ? 'Te llegará un aviso cuando lo apruebe o te lo devuelva. Mientras tanto no se puede editar; si necesitas corregir algo, retira el envío.'
          : 'Dirección lo revisa con el jefe. Si lo aprueba, pasa a contabilidad.'}
        accion={soyJefe && (
          <form action={retirarEnvio}>
            {oculto}
            <button className={boton.secundario}>Retirar envío</button>
          </form>
        )}
      />
    );
  }

  if (r.estado === 'revision_contabilidad') {
    return (
      <Informacion icono={<IconoReloj className="mt-0.5 size-6 shrink-0 text-accent-ink" />}
        titulo={`${soyJefe ? 'Contabilidad está revisando tu presupuesto' : 'En revisión de contabilidad'} desde el ${fecha(r.enContabilidadDesde)}`}
        texto={soyJefe
          ? `${r.comentarioContabilidad ? 'Lo reenviaste con los reparos corregidos.' : 'Dirección ya lo aprobó.'} Te llegará un aviso cuando contabilidad lo apruebe o te envíe reparos. Mientras tanto no se puede editar.`
          : r.comentarioContabilidad
            ? `El jefe lo reenvió el ${fecha(r.enviadoEn)} con los reparos corregidos. Ahora contabilidad lo aprueba o envía nuevos reparos.`
            : `Dirección lo aprobó el ${fecha(r.resueltoDireccionEn)}. Ahora contabilidad lo aprueba o envía reparos.`}
      />
    );
  }

  if (r.estado === 'aprobado') {
    return (
      <section aria-labelledby="aprobado" className="flex flex-wrap items-start gap-4 rounded-2xl border border-ok/40 bg-ok-soft px-6 py-5">
        <IconoOk className="mt-0.5 size-6 shrink-0 text-ok" />
        <div className="min-w-[15rem] flex-1">
          <p id="aprobado" className="text-lg font-semibold text-ink">
            Aprobado por contabilidad el {fecha(r.resueltoContabilidadEn)} por {money(r.montoAprobado)}
          </p>
          <p className="mt-1 text-ink-2">
            {r.modificaciones !== 0 && `Vigente: ${money(r.vigente)}, con extensiones de Dirección. `}
            Quedó fijo, y sus meses entran a la proyección mensual de GESEMCO.
            {soyJefe && ` Durante ${r.anio} pedirás lo que necesites desde aquí, con la fecha en que lo necesitas.`}
          </p>
        </div>
        {verProyeccion && (
          <Link href="/proyeccion" className={boton.secundario}>
            Ver la proyección mensual<IconoFlecha className="size-4" />
          </Link>
        )}
      </section>
    );
  }

  // Sin iniciar o en preparación.
  if (!soyJefe) {
    return (
      <p className={`${tarjeta} px-6 py-5 text-ink-2`}>
        {r.estado === null ? 'El departamento todavía no empieza su presupuesto.' : 'El jefe del departamento lo está preparando.'}
      </p>
    );
  }
  if (r.estado === null) return null; // La bienvenida de abajo explica cómo empezar.

  if (r.lineas > 0 && sinMes) {
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface px-6 py-5">
        <IconoCalendario className="size-6 shrink-0 text-accent" />
        <div className="min-w-[15rem] flex-1">
          <p className="text-lg font-semibold text-ink">Indica en qué meses usarás cada ítem</p>
          <p className="mt-1 text-ink-2">
            Así contabilidad sabe cuánto dinero necesitarás cada mes. {r.lineasSinMes === 1 ? 'A 1 ítem le faltan' : `A ${r.lineasSinMes} ítems les faltan`} meses;
            cuando todos los tengan, podrás enviar tu presupuesto a Dirección.
          </p>
        </div>
        <FaltanMeses resumen={r} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface px-6 py-5">
      <div className="min-w-[15rem] flex-1">
        <p className="text-lg font-semibold text-ink">
          {r.lineas === 0 ? 'Agrega lo que necesitas a tus programas' : '¿Terminaste? Envía tu presupuesto a Dirección'}
        </p>
        <p className="mt-1 text-ink-2">
          {r.lineas === 0
            ? 'Cuando tengas ítems con sus meses, podrás enviarlo a Dirección.'
            : 'Todos tus ítems tienen sus meses. Dirección lo revisa contigo en una reunión y después lo revisa contabilidad. Mientras Dirección lo revisa no podrás editarlo, pero puedes retirar el envío si necesitas corregir algo.'}
        </p>
      </div>
      <form action={enviarADireccion}>
        {oculto}
        <button className={boton.primario} disabled={r.lineas === 0}>Enviar a Dirección</button>
      </form>
    </div>
  );
}

/** Lo que dijo quien revisó (Dirección al devolver, contabilidad con sus reparos). */
function Comentario({
  titulo: t, comentario, explicacion, accion,
}: { titulo: string; comentario: string | null; explicacion: string; accion?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-warn/40 bg-warn-soft px-6 py-5">
      <div className="flex flex-wrap items-start gap-4">
        <IconoAlerta className="mt-0.5 size-6 shrink-0 text-warn" />
        <div className="min-w-[15rem] flex-1">
          <p className="text-lg font-semibold text-ink">{t}</p>
          {comentario && (
            <blockquote className="mt-2 border-l-4 border-warn/50 pl-4 text-[17px] text-ink">“{comentario}”</blockquote>
          )}
          <p className="mt-3 text-ink-2">{explicacion}</p>
        </div>
        {accion}
      </div>
    </div>
  );
}

function Informacion({
  icono, titulo: t, texto, accion,
}: { icono: React.ReactNode; titulo: string; texto: string; accion?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-4 rounded-2xl border border-accent/30 bg-accent-soft px-6 py-5">
      {icono}
      <div className="min-w-[15rem] flex-1 text-accent-ink">
        <p className="text-lg font-semibold">{t}</p>
        <p className="mt-1">{texto}</p>
      </div>
      {accion}
    </div>
  );
}

function DecisionDireccion({ resumen: r }: { resumen: ResumenPresupuesto }) {
  const oculto = <input type="hidden" name="departamentoId" value={r.departamentoId} />;
  return (
    <section aria-labelledby="decision" className="rounded-2xl border-2 border-accent/40 bg-surface p-6">
      <h2 id="decision" className={titulo}>Tu decisión</h2>
      <p className={`${ayuda} mt-1`}>
        {r.comentarioDireccion ? `El jefe lo reenvió el ${fecha(r.enviadoEn)} con los ajustes.` : `Enviado el ${fecha(r.enviadoEn)}.`}
        {' '}Revisa los programas y sus meses más abajo; lo que conversen en la reunión con el jefe se resuelve aquí.
      </p>
      {r.comentarioDireccion && (
        <div className="mt-3 rounded-xl bg-surface-2 px-4 py-3">
          <p className="text-sm font-semibold text-ink-2">Lo que se pidió al devolverlo</p>
          <blockquote className="mt-1 text-ink">“{r.comentarioDireccion}”</blockquote>
        </div>
      )}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <form action={aprobarDireccion} className="flex flex-col gap-3 rounded-xl border border-line p-5">
          {oculto}
          <h3 className="flex items-center gap-2 text-lg font-semibold"><IconoOk className="size-5 text-ok" />Aprobar</h3>
          <p className="text-ink-2">
            El presupuesto ({money(r.formulado)}) pasa a contabilidad, que da la aprobación final. Si contabilidad pide
            cambios, el jefe los corrige y se lo reenvía directo a ella.
          </p>
          <div className="mt-auto pt-2">
            <BotonConConfirmacion
              texto="Aprobar y pasar a contabilidad"
              pregunta="¿Confirmas la aprobación?"
              confirmar="Sí, aprobar"
              clase={boton.primario}
              claseConfirmar={boton.primario}
              enfocar="confirmar"
            />
          </div>
        </form>
        <form action={devolverPresupuesto} className="flex flex-col gap-3 rounded-xl border border-line p-5">
          {oculto}
          <h3 className="flex items-center gap-2 text-lg font-semibold"><IconoAlerta className="size-5 text-warn" />Devolver al jefe</h3>
          <label htmlFor="comentario" className="text-ink-2">
            Escribe qué tiene que ajustar, según lo conversado. El jefe lo verá en su presupuesto.
          </label>
          <textarea id="comentario" name="comentario" required rows={3} maxLength={1000} className={campo}
            placeholder="Por ejemplo: dejen un solo agitador y revisen la cantidad de guantes." />
          <div className="mt-auto pt-2">
            <button className={boton.secundario}>Devolver con comentario</button>
          </div>
        </form>
      </div>
    </section>
  );
}

function DecisionContabilidad({ resumen: r }: { resumen: ResumenPresupuesto }) {
  const oculto = <input type="hidden" name="departamentoId" value={r.departamentoId} />;
  return (
    <section aria-labelledby="decision" className="rounded-2xl border-2 border-accent/40 bg-surface p-6">
      <h2 id="decision" className={titulo}>Tu revisión</h2>
      <p className={`${ayuda} mt-1`}>
        {r.comentarioContabilidad
          ? `El jefe lo reenvió el ${fecha(r.enviadoEn)} con los reparos corregidos (Dirección lo había aprobado el ${fecha(r.resueltoDireccionEn)}).`
          : `Dirección lo aprobó el ${fecha(r.resueltoDireccionEn)}.`}
        {' '}Revisa los programas, sus ítems y el dinero de cada mes más abajo.
      </p>
      {/* El comentario de contabilidad se conserva al reenviar: sirve para revisar que se corrigió. */}
      {r.comentarioContabilidad && (
        <div className="mt-3 rounded-xl bg-surface-2 px-4 py-3">
          <p className="text-sm font-semibold text-ink-2">Los reparos que se enviaron</p>
          <blockquote className="mt-1 text-ink">“{r.comentarioContabilidad}”</blockquote>
        </div>
      )}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <form action={aprobarContabilidad} className="flex flex-col gap-3 rounded-xl border border-line p-5">
          {oculto}
          <h3 className="flex items-center gap-2 text-lg font-semibold"><IconoOk className="size-5 text-ok" />Aprobar</h3>
          <p className="text-ink-2">
            El presupuesto queda fijo en {money(r.formulado)} y sus meses entran a la proyección mensual. Después ya no se
            puede cambiar.
          </p>
          <div className="mt-auto pt-2">
            <BotonConConfirmacion
              texto={`Aprobar por ${money(r.formulado)}`}
              pregunta="¿Confirmas la aprobación final?"
              confirmar="Sí, aprobar"
              clase={boton.primario}
              claseConfirmar={boton.primario}
              enfocar="confirmar"
            />
          </div>
        </form>
        <form action={enviarReparos} className="flex flex-col gap-3 rounded-xl border border-line p-5">
          {oculto}
          <h3 className="flex items-center gap-2 text-lg font-semibold"><IconoAlerta className="size-5 text-warn" />Enviar reparos</h3>
          <label htmlFor="reparos" className="text-ink-2">
            Escribe qué tiene que corregir. El jefe lo corrige y te lo reenvía directo, sin pasar otra vez por Dirección.
          </label>
          <textarea id="reparos" name="comentario" required rows={3} maxLength={1000} className={campo}
            placeholder="Por ejemplo: ajusta el arriendo de buses a la cotización vigente." />
          <div className="mt-auto pt-2">
            <button className={boton.secundario}>Enviar reparos</button>
          </div>
        </form>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Programas, ítems y el dinero de cada mes
// ---------------------------------------------------------------------

function Bienvenida({ departamentoId, anio }: { departamentoId: number; anio: number }) {
  const pasos = [
    { titulo: 'Crea un programa', texto: 'Cada cosa que el departamento hará el próximo año: una salida, una olimpiada, el material de las clases.' },
    { titulo: 'Agrégale lo que necesita', texto: 'Búscalo en el catálogo, con precios de tiendas, o agrégalo a mano.' },
    { titulo: 'Indica los meses y envíalo', texto: 'En qué meses usarás cada ítem. Después lo revisan Dirección y contabilidad.' },
  ];
  return (
    <section className={`${tarjeta} p-6 md:p-8`}>
      <h3 className="font-display text-2xl font-bold">Arma tu presupuesto {anio} en tres pasos</h3>
      <ol className="mt-5 grid gap-5 md:grid-cols-3">
        {pasos.map((p, i) => (
          <li key={p.titulo} className="flex gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft font-bold text-accent-ink">{i + 1}</span>
            <span>
              <b className="block font-semibold">{p.titulo}</b>
              <span className="block text-ink-2">{p.texto}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-8 border-t border-line pt-6">
        <NuevoPrograma departamentoId={departamentoId} abierto />
      </div>
    </section>
  );
}

function TarjetaPrograma({
  programa: p, departamentoId, modo, editable, mostrarCuenta, cuentas,
}: {
  programa: ProgramaConLineas; departamentoId: number; modo: ModoItem; editable: boolean;
  mostrarCuenta: boolean; cuentas: Cuenta[];
}) {
  return (
    <article id={`programa-${p.id}`} className={`${tarjeta} scroll-mt-28 overflow-hidden`}>
      <header className="flex flex-wrap items-start gap-4 px-6 py-5">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-semibold">{p.nombre}</h3>
          {p.descripcion && <p className="mt-1 text-ink-2">{p.descripcion}</p>}
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold">{money(p.total)}</p>
          <p className="text-sm text-ink-2">{plural(p.lineas.length, 'ítem', 'ítems')}</p>
        </div>
      </header>

      {p.lineas.length === 0 ? (
        <p className="border-t border-line px-6 py-6 text-ink-2">
          {editable ? 'Este programa todavía está vacío. Agrégale lo que necesitará con los botones de abajo.' : 'Este programa no tiene ítems.'}
        </p>
      ) : (
        <>
          <div aria-hidden className={`hidden gap-x-4 border-y border-line bg-surface-2 px-6 py-2.5 text-[13px] font-semibold text-ink-2 md:grid ${COLUMNAS_ITEM[modo]}`}>
            <span>Ítem y sus meses</span>
            <span className="text-right">Cantidad</span>
            <span className="text-right">Precio c/u</span>
            <span className="text-right">Total</span>
            {modo === 'editable' && <span />}
          </div>
          <ul className="divide-y divide-line border-t border-line md:border-t-0">
            {p.lineas.map((l) => (
              <ItemPresupuesto key={`${l.id}-${l.cantidad}-${l.precioUnitario}`} item={l} departamentoId={departamentoId}
                modo={modo} mostrarCuenta={mostrarCuenta} />
            ))}
          </ul>
        </>
      )}

      {editable && (
        <footer className="flex flex-wrap items-center gap-3 border-t border-line bg-surface-2 px-6 py-4">
          <Link href={`/catalogo?programa=${p.id}`} className={boton.primario}>
            <IconoBuscar className="size-4" />Buscar en el catálogo
          </Link>
          <ItemAMano key={`a-mano-${p.lineas.length}`} programaId={p.id} departamentoId={departamentoId} cuentas={cuentas} />
          <form action={eliminarPrograma} className="ml-auto">
            <input type="hidden" name="departamentoId" value={departamentoId} />
            <input type="hidden" name="programaId" value={p.id} />
            <BotonConConfirmacion
              texto="Eliminar programa"
              pregunta={p.lineas.length > 0
                ? `¿Eliminar "${p.nombre}" y ${p.lineas.length === 1 ? 'su ítem' : `sus ${p.lineas.length} ítems`}?`
                : `¿Eliminar "${p.nombre}"?`}
              confirmar="Sí, eliminar"
              clase={`${boton.chico} text-ink-2 hover:bg-bad-soft hover:text-bad`}
              claseConfirmar={boton.peligro}
            />
          </form>
        </footer>
      )}
    </article>
  );
}

/** El dinero que necesitará el departamento cada mes, según los meses de sus ítems. */
function MesAMes({ meses, resumen: r, anio }: { meses: Mes[]; resumen: ResumenPresupuesto; anio: number }) {
  const planificado = meses.map((m) => m.planificado);
  const hayMeses = planificado.some((m) => m > 0);

  return (
    <section aria-labelledby="mes-a-mes" className={`${tarjeta} mt-10 p-6`}>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="mes-a-mes" className={titulo}>Dinero de cada mes, {anio}</h2>
        {r.montoSinMes > 0 && hayMeses && (
          <p className="flex items-center gap-1.5 text-[15px] text-warn">
            <IconoAlerta className="size-4" />Todavía hay {money(r.montoSinMes)} sin mes.
          </p>
        )}
      </div>
      {hayMeses ? (
        <>
          <ColumnasMensuales meses={planificado} descripcion={`Dinero que necesita ${r.departamento} cada mes de ${anio}`} />
          <details className="mt-4">
            <summary className="cursor-pointer text-[15px] font-medium text-accent">Ver los montos en una tabla</summary>
            <table className="mt-3 w-full max-w-md border-collapse">
              <tbody>
                {planificado.map((m, i) => (
                  <tr key={MESES[i]}>
                    <td className="border-b border-line py-2 capitalize">{MESES[i]}</td>
                    <td className="tabular border-b border-line py-2 text-right">{money(m)}</td>
                  </tr>
                ))}
                {r.montoSinMes > 0 && (
                  <tr>
                    <td className="py-2 text-ink-2">Sin mes todavía</td>
                    <td className="tabular py-2 text-right text-ink-2">{money(r.montoSinMes)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </details>
        </>
      ) : (
        <p className="rounded-xl bg-surface-2 px-5 py-6 text-center text-ink-2">
          Cuando se indiquen los meses de los ítems, aquí aparecerá cuánto dinero se necesita cada mes.
        </p>
      )}
    </section>
  );
}
