import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Encabezado, SinAcceso, SinDatos } from '@/components/encabezado';
import { Aviso, leerAviso } from '@/components/aviso';
import { EstadoPresupuestoPildora } from '@/components/pildoras';
import { ColumnasMensuales } from '@/components/columnas-mensuales';
import { Pasos } from '@/components/pasos';
import { Medidor } from '@/components/medidor';
import { BotonConConfirmacion } from '@/components/confirmar';
import { ItemPresupuesto } from '@/components/item-presupuesto';
import { ItemAMano } from '@/components/item-a-mano';
import { NuevoPrograma } from '@/components/nuevo-programa';
import { COLUMNAS_ITEM, type ModoItem } from '@/components/columnas-item';
import {
  IconoAlerta, IconoBuscar, IconoCalendario, IconoOk, IconoReloj, IconoVolver,
} from '@/components/iconos';
import { ayuda, boton, campo, tarjeta, titulo, tituloPagina } from '@/components/ui';
import { esDireccion, esJefeDe, getSesion, participaEnFormulacion } from '@/lib/sesion';
import {
  cuentasContables, esEditable, programasConLineas, proyeccionPresupuesto, resumenDepartamento,
  type ProgramaConLineas, type Proyeccion, type ResumenPresupuesto,
} from '@/lib/formulacion';
import { fecha, MESES, money, plural } from '@/lib/formato';
import { pasosDe, type Avance } from '@/lib/etapas';
import {
  aprobarPresupuesto, devolverPresupuesto, eliminarPrograma, enviarADireccion, retirarEnvio,
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
  const aprobado = resumen.estado === 'aprobado';
  const proyeccion = resumen.presupuestoId && aprobado
    ? await proyeccionPresupuesto(resumen.presupuestoId, resumen.formulado)
    : null;

  const soyJefe = esJefeDe(sesion, departamentoId);
  const editable = soyJefe && esEditable(resumen.estado);
  const aviso = await leerAviso(await searchParams);
  const anio = sesion.anioFormulacion.anio;

  const lineas = programas.flatMap((p) => p.lineas);
  const avance: Avance = { listos: lineas.filter((l) => l.cantidadSinMes === 0).length, total: lineas.length };
  const modo: ModoItem = editable ? 'editable' : aprobado ? 'meses' : 'lectura';

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
            <p className="text-[15px] font-medium text-ink-2">Presupuesto {anio}</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className={tituloPagina}>{resumen.departamento}</h1>
              <EstadoPresupuestoPildora estado={resumen.estado} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-ink-2">{aprobado ? 'Monto aprobado' : 'Total'}</p>
            <p className="text-[32px] font-semibold leading-tight tracking-tight">
              {money(resumen.montoAprobado ?? resumen.formulado)}
            </p>
          </div>
        </div>

        <Pasos pasos={pasosDe(resumen, avance)} />

        <div className="mt-6">
          {aprobado ? (
            <SeccionMeses resumen={resumen} proyeccion={proyeccion} avance={avance} soyJefe={soyJefe} anio={anio} />
          ) : (
            <QueHacer resumen={resumen} soyJefe={soyJefe} soyDireccion={esDireccion(sesion)} lineas={lineas.length} />
          )}
        </div>

        <section id="programas" className="mt-10">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className={titulo}>Programas</h2>
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
      </main>
    </>
  );
}

// ---------------------------------------------------------------------
// En qué va el presupuesto y qué hay que hacer ahora
// ---------------------------------------------------------------------

function QueHacer({
  resumen: r, soyJefe, soyDireccion, lineas,
}: { resumen: ResumenPresupuesto; soyJefe: boolean; soyDireccion: boolean; lineas: number }) {
  const oculto = <input type="hidden" name="departamentoId" value={r.departamentoId} />;

  if (r.estado === 'enviado' && soyDireccion) return <DecisionDireccion resumen={r} />;

  if (r.estado === 'devuelto') {
    return (
      <div className="rounded-2xl border border-warn/40 bg-warn-soft px-6 py-5">
        <div className="flex flex-wrap items-start gap-4">
          <IconoAlerta className="mt-0.5 size-6 shrink-0 text-warn" />
          <div className="min-w-[15rem] flex-1">
            <p className="text-lg font-semibold text-ink">
              {soyJefe ? 'Dirección te devolvió el presupuesto' : 'Dirección devolvió el presupuesto'} el {fecha(r.resueltoEn)}
            </p>
            {r.comentarioDireccion && (
              <blockquote className="mt-2 border-l-4 border-warn/50 pl-4 text-[17px] text-ink">
                “{r.comentarioDireccion}”
              </blockquote>
            )}
            <p className="mt-3 text-ink-2">
              {soyJefe ? 'Ajusta lo que te pidió en los programas de abajo y vuelve a enviarlo.' : 'El jefe lo está ajustando.'}
            </p>
          </div>
          {soyJefe && (
            <form action={enviarADireccion}>
              {oculto}
              <button className={boton.primario}>Enviar de nuevo</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (r.estado === 'enviado') {
    return (
      <div className="flex flex-wrap items-start gap-4 rounded-2xl border border-accent/30 bg-accent-soft px-6 py-5">
        <IconoReloj className="mt-0.5 size-6 shrink-0 text-accent-ink" />
        <div className="min-w-[15rem] flex-1 text-accent-ink">
          <p className="text-lg font-semibold">
            {soyJefe ? 'Dirección está revisando tu presupuesto' : 'En revisión de Dirección'} desde el {fecha(r.enviadoEn)}
          </p>
          <p className="mt-1">
            {soyJefe
              ? 'Te llegará un aviso cuando lo apruebe o te lo devuelva. Mientras tanto no se puede editar; si necesitas corregir algo, retira el envío.'
              : 'Mientras Dirección lo revisa, el jefe no puede editarlo.'}
          </p>
        </div>
        {soyJefe && (
          <form action={retirarEnvio}>
            {oculto}
            <button className={boton.secundario}>Retirar envío</button>
          </form>
        )}
      </div>
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
            : 'Dirección lo revisa contigo en una reunión. Mientras lo revisa no podrás editarlo, pero puedes retirar el envío si necesitas corregir algo.'}
        </p>
      </div>
      <form action={enviarADireccion}>
        {oculto}
        <button className={boton.primario} disabled={lineas === 0}>Enviar a Dirección</button>
      </form>
    </div>
  );
}

function DecisionDireccion({ resumen: r }: { resumen: ResumenPresupuesto }) {
  const oculto = <input type="hidden" name="departamentoId" value={r.departamentoId} />;
  return (
    <section aria-labelledby="decision" className="rounded-2xl border-2 border-accent/40 bg-surface p-6">
      <h2 id="decision" className={titulo}>Tu decisión</h2>
      <p className={`${ayuda} mt-1`}>
        Enviado el {fecha(r.enviadoEn)}. Revisa los programas más abajo; lo que conversen en la reunión con el jefe se resuelve aquí.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <form action={aprobarPresupuesto} className="flex flex-col gap-3 rounded-xl border border-line p-5">
          {oculto}
          <h3 className="flex items-center gap-2 text-lg font-semibold"><IconoOk className="size-5 text-ok" />Aprobar</h3>
          <p className="text-ink-2">
            El presupuesto queda fijo en {money(r.formulado)} y el jefe pasa a indicar los meses. Después ya no se puede cambiar.
          </p>
          <div className="mt-auto pt-2">
            <BotonConConfirmacion
              texto={`Aprobar por ${money(r.formulado)}`}
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

// ---------------------------------------------------------------------
// Presupuesto aprobado: los meses y la proyección
// ---------------------------------------------------------------------

function SeccionMeses({
  resumen: r, proyeccion, avance, soyJefe, anio,
}: { resumen: ResumenPresupuesto; proyeccion: Proyeccion | null; avance: Avance; soyJefe: boolean; anio: number }) {
  const listo = avance.total > 0 && avance.listos === avance.total;
  const hayMeses = proyeccion !== null && proyeccion.meses.some((m) => m > 0);
  const enlace = `/formulacion/${r.departamentoId}/meses`;

  return (
    <section aria-labelledby="meses" className={`${tarjeta} p-6`}>
      <p className="mb-4 flex flex-wrap items-center gap-2 text-ok">
        <IconoOk className="size-5" />
        <span className="font-semibold">Aprobado por Dirección el {fecha(r.resueltoEn)} por {money(r.montoAprobado)}</span>
        {r.modificaciones !== 0 && <span className="text-ink-2">· vigente {money(r.vigente)}, con modificaciones</span>}
      </p>

      <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
        <div className="min-w-[15rem] flex-1">
          <h2 id="meses" className={titulo}>
            {soyJefe ? (listo ? 'Listo: todo tiene sus meses' : 'Ahora, indica los meses de cada compra') : 'Meses de cada compra'}
          </h2>
          <p className="mt-1 max-w-3xl text-ink-2">
            {soyJefe
              ? 'Escribe cuántas unidades de cada ítem necesitas en cada mes, en la cantidad que quieras. Así GESEMCO sabe cuánto dinero se necesita mes a mes.'
              : 'El jefe indica cuántas unidades de cada ítem necesita cada mes; con eso GESEMCO arma la proyección mensual.'}
          </p>
        </div>
        <Link href={enlace} className={soyJefe && !listo ? boton.primario : boton.secundario}>
          <IconoCalendario className="size-5" />
          {soyJefe ? (listo ? 'Revisar los meses' : 'Indicar los meses') : 'Ver los meses'}
        </Link>
      </div>

      <div className="mt-5 max-w-xl">
        <p className="mb-2 text-[15px] font-medium">
          {avance.listos} de {avance.total} {avance.total === 1 ? 'ítem' : 'ítems'} con todos sus meses
        </p>
        <Medidor valor={avance.listos} total={avance.total} etiqueta="Ítems con todos sus meses" />
      </div>

      <div className="mt-8 border-t border-line pt-6">
        <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-lg font-semibold">Dinero que se necesita cada mes, {anio}</h3>
          {proyeccion && proyeccion.sinMes > 0 && hayMeses && (
            <p className={ayuda}>Todavía hay {money(proyeccion.sinMes)} sin mes asignado.</p>
          )}
        </div>
        {hayMeses && proyeccion ? (
          <>
            <ColumnasMensuales meses={proyeccion.meses} descripcion={`Dinero que necesita ${r.departamento} cada mes de ${anio}`} />
            <details className="mt-4">
              <summary className="cursor-pointer text-[15px] font-medium text-accent">Ver los montos en una tabla</summary>
              <table className="mt-3 w-full max-w-md border-collapse">
                <tbody>
                  {proyeccion.meses.map((m, i) => (
                    <tr key={MESES[i]}>
                      <td className="border-b border-line py-2 capitalize">{MESES[i]}</td>
                      <td className="tabular border-b border-line py-2 text-right">{money(m)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2 text-ink-2">Sin mes asignado</td>
                    <td className="tabular py-2 text-right text-ink-2">{money(proyeccion.sinMes)}</td>
                  </tr>
                </tbody>
              </table>
            </details>
          </>
        ) : (
          <p className="rounded-xl bg-surface-2 px-5 py-6 text-center text-ink-2">
            Cuando se indiquen los meses, aquí aparecerá cuánto dinero se necesita cada mes.
          </p>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Programas e ítems
// ---------------------------------------------------------------------

function Bienvenida({ departamentoId, anio }: { departamentoId: number; anio: number }) {
  const pasos = [
    { titulo: 'Crea un programa', texto: 'Cada cosa que el departamento hará el próximo año: una salida, una olimpiada, el material de un curso.' },
    { titulo: 'Agrégale lo que necesita', texto: 'Búscalo en el catálogo, con precios de tiendas, o agrégalo a mano.' },
    { titulo: 'Envíalo a Dirección', texto: 'Lo revisan contigo en una reunión y lo aprueban. Después indicas los meses.' },
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
    <article id={`programa-${p.id}`} className={`${tarjeta} overflow-hidden`}>
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
          {editable ? 'Este programa todavía está vacío. Agrégale lo que necesita con los botones de abajo.' : 'Este programa no tiene ítems.'}
        </p>
      ) : (
        <>
          <div aria-hidden className={`hidden gap-x-4 border-y border-line bg-surface-2 px-6 py-2.5 text-[13px] font-semibold text-ink-2 md:grid ${COLUMNAS_ITEM[modo]}`}>
            <span>Ítem</span>
            <span className="text-right">Cantidad</span>
            <span className="text-right">Precio c/u</span>
            <span className="text-right">Total</span>
            {modo === 'meses' && <span>Meses</span>}
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
