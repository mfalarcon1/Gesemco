import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Encabezado, SinAcceso, SinDatos } from '@/components/encabezado';
import { Aviso, leerAviso } from '@/components/aviso';
import { EstadoPresupuestoPildora } from '@/components/pildoras';
import { Pasos } from '@/components/pasos';
import { BotonConConfirmacion } from '@/components/confirmar';
import { ItemPresupuesto } from '@/components/item-presupuesto';
import { ItemAMano } from '@/components/item-a-mano';
import { NuevoPrograma } from '@/components/nuevo-programa';
import { COLUMNAS_ITEM, type ModoItem } from '@/components/columnas-item';
import {
  IconoAlerta, IconoBuscar, IconoFlecha, IconoOk, IconoReloj, IconoVolver,
} from '@/components/iconos';
import { ayuda, boton, campo, tarjeta, titulo, tituloPagina } from '@/components/ui';
import {
  esContabilidad, esDireccion, esJefeDe, getSesion, participaEnFormulacion, veOrdenesDeCompra,
} from '@/lib/sesion';
import {
  cuentasContables, esEditable, programasConLineas, resumenDepartamento, sumarPorPeriodo,
  type PorPeriodo, type ProgramaConLineas, type ResumenPresupuesto,
} from '@/lib/formulacion';
import { PERIODOS, type Periodo } from '@/lib/periodos';
import { fecha, money, plural } from '@/lib/formato';
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

  const [programas, cuentas] = await Promise.all([
    resumen.presupuestoId ? programasConLineas(resumen.presupuestoId) : Promise.resolve([]),
    cuentasContables(),
  ]);

  const soyJefe = esJefeDe(sesion, departamentoId);
  const editable = soyJefe && esEditable(resumen.estado);
  const aviso = await leerAviso(await searchParams);
  const anio = sesion.anioFormulacion.anio;

  const lineas = programas.flatMap((p) => p.lineas);
  const porPeriodo = sumarPorPeriodo(programas);
  const modo: ModoItem = editable ? 'editable' : 'lectura';

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
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium text-ink-2">
              Presupuesto {anio}
              {resumen.estado !== 'aprobado' && resumen.formulacionHasta && ` · la formulación cierra el ${fecha(resumen.formulacionHasta)}`}
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
            soyContabilidad={esContabilidad(sesion)} verOrdenes={veOrdenesDeCompra(sesion)} lineas={lineas.length} />
        </div>

        <section id="programas" className="mt-10">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className={titulo}>Programas de cada periodo</h2>
            {programas.length > 0 && (
              <p className={ayuda}>
                {plural(programas.length, 'programa', 'programas')} · {plural(lineas.length, 'ítem', 'ítems')}
                {resumen.fueraCatalogo > 0 && ` · ${money(resumen.fueraCatalogo)} fuera del catálogo`}
              </p>
            )}
          </div>

          {programas.length === 0 ? (
            editable ? (
              <Bienvenida departamentoId={departamentoId} anio={anio} />
            ) : (
              <p className={`${tarjeta} px-6 py-10 text-center text-ink-2`}>El departamento todavía no crea programas.</p>
            )
          ) : (
            <>
              <ResumenPeriodos porPeriodo={porPeriodo} programas={programas} />
              <div className="mt-10 flex flex-col gap-12">
                {PERIODOS.map((p) => (
                  <SeccionPeriodo key={p.numero} periodo={p} total={porPeriodo[p.numero - 1]}
                    programas={programas.filter((x) => x.periodo === p.numero)}
                    sugerencias={sugerenciasPara(p.numero, programas)}
                    departamentoId={departamentoId} modo={modo} editable={editable}
                    mostrarCuenta={sesion.veTodoElColegio} cuentas={cuentas} />
                ))}
              </div>
            </>
          )}
        </section>
      </main>
    </>
  );
}

/** Programas que el departamento ya tiene en otros periodos y todavía no en este. */
function sugerenciasPara(periodo: number, programas: ProgramaConLineas[]): string[] {
  const aca = new Set(programas.filter((p) => p.periodo === periodo).map((p) => p.nombre.toLowerCase()));
  const vistas = new Set<string>();
  const nombres: string[] = [];
  for (const p of programas) {
    const clave = p.nombre.toLowerCase();
    if (p.periodo === periodo || aca.has(clave) || vistas.has(clave)) continue;
    vistas.add(clave);
    nombres.push(p.nombre);
  }
  return nombres;
}

// ---------------------------------------------------------------------
// En qué va el presupuesto y qué hay que hacer ahora
// ---------------------------------------------------------------------

function QueHacer({
  resumen: r, soyJefe, soyDireccion, soyContabilidad, verOrdenes, lineas,
}: {
  resumen: ResumenPresupuesto; soyJefe: boolean; soyDireccion: boolean; soyContabilidad: boolean;
  verOrdenes: boolean; lineas: number;
}) {
  const oculto = <input type="hidden" name="departamentoId" value={r.departamentoId} />;

  if (r.estado === 'enviado' && soyDireccion) return <DecisionDireccion resumen={r} />;
  if (r.estado === 'revision_contabilidad' && soyContabilidad) return <DecisionContabilidad resumen={r} />;

  if (r.estado === 'devuelto') {
    return (
      <Comentario
        titulo={`${soyJefe ? 'Dirección te devolvió el presupuesto' : 'Dirección devolvió el presupuesto'} el ${fecha(r.resueltoDireccionEn)}`}
        comentario={r.comentarioDireccion}
        explicacion={soyJefe ? 'Ajusta lo que te pidió en los programas de abajo y vuelve a enviarlo a Dirección.' : 'El jefe lo está ajustando.'}
        accion={soyJefe && (
          <form action={enviarADireccion}>
            {oculto}
            <button className={boton.primario}>Enviar de nuevo a Dirección</button>
          </form>
        )}
      />
    );
  }

  if (r.estado === 'con_reparos') {
    return (
      <Comentario
        titulo={`${soyJefe ? 'Contabilidad te envió reparos' : 'Contabilidad envió reparos'} el ${fecha(r.resueltoContabilidadEn)}`}
        comentario={r.comentarioContabilidad}
        explicacion={soyJefe
          ? 'Corrige lo que te pidió en los programas de abajo. Cuando lo reenvíes, vuelve directo a contabilidad, sin pasar otra vez por Dirección.'
          : 'El jefe lo está corrigiendo. Cuando lo reenvíe, vuelve directo a contabilidad.'}
        accion={soyJefe && (
          <form action={reenviarAContabilidad}>
            {oculto}
            <button className={boton.primario} disabled={lineas === 0}>Enviar de nuevo a contabilidad</button>
          </form>
        )}
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
            {r.modificaciones !== 0 && `Vigente: ${money(r.vigente)}, con modificaciones. `}
            Quedó fijo, y sus ítems entran a las órdenes de compra de cada periodo.
          </p>
        </div>
        {verOrdenes && (
          <Link href="/ordenes-de-compra" className={boton.secundario}>
            Ver las órdenes de compra<IconoFlecha className="size-4" />
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

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface px-6 py-5">
      <div className="min-w-[15rem] flex-1">
        <p className="text-lg font-semibold text-ink">
          {lineas === 0 ? 'Agrega lo que necesitas a tus programas' : '¿Terminaste? Envía tu presupuesto a Dirección'}
        </p>
        <p className="mt-1 text-ink-2">
          {lineas === 0
            ? 'Cuando tengas al menos un ítem, podrás enviarlo a Dirección.'
            : 'Dirección lo revisa contigo en una reunión y después lo revisa contabilidad. Mientras Dirección lo revisa no podrás editarlo, pero puedes retirar el envío si necesitas corregir algo.'}
        </p>
      </div>
      <form action={enviarADireccion}>
        {oculto}
        <button className={boton.primario} disabled={lineas === 0}>Enviar a Dirección</button>
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
        {' '}Revisa los programas de cada periodo más abajo; lo que conversen en la reunión con el jefe se resuelve aquí.
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
        {' '}Revisa los programas de cada periodo más abajo.
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
            El presupuesto queda fijo en {money(r.formulado)} y sus ítems entran a las órdenes de compra de cada periodo.
            Después ya no se puede cambiar.
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
// Periodos, programas e ítems
// ---------------------------------------------------------------------

function Bienvenida({ departamentoId, anio }: { departamentoId: number; anio: number }) {
  const pasos = [
    { titulo: 'Elige un periodo y crea un programa', texto: 'El año tiene tres periodos: marzo a mayo, junio a agosto y septiembre a diciembre.' },
    { titulo: 'Agrégale lo que necesitará', texto: 'Búscalo en el catálogo, con precios de tiendas, o agrégalo a mano. Si el programa sigue en otro periodo, créalo también allá.' },
    { titulo: 'Envíalo a Dirección', texto: 'Lo revisan contigo en una reunión y después lo aprueba contabilidad.' },
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

/** Cuánto va en cada periodo, con un enlace a su sección. */
function ResumenPeriodos({ porPeriodo, programas }: { porPeriodo: PorPeriodo; programas: ProgramaConLineas[] }) {
  return (
    <ul className="grid gap-3 md:grid-cols-3" aria-label="Total de cada periodo">
      {PERIODOS.map((p) => {
        const propios = programas.filter((x) => x.periodo === p.numero);
        const items = propios.reduce((s, x) => s + x.lineas.length, 0);
        return (
          <li key={p.numero}>
            <a href={`#periodo-${p.numero}`}
              className={`${tarjeta} flex h-full flex-col gap-1 px-5 py-4 transition-colors hover:border-accent hover:bg-accent-soft/40`}>
              <span className="text-[15px] font-semibold text-ink">{p.nombre} <span className="font-normal text-ink-2">· {p.meses}</span></span>
              <span className="tabular text-2xl font-semibold tracking-tight">{money(porPeriodo[p.numero - 1])}</span>
              <span className="text-sm text-ink-2">
                {propios.length === 0 ? 'Sin programas' : `${plural(propios.length, 'programa', 'programas')} · ${plural(items, 'ítem', 'ítems')}`}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function SeccionPeriodo({
  periodo: p, total, programas, sugerencias, departamentoId, modo, editable, mostrarCuenta, cuentas,
}: {
  periodo: Periodo; total: number; programas: ProgramaConLineas[]; sugerencias: string[];
  departamentoId: number; modo: ModoItem; editable: boolean; mostrarCuenta: boolean; cuentas: Cuenta[];
}) {
  const id = `periodo-${p.numero}`;
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-28">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-accent/30 pb-2">
        <h3 id={`${id}-titulo`} className="font-display text-[22px] font-bold">
          {p.nombre} <span className="font-sans text-lg font-medium text-ink-2">· {p.meses}</span>
        </h3>
        <p className="tabular text-lg font-semibold">{money(total)}</p>
      </div>

      {programas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong px-6 py-5 text-ink-2">
          {editable ? 'Todavía no hay programas en este periodo.' : 'Sin programas en este periodo.'}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {programas.map((x) => (
            <TarjetaPrograma key={x.id} programa={x} departamentoId={departamentoId} modo={modo}
              editable={editable} mostrarCuenta={mostrarCuenta} cuentas={cuentas} />
          ))}
        </div>
      )}

      {/* Las keys salen de los datos: cuando una acción sale bien los datos cambian y el
          formulario se cierra; si sale mal, sigue abierto con lo que se escribió. */}
      {editable && (
        <div className="mt-4">
          <NuevoPrograma key={`nuevo-${p.numero}-${programas.length}`} departamentoId={departamentoId}
            periodo={p.numero} sugerencias={sugerencias} />
        </div>
      )}
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
          <h4 className="font-display text-xl font-semibold">{p.nombre}</h4>
          {p.descripcion && <p className="mt-1 text-ink-2">{p.descripcion}</p>}
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold">{money(p.total)}</p>
          <p className="text-sm text-ink-2">{plural(p.lineas.length, 'ítem', 'ítems')}</p>
        </div>
      </header>

      {p.lineas.length === 0 ? (
        <p className="border-t border-line px-6 py-6 text-ink-2">
          {editable ? 'Este programa todavía está vacío. Agrégale lo que necesitará en este periodo con los botones de abajo.' : 'Este programa no tiene ítems.'}
        </p>
      ) : (
        <>
          <div aria-hidden className={`hidden gap-x-4 border-y border-line bg-surface-2 px-6 py-2.5 text-[13px] font-semibold text-ink-2 md:grid ${COLUMNAS_ITEM[modo]}`}>
            <span>Ítem</span>
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
                ? `¿Eliminar "${p.nombre}" de este periodo y ${p.lineas.length === 1 ? 'su ítem' : `sus ${p.lineas.length} ítems`}?`
                : `¿Eliminar "${p.nombre}" de este periodo?`}
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
