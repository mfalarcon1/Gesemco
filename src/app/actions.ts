'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { COOKIE_USUARIO } from '@/lib/sesion';

/**
 * Cambia con qué usuario estás viendo el sistema. Reemplaza al login
 * mientras construimos la Fase 1; cuando entre Auth.js, esta acción
 * se borra y el resto del código no se entera.
 */
export async function cambiarUsuario(formData: FormData) {
  const id = Number(formData.get('usuarioId'));
  if (!Number.isInteger(id) || id <= 0) return;

  const store = await cookies();
  store.set(COOKIE_USUARIO, String(id), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath('/');
}
