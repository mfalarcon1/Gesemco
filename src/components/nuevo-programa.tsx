'use client';

import { useRef, useState } from 'react';
import { crearPrograma } from '@/app/formulacion/acciones';
import { PERIODOS, periodo as datosPeriodo, type NumeroPeriodo } from '@/lib/periodos';
import { IconoMas } from './iconos';
import { ayuda, boton, campo, etiqueta } from './ui';

const IDEAS = [
  'Material para las clases',
  'Salida pedagógica',
  'Olimpiada o concurso',
  'Muestra o feria',
  'Taller',
  'Acto o celebración',
];

/**
 * Crear un programa en un periodo. Con `periodo`, el programa va en ese
 * periodo (el botón de cada periodo); sin él, la persona lo elige (el primer
 * programa). Con `abierto` se muestra de entrada; si no, es un botón que
 * despliega el formulario.
 *
 * Las ideas llenan el nombre con un clic. Las sugerencias son los programas
 * que el departamento ya tiene en otros periodos: un programa que sigue en
 * otro periodo se vuelve a ingresar ahí, y así no hay que tipearlo de nuevo.
 */
export function NuevoPrograma({
  departamentoId, periodo, abierto = false, sugerencias = [],
}: { departamentoId: number; periodo?: NumeroPeriodo; abierto?: boolean; sugerencias?: string[] }) {
  const [visible, setVisible] = useState(abierto);
  const [nombre, setNombre] = useState('');
  const [elegido, setElegido] = useState<NumeroPeriodo>(periodo ?? 1);
  const refDescripcion = useRef<HTMLInputElement>(null);
  const sufijo = periodo ?? 'nuevo';
  const p = datosPeriodo(periodo ?? elegido);

  if (!visible) {
    return (
      <button type="button" onClick={() => setVisible(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong px-5 py-4 text-[15px] font-semibold text-accent hover:border-accent hover:bg-accent-soft">
        <IconoMas className="size-5" />Nuevo programa en el {p.nombre.toLowerCase()}
      </button>
    );
  }

  const chip = (texto: string) => (
    <button key={texto} type="button"
      onClick={() => { setNombre(texto); refDescripcion.current?.focus(); }}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        nombre === texto ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line-strong text-ink-2 hover:border-accent hover:text-ink'
      }`}>
      {texto}
    </button>
  );

  return (
    <form action={crearPrograma} id={`nuevo-programa-${sufijo}`}
      className={abierto ? '' : 'rounded-2xl border border-line bg-surface p-6'}>
      <input type="hidden" name="departamentoId" value={departamentoId} />
      {periodo && <input type="hidden" name="periodo" value={periodo} />}

      <h3 className="font-display text-xl font-semibold">
        {abierto && !periodo ? 'Crea tu primer programa' : `Nuevo programa en el ${p.nombre.toLowerCase()}`}
      </h3>
      <p className={`${ayuda} mt-1`}>
        {periodo
          ? `Lo que el departamento hará entre ${p.meses}. Si un programa sigue en otro periodo, créalo también allá, con lo que necesitará en ese periodo.`
          : 'Un programa es algo que el departamento hará el próximo año. Primero elige en qué periodo va.'}
      </p>

      {!periodo && (
        <fieldset className="mt-4">
          <legend className={etiqueta}>¿En qué periodo?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {PERIODOS.map((x) => (
              <label key={x.numero}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 ${
                  elegido === x.numero ? 'border-accent bg-accent-soft' : 'border-line-strong hover:border-accent'
                }`}>
                <input type="radio" name="periodo" value={x.numero} checked={elegido === x.numero}
                  onChange={() => setElegido(x.numero)} className="size-4 accent-accent" />
                <span>
                  <b className="block font-semibold text-ink">{x.nombre}</b>
                  <span className="block text-sm text-ink-2">{x.meses}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {sugerencias.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-ink">Ya los tienes en otro periodo</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Programas de otros periodos">
            {sugerencias.map(chip)}
          </div>
        </div>
      )}

      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold text-ink">{sugerencias.length > 0 ? 'O una idea nueva' : 'Ideas'}</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Ideas de programas">
          {IDEAS.filter((i) => !sugerencias.includes(i)).map(chip)}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1.5fr]">
        <div>
          <label htmlFor={`nombre-${sufijo}`} className={etiqueta}>Nombre del programa</label>
          <input id={`nombre-${sufijo}`} name="nombre" required maxLength={120} className={campo}
            value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Por ejemplo: Feria científica" />
        </div>
        <div>
          <label htmlFor={`descripcion-${sufijo}`} className={etiqueta}>
            ¿Para qué es? <span className="font-normal text-ink-2">(opcional)</span>
          </label>
          <input ref={refDescripcion} id={`descripcion-${sufijo}`} name="descripcion" maxLength={600} className={campo}
            placeholder="A quiénes va dirigido y cuándo se hace" />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button className={boton.primario}>Crear programa</button>
        {!abierto && <button type="button" className={boton.suave} onClick={() => setVisible(false)}>Cancelar</button>}
      </div>
    </form>
  );
}
