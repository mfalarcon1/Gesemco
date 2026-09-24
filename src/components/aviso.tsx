import { cookies } from 'next/headers';
import { AvisoFlotante } from './aviso-flotante';
import { COOKIE_ERROR } from '@/lib/acciones';

type Params = Record<string, string | string[] | undefined>;
export type LeidoAviso = { ok?: string; error?: string; clave?: string };

/**
 * El resultado de la última acción: el éxito llega en ?ok= (con ?t= para
 * distinguir dos avisos iguales seguidos) y el error en una cookie de un solo
 * uso, porque ante un error la página no cambia de dirección (ver `responder`).
 */
export async function leerAviso(params: Params): Promise<LeidoAviso> {
  const crudo = (await cookies()).get(COOKIE_ERROR)?.value;
  if (crudo) {
    try {
      const { mensaje, t } = JSON.parse(decodeURIComponent(crudo)) as { mensaje: string; t: number };
      return { error: mensaje, clave: String(t) };
    } catch {
      // Una cookie que no se entiende no debe romper la página.
    }
  }
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return { ok: uno(params.ok), clave: uno(params.t) };
}

/** El resultado de la última acción, flotando arriba para que se vea aunque la página baje. */
export function Aviso({ ok, error, clave }: LeidoAviso) {
  if (!ok && !error) return null;
  return <AvisoFlotante key={clave ?? error ?? ok} ok={ok} error={error} />;
}
