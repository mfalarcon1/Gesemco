'use client';

import { useRef } from 'react';
import { cambiarUsuario } from '@/app/actions';

type Opcion = { id: number; nombre: string; rol: string | null; departamento: string | null };

const ETIQUETA: Record<string, string> = {
  administrador: 'administrador',
  direccion: 'Dirección',
  contabilidad: 'contabilidad',
  equipo_compra: 'equipo de compra',
  jefe_departamento: 'jefe',
  profesor: 'profesor',
};

function detalle(u: Opcion) {
  if (!u.rol) return '';
  const rol = ETIQUETA[u.rol] ?? u.rol;
  return u.departamento ? ` — ${rol} ${u.departamento}` : ` — ${rol}`;
}

export function SelectorUsuario({ usuarios, actual }: { usuarios: Opcion[]; actual: number }) {
  const form = useRef<HTMLFormElement>(null);

  return (
    <form ref={form} action={cambiarUsuario} className="flex items-center gap-2">
      <label htmlFor="usuarioId" className="text-xs text-ink-3">
        Ver como
      </label>
      <select
        id="usuarioId"
        name="usuarioId"
        defaultValue={actual}
        onChange={() => form.current?.requestSubmit()}
        className="max-w-[16rem] rounded-lg border border-line-strong bg-surface-2 px-3 py-1.5 text-sm text-ink
                   focus:outline-2 focus:outline-accent focus:-outline-offset-1"
      >
        {usuarios.map((u) => (
          <option key={u.id} value={u.id}>
            {u.nombre}{detalle(u)}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="rounded-lg border border-line-strong px-2 py-1 text-xs">
          Cambiar
        </button>
      </noscript>
    </form>
  );
}
