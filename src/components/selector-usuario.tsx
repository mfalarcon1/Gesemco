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

/** Reemplaza al inicio de sesión mientras se prueba el sistema. */
export function SelectorUsuario({ usuarios, actual }: { usuarios: Opcion[]; actual: number }) {
  const form = useRef<HTMLFormElement>(null);

  return (
    <form ref={form} action={cambiarUsuario} className="flex min-w-0 items-center gap-2">
      <label htmlFor="usuarioId" className="whitespace-nowrap">
        Estás viendo el sistema como
      </label>
      <select
        id="usuarioId"
        name="usuarioId"
        defaultValue={actual}
        onChange={() => form.current?.requestSubmit()}
        className="min-h-9 min-w-0 max-w-[20rem] rounded-md border border-line-strong bg-surface px-2.5 py-1 text-sm text-ink"
      >
        {usuarios.map((u) => (
          <option key={u.id} value={u.id}>
            {u.nombre}{detalle(u)}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="rounded-md border border-line-strong px-2 py-1 text-sm">
          Cambiar
        </button>
      </noscript>
    </form>
  );
}
