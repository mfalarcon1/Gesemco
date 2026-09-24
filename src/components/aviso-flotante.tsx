'use client';

import { useEffect, useState } from 'react';
import { IconoAlerta, IconoCerrar, IconoOk } from './iconos';

const PARAMETROS = ['ok', 'error', 't'];
// El mismo nombre que COOKIE_ERROR de src/lib/acciones.ts (que no se puede importar aquí: usa la base).
const COOKIE_ERROR = 'gesemco_error';

/**
 * Aviso que flota bajo el encabezado. El de éxito se va solo; el de error se
 * queda hasta que la persona lo cierre, para que alcance a leerlo.
 */
export function AvisoFlotante({ ok, error }: { ok?: string; error?: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Un aviso se muestra una vez: se saca ?ok= de la dirección y se borra la cookie del
    // error, para que no se repita si la persona recarga o cambia de página.
    const url = new URL(window.location.href);
    if (PARAMETROS.some((p) => url.searchParams.has(p))) {
      PARAMETROS.forEach((p) => url.searchParams.delete(p));
      window.history.replaceState(window.history.state, '', url);
    }
    if (error) {
      document.cookie = `${COOKIE_ERROR}=; path=/; max-age=0`;
      return;
    }
    const t = setTimeout(() => setVisible(false), 8000);
    return () => clearTimeout(t);
  }, [error]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4">
      <div
        role={error ? 'alert' : 'status'}
        className={`entrar pointer-events-auto flex w-full max-w-xl items-start gap-3 rounded-xl border px-4 py-3.5 text-[15px] text-ink shadow-lg ${
          error ? 'border-bad/40 bg-bad-soft' : 'border-ok/40 bg-ok-soft'
        }`}
      >
        {error ? (
          <IconoAlerta className="mt-0.5 size-5 shrink-0 text-bad" />
        ) : (
          <IconoOk className="mt-0.5 size-5 shrink-0 text-ok" />
        )}
        <p className="min-w-0 flex-1">
          {error ? <><b className="font-semibold text-bad">No se pudo: </b>{error}</> : ok}
        </p>
        <button type="button" onClick={() => setVisible(false)} aria-label="Cerrar aviso"
          className="-m-1 rounded-md p-1 text-ink-2 hover:bg-surface/60 hover:text-ink">
          <IconoCerrar className="size-4" />
        </button>
      </div>
    </div>
  );
}
