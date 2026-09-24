'use client';

import { useRef, useState } from 'react';
import { crearPrograma } from '@/app/formulacion/acciones';
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
 * Crear un programa. Con `abierto` se muestra de entrada (cuando el
 * presupuesto está vacío); si no, es un botón que despliega el formulario.
 * Las ideas llenan el nombre con un clic: sirven de ejemplo de qué es un
 * programa y ahorran tipear.
 */
export function NuevoPrograma({ departamentoId, abierto = false }: { departamentoId: number; abierto?: boolean }) {
  const [visible, setVisible] = useState(abierto);
  const [nombre, setNombre] = useState('');
  const refDescripcion = useRef<HTMLInputElement>(null);

  if (!visible) {
    return (
      <button type="button" onClick={() => setVisible(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong px-5 py-5 text-[15px] font-semibold text-accent hover:border-accent hover:bg-accent-soft">
        <IconoMas className="size-5" />Nuevo programa
      </button>
    );
  }

  return (
    <form action={crearPrograma} id="nuevo-programa"
      className={abierto ? '' : 'rounded-2xl border border-line bg-surface p-6'}>
      <input type="hidden" name="departamentoId" value={departamentoId} />
      <h3 className="font-display text-xl font-semibold">{abierto ? 'Crea tu primer programa' : 'Nuevo programa'}</h3>
      <p className={`${ayuda} mt-1`}>
        Un programa es algo que el departamento hará el próximo año. Escribe el nombre o elige una idea.
      </p>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Ideas de programas">
        {IDEAS.map((idea) => (
          <button key={idea} type="button"
            onClick={() => { setNombre(idea); refDescripcion.current?.focus(); }}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              nombre === idea ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line-strong text-ink-2 hover:border-accent hover:text-ink'
            }`}>
            {idea}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1.5fr]">
        <div>
          <label htmlFor="nombre" className={etiqueta}>Nombre del programa</label>
          <input id="nombre" name="nombre" required maxLength={120} className={campo}
            value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Por ejemplo: Feria científica" />
        </div>
        <div>
          <label htmlFor="descripcion" className={etiqueta}>
            ¿Para qué es? <span className="font-normal text-ink-2">(opcional)</span>
          </label>
          <input ref={refDescripcion} id="descripcion" name="descripcion" maxLength={600} className={campo}
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
