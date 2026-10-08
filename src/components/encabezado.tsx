import Link from 'next/link';
import { SelectorUsuario } from './selector-usuario';
import { boton, tituloPagina } from './ui';
import { iniciales } from '@/lib/formato';
import { contarPedidos } from '@/lib/ejecucion';
import {
  esContabilidad, esDireccion, esEquipoCompra, participaEnFormulacion, usuariosDisponibles,
  veEjecucionColegio, type Sesion,
} from '@/lib/sesion';

export type Seccion =
  | 'inicio' | 'formulacion' | 'proyeccion' | 'pedidos' | 'solicitudes' | 'compras' | 'ejecucion' | 'catalogo';

type Enlace = { seccion: Seccion; href: string; texto: string; cuenta?: number };

/**
 * Cada rol ve lo suyo: el jefe, su presupuesto del próximo año y sus pedidos
 * de este; Dirección, los presupuestos, las solicitudes y la ejecución;
 * contabilidad, los presupuestos, la proyección y la ejecución; el equipo de
 * compra, lo que hay que comprar. Las solicitudes y las compras muestran
 * cuántas esperan.
 */
async function enlaces(sesion: Sesion): Promise<Enlace[]> {
  const anioF = sesion.anioFormulacion;
  const anioE = sesion.anioEjecucion;
  const [solicitudes, porComprar] = await Promise.all([
    anioE && esDireccion(sesion) ? contarPedidos(sesion.colegio.id, anioE.id, 'pendiente_direccion') : 0,
    anioE && esEquipoCompra(sesion) ? contarPedidos(sesion.colegio.id, anioE.id, 'emitida') : 0,
  ]);

  const lista: Enlace[] = [{ seccion: 'inicio', href: '/', texto: 'Inicio' }];
  if (anioF && participaEnFormulacion(sesion)) {
    const soloSuDepartamento = sesion.jefeDe && !sesion.veTodoElColegio;
    lista.push({
      seccion: 'formulacion',
      href: soloSuDepartamento ? `/formulacion/${sesion.jefeDe!.id}` : '/formulacion',
      texto: soloSuDepartamento ? `Mi presupuesto ${anioF.anio}` : `Presupuestos ${anioF.anio}`,
    });
  }
  if (anioF && esContabilidad(sesion)) {
    lista.push({ seccion: 'proyeccion', href: '/proyeccion', texto: `Proyección ${anioF.anio}` });
  }
  if (anioE && sesion.jefeDe) {
    lista.push({ seccion: 'pedidos', href: `/ejecucion/${sesion.jefeDe.id}`, texto: `Pedidos ${anioE.anio}` });
  }
  if (anioE && esDireccion(sesion)) {
    lista.push({ seccion: 'solicitudes', href: '/solicitudes', texto: 'Solicitudes', cuenta: solicitudes });
  }
  if (anioE && esEquipoCompra(sesion)) {
    lista.push({ seccion: 'compras', href: '/compras', texto: 'Compras', cuenta: porComprar });
  }
  if (anioE && veEjecucionColegio(sesion)) {
    lista.push({ seccion: 'ejecucion', href: '/ejecucion', texto: `Ejecución ${anioE.anio}` });
  }
  lista.push({ seccion: 'catalogo', href: '/catalogo', texto: 'Catálogo' });
  return lista;
}

/** "Jefatura de Arte", "Dirección del colegio", "Profesor"… */
export function rolVisible(sesion: Sesion): string {
  return sesion.rol === 'jefe_departamento' && sesion.jefeDe
    ? `Jefatura de ${sesion.jefeDe.nombre}`
    : sesion.etiquetaRol;
}

export async function Encabezado({ sesion, activo }: { sesion: Sesion; activo: Seccion }) {
  const [usuarios, secciones] = await Promise.all([usuariosDisponibles(), enlaces(sesion)]);

  return (
    <>
      {/* Mientras no hay inicio de sesión real: queda claro que esto es solo para probar. */}
      <div className="border-b border-line bg-surface-2">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-5 py-1.5 text-sm text-ink-2">
          <span className="rounded-md border border-dashed border-line-strong px-2 py-0.5 text-[13px] font-semibold text-ink-2">
            Modo de prueba
          </span>
          <SelectorUsuario usuarios={usuarios} actual={sesion.usuario.id} />
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-2.5">
          <Link href="/" className="flex items-center gap-3 rounded-lg">
            <span className="grid size-10 place-items-center rounded-xl bg-accent font-display text-[15px] font-bold text-paper">
              GE
            </span>
            <span>
              <b className="block font-display text-base font-bold leading-tight">Presupuesto Escolar</b>
              <span className="block text-[13px] leading-tight text-ink-2">{sesion.colegio.nombre}</span>
            </span>
          </Link>

          <nav aria-label="Secciones" className="order-last flex w-full flex-wrap gap-1 md:order-none md:w-auto">
            {secciones.map((e) => (
              <Link
                key={e.seccion}
                href={e.href}
                aria-current={e.seccion === activo ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[15px] transition-colors ${
                  e.seccion === activo
                    ? 'bg-accent-soft font-semibold text-accent-ink'
                    : 'font-medium text-ink-2 hover:bg-surface-2 hover:text-ink'
                }`}
              >
                {e.texto}
                {e.cuenta ? (
                  <span className="tabular rounded-full bg-accent px-1.5 py-0.5 text-[13px] font-semibold leading-none text-paper">
                    {e.cuenta}<span className="sr-only"> {e.cuenta === 1 ? 'pendiente' : 'pendientes'}</span>
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            <span aria-hidden className="grid size-9 place-items-center rounded-full bg-accent-soft text-[13px] font-bold text-accent-ink">
              {iniciales(sesion.usuario.nombre)}
            </span>
            <span className="hidden text-right sm:block">
              <b className="block text-sm font-semibold leading-tight">{sesion.usuario.nombre}</b>
              <span className="block text-[13px] leading-tight text-ink-2">{rolVisible(sesion)}</span>
            </span>
          </div>
        </div>
      </header>
    </>
  );
}

/** Para las páginas cuando la base no tiene colegio o años cargados. */
export function SinDatos() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <h1 className={`${tituloPagina} mb-3`}>Sin datos todavía</h1>
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
      <h1 className={`${tituloPagina} mb-3`}>No tienes acceso a esta página</h1>
      <p className="text-ink-2">{mensaje}</p>
      <Link href="/" className={`${boton.secundario} mt-6`}>Volver al inicio</Link>
    </main>
  );
}
