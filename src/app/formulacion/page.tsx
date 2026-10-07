import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Encabezado, SinAcceso, SinDatos } from '@/components/encabezado';
import { EstadoPresupuestoPildora } from '@/components/pildoras';
import { ResumenFormulacion } from '@/components/resumen-formulacion';
import { IconoFlecha } from '@/components/iconos';
import { boton, tarjeta, td, tdNum, th, tituloPagina } from '@/components/ui';
import { esContabilidad, esDireccion, getSesion, participaEnFormulacion } from '@/lib/sesion';
import { resumenFormulacion } from '@/lib/formulacion';
import { esperaRevision, ultimaNovedad } from '@/lib/etapas';
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

  const { anio, formulacionHasta } = sesion.anioFormulacion;
  const filas = await resumenFormulacion(sesion.colegio.id, sesion.anioFormulacion.id);
  // Filas con un botón: el texto va centrado en altura, alineado con él.
  const celda = td.replace('align-top', 'align-middle');
  const celdaNum = tdNum.replace('align-top', 'align-middle');
  const roles = { direccion: esDireccion(sesion), contabilidad: esContabilidad(sesion) };

  // Primero lo que espera la revisión de quien mira: Dirección, lo enviado;
  // contabilidad, lo que Dirección ya aprobó o volvió con los reparos corregidos.
  const orden = [
    ...filas.filter((f) => esperaRevision(f, roles)),
    ...filas.filter((f) => !esperaRevision(f, roles)),
  ];

  return (
    <>
      <Encabezado sesion={sesion} activo="formulacion" />
      <main className="mx-auto max-w-6xl px-5 pb-24 pt-8">
        <h1 className={tituloPagina}>Presupuestos {anio}</h1>
        <p className="mb-6 mt-2 max-w-3xl text-[17px] text-ink-2">
          Cada jefe arma el presupuesto de su departamento en tres periodos y lo envía a Dirección, que lo conversa en
          una reunión y lo aprueba o lo devuelve. Después lo revisa contabilidad: lo aprueba o envía reparos, y el jefe
          se lo reenvía corregido directo a ella. Con los aprobados se arman las órdenes de compra de cada periodo.
          {formulacionHasta && ` La formulación cierra el ${fecha(formulacionHasta)}.`}
        </p>

        <ResumenFormulacion filas={filas} />

        <div className={`${tarjeta} mt-6 overflow-hidden`}>
          {/* relative: el texto oculto de la última columna (sr-only, absoluto) queda
              dentro del scroll y no ensancha la página en el celular. */}
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
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
                  const revisar = esperaRevision(f, roles);
                  return (
                    <tr key={f.departamentoId} className={revisar ? 'bg-accent-soft/50' : 'hover:bg-surface-2'}>
                      <td className={`${celda} font-semibold`}>{f.departamento}</td>
                      <td className={celda}><EstadoPresupuestoPildora estado={f.estado} /></td>
                      <td className={celdaNum}>{f.lineas}</td>
                      <td className={celdaNum}>{f.estado ? money(f.formulado) : '—'}</td>
                      <td className={celdaNum}>{f.montoAprobado !== null ? money(f.montoAprobado) : '—'}</td>
                      <td className={`${celda} text-ink-2`}>{ultimaNovedad(f)}</td>
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
