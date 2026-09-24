import { IconoAlerta, IconoOk } from './iconos';

type Params = Record<string, string | string[] | undefined>;

/** Lee ?ok= y ?error=, que dejan las acciones del servidor al volver. */
export function leerAviso(params: Params): { ok?: string; error?: string } {
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return { ok: uno(params.ok), error: uno(params.error) };
}

export function Aviso({ ok, error }: { ok?: string; error?: string }) {
  if (error) {
    return (
      <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-ink">
        <IconoAlerta className="mt-0.5 size-4 shrink-0 text-bad" />
        <p><b className="font-semibold text-bad">No se pudo: </b>{error}</p>
      </div>
    );
  }
  if (ok) {
    return (
      <div role="status" className="mb-5 flex items-start gap-2.5 rounded-xl border border-ok/30 bg-ok-soft px-4 py-3 text-sm text-ink">
        <IconoOk className="mt-0.5 size-4 shrink-0 text-ok" />
        <p>{ok}</p>
      </div>
    );
  }
  return null;
}
