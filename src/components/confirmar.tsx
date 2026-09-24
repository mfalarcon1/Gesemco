'use client';

import { useEffect, useRef, useState } from 'react';
import { boton } from './ui';

/**
 * Botón que pregunta antes de hacer algo que no se deshace (quitar un ítem,
 * eliminar un programa, aprobar un presupuesto). Va dentro de un <form>: el
 * botón de confirmar es el que lo envía.
 */
export function BotonConConfirmacion({
  texto, pregunta, confirmar, clase, claseConfirmar, icono, enfocar = 'cancelar',
}: {
  texto: string;
  pregunta: string;
  confirmar: string;
  clase: string;
  claseConfirmar: string;
  icono?: React.ReactNode;
  /** Qué botón queda con el foco al preguntar. Por defecto, el que no hace nada. */
  enfocar?: 'confirmar' | 'cancelar';
}) {
  const [preguntando, setPreguntando] = useState(false);
  const refConfirmar = useRef<HTMLButtonElement>(null);
  const refCancelar = useRef<HTMLButtonElement>(null);
  const refAbrir = useRef<HTMLButtonElement>(null);
  const [volverFoco, setVolverFoco] = useState(false);

  useEffect(() => {
    if (preguntando) (enfocar === 'confirmar' ? refConfirmar : refCancelar).current?.focus();
    else if (volverFoco) refAbrir.current?.focus();
  }, [preguntando, enfocar, volverFoco]);

  if (!preguntando) {
    return (
      <button ref={refAbrir} type="button" className={clase} onClick={() => setPreguntando(true)}>
        {icono}{texto}
      </button>
    );
  }

  return (
    <span role="group" aria-label={pregunta} className="inline-flex flex-wrap items-center gap-2">
      <span className="text-[15px] font-medium text-ink">{pregunta}</span>
      <button ref={refConfirmar} type="submit" className={claseConfirmar}>{confirmar}</button>
      <button
        ref={refCancelar}
        type="button"
        className={boton.suave}
        onClick={() => { setVolverFoco(true); setPreguntando(false); }}
      >
        Cancelar
      </button>
    </span>
  );
}
