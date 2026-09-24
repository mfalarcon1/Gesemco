import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Encabezado, SinAcceso, SinDatos } from '@/components/encabezado';
import { Aviso, leerAviso } from '@/components/aviso';
import { EstadoPresupuestoPildora, FueraDeCatalogo } from '@/components/pildoras';
import { TarjetaCifra } from '@/components/tarjeta-cifra';
import { ColumnasMensuales } from '@/components/columnas-mensuales';
import { IconoAlerta, IconoOk, IconoReloj } from '@/components/iconos';
import { boton, campo, etiqueta, tarjeta, td, tdNum, th, titulo } from '@/components/ui';
import { esDireccion, esJefeDe, getSesion, participaEnFormulacion } from '@/lib/sesion';
import {
  cuentasContables, esEditable, programasConLineas, proyeccionPresupuesto, resumenDepartamento,
  type Linea, type ProgramaConLineas, type Proyeccion, type ResumenPresupuesto,
} from '@/lib/formulacion';
import { fecha, MESES, MESES_CORTOS, money, repartoCorto } from '@/lib/formato';
import {
  agregarLineaLibre, aprobarPresupuesto, asignarMeses, crearPrograma, devolverPresupuesto,
  editarLinea, eliminarLinea, eliminarPrograma, enviarADireccion, retirarEnvio,
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
  const proyeccion = resumen.presupuestoId && resumen.estado === 'aprobado'
    ? await proyeccionPresupuesto(resumen.presupuestoId, resumen.formulado)
    : null;

  const soyJefe = esJefeDe(sesion, departamentoId);
  const editable = soyJefe && esEditable(resumen.estado);
  const aviso = leerAviso(await searchParams);
  const anio = sesion.anioFormulacion.anio;

  return (
    <>
      <Encabezado sesion={sesion} activo="formulacion" />
      <main className="mx-auto max-w-6xl px-5 pb-20 pt-7">
        {sesion.veTodoElColegio && (
          <nav aria-label="Ruta" className="mb-3 text-sm text-ink-3">
            <Link href="/formulacion" className="text-accent hover:underline">Formulación {anio}</Link>
            <span className="mx-1.5">/</span>{resumen.departamento}
          </nav>
        )}

        <div className="mb-5 flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-2xl font-semibold">Presupuesto {anio} · {resumen.departamento}</h1>
              <EstadoPresupuestoPildora estado={resumen.estado} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-3">{resumen.estado === 'aprobado' ? 'Aprobado' : 'Formulado'}</p>
            <p className="text-2xl font-semibold">{money(resumen.montoAprobado ?? resumen.formulado)}</p>
          </div>
        </div>

        <Aviso {...aviso} />

        <PanelEstado resumen={resumen} soyJefe={soyJefe} soyDireccion={esDireccion(sesion)} />

        <div className="mb-8 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
          <TarjetaCifra titulo="Programas" valor={String(resumen.programas)} />
          <TarjetaCifra titulo="Líneas" valor={String(resumen.lineas)} />
          <TarjetaCifra titulo="Formulado" valor={money(resumen.formulado)} />
          <TarjetaCifra titulo="Fuera de catálogo" valor={money(resumen.fueraCatalogo)}
            nota="servicios y artículos sin precio de tienda" />
          {proyeccion && (
            <TarjetaCifra titulo="Sin mes asignado" valor={money(proyeccion.sinMes)}
              nota={proyeccion.sinMes === 0 ? 'todo calendarizado' : 'falta asignar a un mes'}
              tono={proyeccion.sinMes === 0 ? 'ok' : 'normal'} />
          )}
        </div>

        {proyeccion && <ProyeccionDepartamento proyeccion={proyeccion} anio={anio} />}

        <section className="mb-8">
          <h2 className={`${titulo} mb-3.5`}>Programas</h2>
          {programas.length === 0 && (
            <p className={`${tarjeta} px-4 py-8 text-center text-sm text-ink-3`}>
              {soyJefe ? 'Todavía no hay programas. Crea el primero aquí abajo.' : 'El departamento todavía no crea programas.'}
            </p>
          )}
          <div className="flex flex-col gap-5">
            {programas.map((p) => (
              <TarjetaPrograma
                key={p.id}
                programa={p}
                departamentoId={departamentoId}
                editable={editable}
                calendarizable={soyJefe && resumen.estado === 'aprobado'}
                verMeses={resumen.estado === 'aprobado'}
                cuentas={cuentas}
              />
            ))}
          </div>
        </section>

        {editable && <NuevoPrograma departamentoId={departamentoId} />}
      </main>
    </>
  );
}

// ---------------------------------------------------------------------
// Estado y acciones del ciclo de vida
// ---------------------------------------------------------------------

function PanelEstado({
  resumen, soyJefe, soyDireccion,
}: { resumen: ResumenPresupuesto; soyJefe: boolean; soyDireccion: boolean }) {
  const oculto = <input type="hidden" name="departamentoId" value={resumen.departamentoId} />;

  if (resumen.estado === null || resumen.estado === 'borrador') {
    return (
      <div className={`${tarjeta} mb-6 flex flex-wrap items-center gap-4 px-5 py-4`}>
        <p className="min-w-0 flex-1 text-sm text-ink-2">
          {soyJefe
            ? 'Arma tus programas con artículos del catálogo o con líneas libres (servicios, salidas, lo que el catálogo no tenga). Cuando esté listo, envíalo a Dirección.'
            : resumen.estado === null
              ? 'El departamento todavía no empieza su presupuesto.'
              : 'El jefe del departamento lo está preparando.'}
        </p>
        {soyJefe && resumen.estado === 'borrador' && (
          <form action={enviarADireccion}>
            {oculto}
            <button className={boton.primario} disabled={resumen.lineas === 0}
              title={resumen.lineas === 0 ? 'Agrega al menos una línea antes de enviar' : undefined}>
              Enviar a Dirección
            </button>
          </form>
        )}
      </div>
    );
  }

  if (resumen.estado === 'devuelto') {
    return (
      <div className="mb-6 rounded-xl border border-warn/40 bg-warn-soft px-5 py-4">
        <div className="flex flex-wrap items-start gap-4">
          <IconoAlerta className="mt-0.5 size-5 shrink-0 text-warn" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-ink">Dirección devolvió el presupuesto el {fecha(resumen.resueltoEn)}</p>
            {resumen.comentarioDireccion && <p className="mt-1 text-ink">“{resumen.comentarioDireccion}”</p>}
            {soyJefe && <p className="mt-2 text-ink-2">Ajusta lo conversado y vuelve a enviarlo.</p>}
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

  if (resumen.estado === 'enviado') {
    return (
      <div className="mb-6 rounded-xl border border-accent/30 bg-accent-soft px-5 py-4">
        <div className="flex flex-wrap items-start gap-4">
          <IconoReloj className="mt-0.5 size-5 shrink-0 text-accent-ink" />
          <div className="min-w-0 flex-1 text-sm text-accent-ink">
            <p className="font-semibold">En revisión de Dirección desde el {fecha(resumen.enviadoEn)}</p>
            <p className="mt-1">
              {soyDireccion
                ? 'Lo conversado en la reunión con el jefe se resuelve aquí: apruébalo o devuélvelo con un comentario.'
                : 'Mientras Dirección lo revisa no se puede editar.'}
            </p>
          </div>
          {soyJefe && !soyDireccion && (
            <form action={retirarEnvio}>
              {oculto}
              <button className={boton.secundario}>Retirar envío</button>
            </form>
          )}
        </div>

        {soyDireccion && (
          <div className="mt-4 grid gap-3 border-t border-accent/20 pt-4 md:grid-cols-[auto_1fr]">
            <form action={aprobarPresupuesto}>
              {oculto}
              <button className={boton.primario}>Aprobar por {money(resumen.formulado)}</button>
            </form>
            <form action={devolverPresupuesto} className="flex flex-wrap items-start gap-2">
              {oculto}
              <label htmlFor="comentario" className="sr-only">Comentario para el jefe</label>
              <textarea id="comentario" name="comentario" required rows={2} maxLength={1000}
                placeholder="Qué tiene que ajustar el jefe, según lo conversado"
                className={`${campo} min-w-[16rem] flex-1`} />
              <button className={boton.secundario}>Devolver con comentario</button>
            </form>
          </div>
        )}
      </div>
    );
  }

  // Aprobado
  return (
    <div className="mb-6 rounded-xl border border-ok/30 bg-ok-soft px-5 py-4">
      <div className="flex items-start gap-3 text-sm">
        <IconoOk className="mt-0.5 size-5 shrink-0 text-ok" />
        <div>
          <p className="font-semibold text-ink">
            Aprobado el {fecha(resumen.resueltoEn)} por {money(resumen.montoAprobado)}
          </p>
          <p className="mt-1 text-ink-2">
            {soyJefe
              ? 'Ahora asigna a cada línea el mes en que la necesitas (columna Meses). Eso arma la proyección mensual que recibe GESEMCO.'
              : 'El jefe asigna los meses de cada línea; con eso se arma la proyección mensual para GESEMCO.'}
          </p>
          {resumen.modificaciones !== 0 && (
            <p className="mt-1 text-ink-2">
              Vigente {money(resumen.vigente)}, con {money(resumen.modificaciones)} en modificaciones.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Proyección del departamento
// ---------------------------------------------------------------------

function ProyeccionDepartamento({ proyeccion, anio }: { proyeccion: Proyeccion; anio: number }) {
  return (
    <section className={`${tarjeta} mb-8 p-5`}>
      <div className="mb-4 flex flex-wrap items-baseline gap-3">
        <h2 className={titulo}>Proyección mensual {anio}</h2>
        <p className="text-[13px] text-ink-3">Lo que el departamento necesita cada mes, a precio presupuesto</p>
      </div>
      <ColumnasMensuales meses={proyeccion.meses} descripcion={`Proyección mensual ${anio} del departamento`} />
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-accent">Ver como tabla</summary>
        <table className="mt-2 w-full max-w-md border-collapse text-sm">
          <tbody>
            {proyeccion.meses.map((m, i) => (
              <tr key={MESES[i]}>
                <td className="border-b border-line py-1.5 capitalize">{MESES[i]}</td>
                <td className="tabular border-b border-line py-1.5 text-right font-mono">{money(m)}</td>
              </tr>
            ))}
            <tr>
              <td className="py-1.5 text-ink-2">Sin mes asignado</td>
              <td className="tabular py-1.5 text-right font-mono text-ink-2">{money(proyeccion.sinMes)}</td>
            </tr>
          </tbody>
        </table>
      </details>
    </section>
  );
}

// ---------------------------------------------------------------------
// Programas y líneas
// ---------------------------------------------------------------------

function TarjetaPrograma({
  programa, departamentoId, editable, calendarizable, verMeses, cuentas,
}: {
  programa: ProgramaConLineas; departamentoId: number; editable: boolean;
  calendarizable: boolean; verMeses: boolean; cuentas: Cuenta[];
}) {
  return (
    <article className={`${tarjeta} overflow-hidden`}>
      <header className="flex flex-wrap items-start gap-4 border-b border-line px-5 py-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-semibold">{programa.nombre}</h3>
          {programa.descripcion && <p className="mt-0.5 text-sm text-ink-2">{programa.descripcion}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-3">{programa.lineas.length} {programa.lineas.length === 1 ? 'línea' : 'líneas'}</p>
          <p className="text-lg font-semibold">{money(programa.total)}</p>
        </div>
      </header>

      {programa.lineas.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-3">Este programa todavía no tiene líneas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="bg-surface-2">
                <th className={th}>Artículo</th>
                <th className={`${th} w-28 text-right`}>Cantidad</th>
                <th className={`${th} w-36 text-right`}>Precio unitario</th>
                <th className={`${th} w-32 text-right`}>Subtotal</th>
                {verMeses && <th className={`${th} w-64`}>Meses</th>}
                {editable && <th className={`${th} w-40`}><span className="sr-only">Acciones</span></th>}
              </tr>
            </thead>
            <tbody>
              {programa.lineas.map((l) => (
                <FilaLinea key={l.id} linea={l} departamentoId={departamentoId}
                  editable={editable} calendarizable={calendarizable} verMeses={verMeses} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editable && (
        <footer className="flex flex-wrap items-start gap-3 border-t border-line bg-surface-2 px-5 py-3">
          <Link href={`/catalogo?programa=${programa.id}`} className={boton.primario}>
            Agregar desde el catálogo
          </Link>
          <details className="group">
            <summary className={`${boton.secundario} cursor-pointer list-none`}>Agregar línea libre</summary>
            <LineaLibre programaId={programa.id} departamentoId={departamentoId} cuentas={cuentas} />
          </details>
          <details className="ml-auto">
            <summary className={`${boton.chico} cursor-pointer list-none text-ink-3 hover:text-bad`}>
              Eliminar programa
            </summary>
            <form action={eliminarPrograma} className="mt-2 flex items-center gap-2 text-sm">
              <input type="hidden" name="departamentoId" value={departamentoId} />
              <input type="hidden" name="programaId" value={programa.id} />
              <span className="text-ink-2">Se borra con sus {programa.lineas.length} líneas.</span>
              <button className={boton.peligro}>Sí, eliminar</button>
            </form>
          </details>
        </footer>
      )}
    </article>
  );
}

function FilaLinea({
  linea: l, departamentoId, editable, calendarizable, verMeses,
}: { linea: Linea; departamentoId: number; editable: boolean; calendarizable: boolean; verMeses: boolean }) {
  const formId = `linea-${l.id}`;

  return (
    <tr className="align-top">
      <td className={td}>
        <p className="font-medium text-ink">{l.descripcion}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
          {l.fueraCatalogo && <FueraDeCatalogo />}
          {l.origenPrecio && <span>{l.origenPrecio}</span>}
          {l.cuenta && <span>· {l.cuenta}</span>}
        </p>
      </td>

      {editable ? (
        <>
          <td className={td}>
            <label htmlFor={`${formId}-cantidad`} className="sr-only">Cantidad</label>
            <input id={`${formId}-cantidad`} form={formId} name="cantidad" type="number" min={1} step={1}
              defaultValue={l.cantidad} required className={`${campo} tabular text-right font-mono`} />
          </td>
          <td className={td}>
            <label htmlFor={`${formId}-precio`} className="sr-only">Precio unitario</label>
            <input id={`${formId}-precio`} form={formId} name="precio" type="number" min={0} step={1}
              defaultValue={l.precioUnitario} required className={`${campo} tabular text-right font-mono`} />
          </td>
        </>
      ) : (
        <>
          <td className={tdNum}>{l.cantidad}</td>
          <td className={tdNum}>{money(l.precioUnitario)}</td>
        </>
      )}

      <td className={`${tdNum} font-medium`}>{money(l.subtotal)}</td>

      {verMeses && (
        <td className={td}>
          <MesesDeLinea linea={l} departamentoId={departamentoId} calendarizable={calendarizable} />
        </td>
      )}

      {editable && (
        <td className={td}>
          <div className="flex flex-wrap gap-1.5">
            <form id={formId} action={editarLinea}>
              <input type="hidden" name="departamentoId" value={departamentoId} />
              <input type="hidden" name="lineaId" value={l.id} />
              <button className={`${boton.chico} border border-line-strong bg-surface hover:bg-surface-2`}>Guardar</button>
            </form>
            <form action={eliminarLinea}>
              <input type="hidden" name="departamentoId" value={departamentoId} />
              <input type="hidden" name="lineaId" value={l.id} />
              <button className={`${boton.chico} text-ink-3 hover:bg-bad-soft hover:text-bad`}
                aria-label={`Eliminar ${l.descripcion}`}>
                Eliminar
              </button>
            </form>
          </div>
        </td>
      )}
    </tr>
  );
}

function MesesDeLinea({
  linea: l, departamentoId, calendarizable,
}: { linea: Linea; departamentoId: number; calendarizable: boolean }) {
  const marcados = new Set(l.meses.map((m) => m.mes));

  return (
    <div className="text-xs">
      {l.meses.length > 0 ? (
        <p className="text-ink-2">{repartoCorto(l.meses)}</p>
      ) : (
        <p className="text-ink-3">Sin mes asignado</p>
      )}
      {l.meses.length > 0 && l.cantidadSinMes > 0 && (
        <p className="mt-0.5 flex items-center gap-1 text-warn">
          <IconoAlerta className="size-3.5" />Faltan {l.cantidadSinMes} sin mes
        </p>
      )}

      {calendarizable && (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-accent">{l.meses.length ? 'Cambiar meses' : 'Asignar meses'}</summary>
          <form action={asignarMeses} className="mt-2">
            <input type="hidden" name="departamentoId" value={departamentoId} />
            <input type="hidden" name="lineaId" value={l.id} />
            <fieldset>
              <legend className="mb-1.5 text-ink-2">
                Marca los meses: las {l.cantidad} unidades se reparten en partes iguales.
              </legend>
              <div className="grid grid-cols-4 gap-1">
                {MESES_CORTOS.map((m, i) => (
                  <label key={m} className="flex cursor-pointer items-center gap-1 rounded border border-line px-1.5 py-1 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                    <input type="checkbox" name="mes" value={i + 1} defaultChecked={marcados.has(i + 1)}
                      className="accent-[var(--accent)]" />
                    {m}
                  </label>
                ))}
              </div>
            </fieldset>
            <button className={`${boton.chico} mt-2 bg-accent text-paper hover:opacity-90`}>Repartir</button>
          </form>
        </details>
      )}
    </div>
  );
}

function LineaLibre({ programaId, departamentoId, cuentas }: { programaId: number; departamentoId: number; cuentas: Cuenta[] }) {
  const id = `libre-${programaId}`;
  return (
    <form action={agregarLineaLibre} className={`${tarjeta} mt-2 grid w-[min(36rem,85vw)] gap-3 p-4 sm:grid-cols-2`}>
      <input type="hidden" name="departamentoId" value={departamentoId} />
      <input type="hidden" name="programaId" value={programaId} />
      <p className="text-xs text-ink-3 sm:col-span-2">
        Para lo que el catálogo no tiene: servicios, salidas, inscripciones, un artículo sin precio de tienda.
      </p>
      <div className="sm:col-span-2">
        <label htmlFor={`${id}-descripcion`} className={etiqueta}>Descripción</label>
        <input id={`${id}-descripcion`} name="descripcion" required maxLength={200} className={campo}
          placeholder="Bus para la salida pedagógica a Valparaíso" />
      </div>
      <div>
        <label htmlFor={`${id}-cantidad`} className={etiqueta}>Cantidad</label>
        <input id={`${id}-cantidad`} name="cantidad" type="number" min={1} step={1} defaultValue={1} required className={campo} />
      </div>
      <div>
        <label htmlFor={`${id}-precio`} className={etiqueta}>Precio unitario estimado (con IVA)</label>
        <input id={`${id}-precio`} name="precio" type="number" min={0} step={1} required className={campo} placeholder="250000" />
      </div>
      <div>
        <label htmlFor={`${id}-cuenta`} className={etiqueta}>Cuenta contable</label>
        <select id={`${id}-cuenta`} name="cuentaContableId" className={campo} defaultValue="">
          <option value="">Sin asignar</option>
          {cuentas.map((c) => <option key={c.id} value={c.id}>{c.codigo} {c.nombre}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-origen`} className={etiqueta}>¿De dónde sale el precio?</label>
        <input id={`${id}-origen`} name="origen" maxLength={200} className={campo} placeholder="Cotización, valor del año pasado…" />
      </div>
      <div className="sm:col-span-2">
        <button className={boton.primario}>Agregar línea</button>
      </div>
    </form>
  );
}

function NuevoPrograma({ departamentoId }: { departamentoId: number }) {
  return (
    <section className={`${tarjeta} p-5`}>
      <h2 className={`${titulo} mb-1`}>Nuevo programa</h2>
      <p className="mb-4 text-sm text-ink-3">
        Algo que el departamento planea hacer el próximo año: una olimpiada, una salida, el material de un ciclo.
      </p>
      <form action={crearPrograma} className="grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-end">
        <input type="hidden" name="departamentoId" value={departamentoId} />
        <div>
          <label htmlFor="nombre" className={etiqueta}>Nombre</label>
          <input id="nombre" name="nombre" required maxLength={120} className={campo} placeholder="Feria científica" />
        </div>
        <div>
          <label htmlFor="descripcion" className={etiqueta}>Descripción (opcional)</label>
          <input id="descripcion" name="descripcion" maxLength={600} className={campo}
            placeholder="Para qué es y a quiénes va dirigido" />
        </div>
        <button className={boton.primario}>Crear programa</button>
      </form>
    </section>
  );
}
