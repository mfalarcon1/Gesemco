import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Encabezado, SinAcceso, SinDatos } from '@/components/encabezado';
import { Aviso, leerAviso } from '@/components/aviso';
import { GrillaMeses, type GrupoMeses } from '@/components/grilla-meses';
import { IconoVolver } from '@/components/iconos';
import { boton, tarjeta, tituloPagina } from '@/components/ui';
import { esJefeDe, getSesion, participaEnFormulacion } from '@/lib/sesion';
import { programasConLineas, resumenDepartamento } from '@/lib/formulacion';
import { money } from '@/lib/formato';

type Props = {
  params: Promise<{ departamentoId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Los meses de todos los ítems en una sola pantalla: el jefe los indica sin
 * abrir ítem por ítem. Solo con el presupuesto aprobado.
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
  const aviso = await leerAviso(await searchParams);
  const anio = sesion.anioFormulacion.anio;

  if (resumen.estado !== 'aprobado' || !resumen.presupuestoId) {
    return (
      <>
        <Encabezado sesion={sesion} activo="formulacion" />
        <main className="mx-auto max-w-3xl px-5 py-16">
          <h1 className={`${tituloPagina} mb-3`}>Todavía no toca indicar los meses</h1>
          <p className="text-ink-2">
            Los meses se indican cuando Dirección aprueba el presupuesto {anio} de {resumen.departamento}.
          </p>
          <Link href={volver} className={`${boton.secundario} mt-6`}>Volver al presupuesto</Link>
        </main>
      </>
    );
  }

  const programas = await programasConLineas(resumen.presupuestoId);
  const grupos: GrupoMeses[] = programas
    .filter((p) => p.lineas.length > 0)
    .map((p) => ({
      programa: p.nombre,
      items: p.lineas.map((l) => ({ id: l.id, descripcion: l.descripcion, cantidad: l.cantidad, meses: l.meses })),
    }));
  // Cambia cuando cambia lo guardado: después de guardar, la grilla muestra lo que quedó en la base.
  const guardado = grupos.flatMap((g) => g.items.map((i) => `${i.id}:${i.meses.map((m) => `${m.mes}=${m.cantidad}`).join(',')}`)).join('|');

  return (
    <>
      <Encabezado sesion={sesion} activo="formulacion" />
      <Aviso {...aviso} />
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-8">
        <Link href={volver} className="mb-4 inline-flex items-center gap-1.5 text-[15px] font-medium text-accent hover:underline">
          <IconoVolver className="size-4" />{soyJefe ? 'Volver a mi presupuesto' : `Volver al presupuesto de ${resumen.departamento}`}
        </Link>

        <p className="text-[15px] font-medium text-ink-2">Presupuesto {anio} · {resumen.departamento} · aprobado por {money(resumen.montoAprobado)}</p>
        <h1 className={`${tituloPagina} mb-3`}>Meses de cada compra</h1>

        {soyJefe ? (
          <div className="mb-6 max-w-4xl space-y-2 text-[17px] text-ink-2">
            <p>
              Escribe en cada mes cuántas unidades vas a necesitar. <b className="font-semibold text-ink">No tienen que ser partes
              iguales</b>: pon lo que vayas a usar. Por ejemplo, 50 témperas pueden ser 30 en abril, 15 en junio y 5 en octubre.
            </p>
            <p>
              Si algo se compra de una sola vez, escribe la cantidad completa en ese mes. Puedes guardar a medias y seguir otro día.
            </p>
          </div>
        ) : (
          <p className="mb-6 max-w-4xl text-[17px] text-ink-2">
            Cuántas unidades de cada ítem necesita el departamento en cada mes, según lo que indicó su jefe.
          </p>
        )}

        {grupos.length === 0 ? (
          <p className={`${tarjeta} px-6 py-10 text-center text-ink-2`}>Este presupuesto no tiene ítems.</p>
        ) : (
          <GrillaMeses key={guardado} grupos={grupos} departamentoId={departamentoId} editable={soyJefe} />
        )}
      </main>
    </>
  );
}
