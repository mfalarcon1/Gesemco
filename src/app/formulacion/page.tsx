import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Encabezado, SinAcceso, SinDatos } from '@/components/encabezado';
import { EstadoPresupuestoPildora } from '@/components/pildoras';
import { TarjetaCifra } from '@/components/tarjeta-cifra';
import { tarjeta, td, tdNum, th } from '@/components/ui';
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
        <SinAcceso mensaje="La formulación del presupuesto la hacen los jefes de departamento, Dirección y contabilidad." />
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
  const aprobados = filas.filter((f) => f.estado === 'aprobado');
  const porRevisar = filas.filter((f) => f.estado === 'enviado');
  const formulado = filas.reduce((s, f) => s + f.formulado, 0);
  const fueraCatalogo = filas.reduce((s, f) => s + f.fueraCatalogo, 0);

  // Dirección ve primero lo que espera su revisión.
  const orden = esDireccion(sesion)
    ? [...porRevisar, ...filas.filter((f) => f.estado !== 'enviado')]
    : filas;

  return (
    <>
      <Encabezado sesion={sesion} activo="formulacion" />
      <main className="mx-auto max-w-6xl px-5 pb-20 pt-7">
        <h1 className="mb-1 font-display text-2xl font-semibold">Formulación {anio}</h1>
        <p className="mb-6 max-w-3xl text-sm text-ink-2">
          Cada jefe arma sus programas con artículos del catálogo o líneas libres y los envía. Dirección los
          conversa en reunión y después aprueba o devuelve cada presupuesto aquí. Con el presupuesto aprobado,
          el jefe asigna los meses y GESEMCO recibe la proyección mensual.
        </p>

        <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(168px,1fr))] gap-3">
          <TarjetaCifra titulo="Formulado" valor={money(formulado)} nota="suma de todas las líneas" />
          <TarjetaCifra titulo="Aprobado" valor={money(aprobados.reduce((s, f) => s + (f.montoAprobado ?? 0), 0))}
            nota={`${aprobados.length} de ${filas.length} departamentos`} />
          <TarjetaCifra titulo="Esperan revisión" valor={String(porRevisar.length)}
            nota={porRevisar.map((f) => f.departamento).join(', ') || 'ninguno'} />
          <TarjetaCifra titulo="Fuera de catálogo" valor={money(fueraCatalogo)}
            nota="servicios y artículos sin precio de tienda" />
        </div>

        <div className={`${tarjeta} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="bg-surface-2">
                  <th className={th}>Departamento</th>
                  <th className={th}>Estado</th>
                  <th className={`${th} text-right`}>Programas</th>
                  <th className={`${th} text-right`}>Líneas</th>
                  <th className={`${th} text-right`}>Formulado</th>
                  <th className={`${th} text-right`}>Aprobado</th>
                  <th className={th}>Último movimiento</th>
                </tr>
              </thead>
              <tbody>
                {orden.map((f) => (
                  <tr key={f.departamentoId} className="hover:bg-surface-2">
                    <td className={td}>
                      <Link href={`/formulacion/${f.departamentoId}`} className="font-medium text-accent hover:underline">
                        {f.departamento}
                      </Link>
                    </td>
                    <td className={td}><EstadoPresupuestoPildora estado={f.estado} /></td>
                    <td className={tdNum}>{f.programas}</td>
                    <td className={tdNum}>{f.lineas}</td>
                    <td className={tdNum}>{f.estado ? money(f.formulado) : '—'}</td>
                    <td className={tdNum}>{f.montoAprobado !== null ? money(f.montoAprobado) : '—'}</td>
                    <td className={`${td} text-ink-2`}>
                      {f.estado === 'enviado' && `Enviado el ${fecha(f.enviadoEn)}`}
                      {(f.estado === 'aprobado' || f.estado === 'devuelto') &&
                        `${f.estado === 'aprobado' ? 'Aprobado' : 'Devuelto'} el ${fecha(f.resueltoEn)}`}
                      {(f.estado === 'borrador' || f.estado === null) && <span className="text-ink-3">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
