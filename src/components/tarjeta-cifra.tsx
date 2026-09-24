/**
 * Una cifra con su título. El valor va en la sans con cifras proporcionales:
 * las tabulares (todas del ancho de un 0) se reservan para columnas de tablas.
 */
export function TarjetaCifra({
  titulo, valor, nota, tono = 'normal',
}: { titulo: string; valor: string; nota?: string; tono?: 'normal' | 'ok' | 'warn' | 'bad' }) {
  const color =
    tono === 'ok' ? 'text-ok' : tono === 'warn' ? 'text-warn' : tono === 'bad' ? 'text-bad' : 'text-ink';

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="mb-1 text-sm font-medium text-ink-2">{titulo}</p>
      <p className={`text-2xl font-semibold tracking-tight ${color}`}>{valor}</p>
      {nota ? <p className="mt-1 text-sm text-ink-2">{nota}</p> : null}
    </div>
  );
}
