import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Encabezado, SinAcceso, SinDatos } from '@/components/encabezado';
import { EstadoPresupuestoPildora } from '@/components/pildoras';
import { ResumenFormulacion } from '@/components/resumen-formulacion';
import { IconoFlecha } from '@/components/iconos';
import { boton, tarjeta, td, tdNum, th, tituloPagina } from '@/components/ui';
import { esDireccion, getSesion, participaEnFormulacion } from '@/lib/sesion';
import { resumenFormulacion } from '@/lib/formulacion';
import { fecha, money } from '@/lib/formato';

export default async function Formulacion() {
  const sesion = await getSesion();
  if (!sesion) return <SinDatos />;

  // El jefe de departamento trabaja en su propio presupuesto.
  if (sesion.jefeDe && !sesion.veTodoElColegio) redirect(`/formulacion/${sesion.jefeDe.id}`);

  if (!participaEnFormulacion(sesion)) {
    return (
      <>
        <Encabezado sesion={sesion} activo="formulacion" />
        <SinAcceso mensaje="El presupuesto de cada departamento lo arman los jefes y lo revisan Dirección y contabilidad." />
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

  const anio = sesion.anioFormulacion.anio;
  const filas = await resumenFormulacion(sesion.colegio.id, sesion.anioFormulacion.id);
  // Filas con un botón: el texto va centrado en altura, alineado con él.
  const celda = td.replace('align-top', 'align-middle');
  const celdaNum = tdNum.replace('align-top', 'align-middle');
  const soyDireccion = esDireccion(sesion);

  // Dirección ve primero lo que espera su revisión.
  const orden = soyDireccion
    ? [...filas.filter((f) => f.estado === 'enviado'), ...filas.filter((f) => f.estado !== 'enviado')]
    : filas;

  return (
    <>
      <Encabezado sesion={sesion} activo="formulacion" />
      <main className="mx-auto max-w-6xl px-5 pb-24 pt-8">
        <h1 className={tituloPagina}>Presupuestos {anio}</h1>
        <p className="mb-6 mt-2 max-w-3xl text-[17px] text-ink-2">
          Cada jefe arma el presupuesto de su departamento y lo envía. Dirección lo conversa en una reunión y lo aprueba
          o lo devuelve con un comentario. Con el presupuesto aprobado, el jefe indica los meses y GESEMCO recibe la
          proyección mensual.
        </p>

        <ResumenFormulacion filas={filas} />

        <div className={`${tarjeta} mt-6 overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="bg-surface-2">
                  <th className={th}>Departamento</th>
                  <th className={th}>Estado</th>
                  <th className={`${th} text-right`}>Ítems</th>
                  <th className={`${th} text-right`}>Total pedido</th>
                  <th className={`${th} text-right`}>Aprobado</th>
                  <th className={th}>Última novedad</th>
                  <th className={th}><span className="sr-only">Abrir</span></th>
                </tr>
              </thead>
              <tbody>
                {orden.map((f) => {
                  const revisar = soyDireccion && f.estado === 'enviado';
                  return (
                    <tr key={f.departamentoId} className={revisar ? 'bg-accent-soft/50' : 'hover:bg-surface-2'}>
                      <td className={`${celda} font-semibold`}>{f.departamento}</td>
                      <td className={celda}><EstadoPresupuestoPildora estado={f.estado} /></td>
                      <td className={celdaNum}>{f.lineas}</td>
                      <td className={celdaNum}>{f.estado ? money(f.formulado) : '—'}</td>
                      <td className={celdaNum}>{f.montoAprobado !== null ? money(f.montoAprobado) : '—'}</td>
                      <td className={`${celda} text-ink-2`}>
                        {f.estado === 'enviado' && `Enviado el ${fecha(f.enviadoEn)}`}
                        {(f.estado === 'aprobado' || f.estado === 'devuelto') &&
                          `${f.estado === 'aprobado' ? 'Aprobado' : 'Devuelto'} el ${fecha(f.resueltoEn)}`}
                        {f.estado === 'borrador' && 'En preparación'}
                        {f.estado === null && 'Todavía no empieza'}
                      </td>
                      <td className={`${celda} text-right`}>
                        <Link href={`/formulacion/${f.departamentoId}`}
                          aria-label={`${revisar ? 'Revisar' : 'Ver'} el presupuesto de ${f.departamento}`}
                          className={revisar ? `${boton.chico} bg-accent text-paper hover:bg-accent-ink` : `${boton.chico} text-accent hover:bg-accent-soft`}>
                          {revisar ? 'Revisar' : 'Ver'}<IconoFlecha className="size-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
