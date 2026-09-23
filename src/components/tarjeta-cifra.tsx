export function TarjetaCifra({
  titulo, valor, nota, tono = 'normal',
}: { titulo: string; valor: string; nota?: string; tono?: 'normal' | 'ok' | 'warn' | 'bad' }) {
  const color =
    tono === 'ok' ? 'text-ok' : tono === 'warn' ? 'text-warn' : tono === 'bad' ? 'text-bad' : 'text-ink';

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="mb-1.5 text-[11px] uppercase tracking-wider text-ink-3">{titulo}</p>
      <p className={`tabular font-mono text-xl font-medium tracking-tight ${color}`}>{valor}</p>
      {nota ? <p className="mt-1 text-xs text-ink-3">{nota}</p> : null}
    </div>
  );
}

const TONO_ESTADO: Record<string, string> = {
  borrador: 'bg-surface-2 text-ink-2',
  enviada: 'bg-accent-soft text-accent-ink',
  excepcion: 'bg-warn-soft text-warn',
  aprobada: 'bg-ok-soft text-ok',
  rechazada: 'bg-bad-soft text-bad',
  recepcionada: 'bg-ok-soft text-ok',
  pagada: 'bg-surface-2 text-ink-2',
  anulada: 'bg-surface-2 text-ink-3',
};

const NOMBRE_ESTADO: Record<string, string> = {
  borrador: 'Borrador',
  enviada: 'En aprobación',
  excepcion: 'En excepción',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  recepcionada: 'Recepcionada',
  pagada: 'Pagada',
  anulada: 'Anulada',
};

export function PildoraEstado({ estado }: { estado: string }) {
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${TONO_ESTADO[estado] ?? 'bg-surface-2 text-ink-2'}`}>
      {NOMBRE_ESTADO[estado] ?? estado}
    </span>
  );
}
