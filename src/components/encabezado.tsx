import Link from 'next/link';
import { SelectorUsuario } from './selector-usuario';
import { iniciales } from '@/lib/formato';
import {
  participaEnFormulacion, usuariosDisponibles, veProyeccion, type Sesion,
} from '@/lib/sesion';

export type Seccion = 'inicio' | 'formulacion' | 'catalogo' | 'proyeccion';

function enlaces(sesion: Sesion): { seccion: Seccion; href: string; texto: string }[] {
  const lista: { seccion: Seccion; href: string; texto: string }[] = [
    { seccion: 'inicio', href: '/', texto: 'Inicio' },
  ];
  if (sesion.anioFormulacion && participaEnFormulacion(sesion)) {
    lista.push({
      seccion: 'formulacion',
      href: sesion.jefeDe && !sesion.veTodoElColegio ? `/formulacion/${sesion.jefeDe.id}` : '/formulacion',
      texto: `Formulación ${sesion.anioFormulacion.anio}`,
    });
  }
  lista.push({ seccion: 'catalogo', href: '/catalogo', texto: 'Catálogo' });
  if (sesion.anioFormulacion && veProyeccion(sesion)) {
    lista.push({ seccion: 'proyeccion', href: '/proyeccion', texto: 'Proyección mensual' });
  }
  return lista;
}

const lista = (d: { nombre: string }[]) => d.map((x) => x.nombre).join(' y ');

/** "Jefatura de Arte", "Dirección del colegio", "Profesor"… */
function rolVisible(sesion: Sesion): string {
  return sesion.rol === 'jefe_departamento' && sesion.jefeDe
    ? `Jefatura de ${sesion.jefeDe.nombre}`
    : sesion.etiquetaRol;
}

/** Lo que el rol todavía no dice: el alcance completo o las clases en otros departamentos. */
function alcance(sesion: Sesion): string {
  if (sesion.veTodoElColegio) return `${sesion.colegio.nombre}, todos los departamentos`;
  const clases = sesion.profesorEn.filter((d) => d.id !== sesion.jefeDe?.id);
  if (sesion.jefeDe) return clases.length ? `También hace clases en ${lista(clases)}` : '';
  return clases.length ? `Clases en ${lista(clases)}` : 'Sin departamento asignado';
}

export async function Encabezado({ sesion, activo }: { sesion: Sesion; activo: Seccion }) {
  const usuarios = await usuariosDisponibles();

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-lg bg-accent font-display text-[13px] font-bold text-paper">
              GE
            </span>
            <span>
              <b className="block font-display text-sm font-semibold leading-tight">Presupuesto Escolar</b>
              <span className="block text-[11px] leading-tight text-ink-3">{sesion.colegio.nombre} · GESEMCO</span>
            </span>
          </Link>

          <nav aria-label="Secciones" className="flex flex-wrap gap-1 text-sm">
            {enlaces(sesion).map((e) => (
              <Link
                key={e.seccion}
                href={e.href}
                aria-current={e.seccion === activo ? 'page' : undefined}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  e.seccion === activo
                    ? 'bg-accent-soft font-medium text-accent-ink'
                    : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
                }`}
              >
                {e.texto}
              </Link>
            ))}
          </nav>

          <div className="ml-auto">
            <SelectorUsuario usuarios={usuarios} actual={sesion.usuario.id} />
          </div>
        </div>
      </header>

      <div className="border-b border-line bg-surface-2">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-2.5">
          <div className="grid size-7 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-ink">
            {iniciales(sesion.usuario.nombre)}
          </div>
          <div className="text-sm">
            <b className="font-semibold">{sesion.usuario.nombre}</b>
            <span className="text-ink-3"> · {rolVisible(sesion)}</span>
          </div>
          <span className="text-xs text-ink-3">{alcance(sesion)}</span>
          <span className="ml-auto flex flex-wrap gap-2">
            {sesion.anioEjecucion && (
              <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 font-mono text-[11px] text-ink-2">
                Ejecución {sesion.anioEjecucion.anio}
              </span>
            )}
            {sesion.anioFormulacion && (
              <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 font-mono text-[11px] text-ink-2">
                Formulación {sesion.anioFormulacion.anio}
              </span>
            )}
          </span>
        </div>
      </div>
    </>
  );
}

/** Para las páginas cuando la base no tiene colegio o años cargados. */
export function SinDatos() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="mb-3 font-display text-2xl font-semibold">Sin datos todavía</h1>
      <p className="text-ink-2">
        La base está conectada pero no encuentro un colegio con usuarios. Corre{' '}
        <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-sm">npm run db:reset</code>, que carga el
        esquema y los datos de prueba.
      </p>
    </main>
  );
}

/** Cuando el rol no alcanza para ver la página. */
export function SinAcceso({ mensaje }: { mensaje: string }) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="mb-3 font-display text-2xl font-semibold">No tienes acceso a esta página</h1>
      <p className="text-ink-2">{mensaje}</p>
      <Link href="/" className="mt-5 inline-block text-sm text-accent hover:underline">Volver al inicio</Link>
    </main>
  );
}
