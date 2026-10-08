import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Encabezado, SinAcceso, SinDatos } from '@/components/encabezado';
import { Aviso, leerAviso } from '@/components/aviso';
import { EstadoPresupuestoPildora } from '@/components/pildoras';
import { GrillaMeses, type GrupoMeses } from '@/components/grilla-meses';
import { IconoVolver } from '@/components/iconos';
import { boton, tarjeta, tituloPagina } from '@/components/ui';
import { esJefeDe, getSesion, participaEnFormulacion } from '@/lib/sesion';
import { esEditable, programasConLineas, resumenDepartamento } from '@/lib/formulacion';
import { money } from '@/lib/formato';

type Props = {
  params: Promise<{ departamentoId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Los meses de todos los ítems en una sola pantalla: el jefe los indica sin
 * abrir ítem por ítem, mientras arma el presupuesto. Una vez enviado,
 * quedan a la vista de Dirección y contabilidad, sin cambios.
 */
export default async function MesesDelPresupuesto({ params, searchParams }: Props) {
  const sesion = await getSesion();
  if (!sesion) return <SinDatos />;

  const departamentoId = Number((await params).departamentoId);
  if (!Number.isInteger(departamentoId) || departamentoId <= 0) notFound();

  const puedeVer = participaEnFormulacion(sesion) && (sesion.veTodoElColegio || sesion.jefeDe?.id === departamentoId);
  if (!puedeVer || !sesion.anioFormulacion) {
    return (
      <>
        <Encabezado sesion={sesion} activo="formulacion" />
        <SinAcceso mensaje="Los meses de un presupuesto los ven su jefe, Dirección y contabilidad." />
      </>
    );
  }

  const resumen = await resumenDepartamento(departamentoId, sesion.anioFormulacion.id);
  if (!resumen) notFound();

  const volver = `/formulacion/${departamentoId}`;
  const soyJefe = esJefeDe(sesion, departamentoId);
  const editable = soyJefe && resumen.estado !== null && esEditable(resumen.estado);
  const aviso = await leerAviso(await searchParams);
  const anio = sesion.anioFormulacion.anio;

  const programas = resumen.presupuestoId ? await programasConLineas(resumen.presupuestoId) : [];
  const grupos: GrupoMeses[] = programas
    .filter((p) => p.lineas.length > 0)
    .map((p) => ({
      programa: p.nombre,
      items: p.lineas.map((l) => ({
        id: l.id, descripcion: l.descripcion, cantidad: l.cantidad, precio: l.precioUnitario, meses: l.meses,
      })),
    }));
  // Cambia cuando cambia lo guardado: después de guardar, la grilla muestra lo que quedó en la base.
  const guardado = grupos.flatMap((g) => g.items.map((i) => `${i.id}:${i.cantidad}:${i.meses.map((m) => `${m.mes}=${m.cantidad}`).join(',')}`)).join('|');

  return (
    <>
      <Encabezado sesion={sesion} activo="formulacion" />
      <Aviso {...aviso} />
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-8">
        <Link href={volver} className="mb-4 inline-flex items-center gap-1.5 text-[15px] font-medium text-accent hover:underline">
          <IconoVolver className="size-4" />{soyJefe ? 'Volver a mi presupuesto' : `Volver al presupuesto de ${resumen.departamento}`}
        </Link>

        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] font-medium text-ink-2">
          Presupuesto {anio} · {resumen.departamento} · {money(resumen.formulado)}
          <EstadoPresupuestoPildora estado={resumen.estado} />
        </p>
        <h1 className={`${tituloPagina} mb-3`}>Meses de cada ítem</h1>

        {editable ? (
          <div className="mb-6 max-w-4xl space-y-2 text-[17px] text-ink-2">
            <p>
              Escribe en cada mes cuántas unidades vas a usar. <b className="font-semibold text-ink">No tienen que ser partes
              iguales</b>: pon lo que vayas a necesitar. Por ejemplo, 50 témperas pueden ser 30 en abril, 15 en junio y 5 en octubre.
            </p>
            <p>
              Si algo se usa de una sola vez, escribe la cantidad completa en ese mes. Para enviar el presupuesto, todos los
              ítems tienen que tener sus meses; puedes guardar a medias y seguir otro día.
            </p>
            <p className="text-[15px]">
              Es una guía para que contabilidad tenga el dinero a tiempo: durante el año podrás pedir antes, después o más en
              un mes, mientras el total quepa en tu presupuesto.
            </p>
          </div>
        ) : (
          <p className="mb-6 max-w-4xl text-[17px] text-ink-2">
            {soyJefe && resumen.estado !== null
              ? 'Mientras revisan tu presupuesto, los meses no se pueden cambiar. Si necesitas corregir algo, retira el envío desde tu presupuesto.'
              : 'Cuántas unidades de cada ítem usará el departamento en cada mes, según lo que indicó su jefe.'}
          </p>
        )}

        {grupos.length === 0 ? (
          <div className={`${tarjeta} px-6 py-10 text-center`}>
            <p className="text-ink-2">Este presupuesto todavía no tiene ítems.</p>
            {soyJefe && <Link href={volver} className={`${boton.primario} mt-4`}>Agregar ítems a mi presupuesto</Link>}
          </div>
        ) : (
          <GrillaMeses key={guardado} grupos={grupos} departamentoId={departamentoId} editable={editable} />
        )}
      </main>
    </>
  );
}
