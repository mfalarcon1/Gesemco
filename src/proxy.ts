import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Solo en la rama demo: una clave única para entrar a la demo publicada.
 * El navegador la pide una vez (autenticación básica) y la recuerda hasta
 * que se cierra. El usuario da lo mismo; lo que vale es la clave.
 *
 * Sin DEMO_CLAVE no se pide nada: en el computador la app abre como siempre.
 * No reemplaza al login: adentro sigue el selector de "Modo de prueba".
 */
export function proxy(request: NextRequest) {
  const clave = process.env.DEMO_CLAVE;
  if (!clave) return NextResponse.next();

  const encabezado = request.headers.get('authorization') ?? '';
  if (encabezado.startsWith('Basic ')) {
    const credenciales = Buffer.from(encabezado.slice(6), 'base64').toString('utf8');
    const escrita = credenciales.slice(credenciales.indexOf(':') + 1);
    if (iguales(escrita, clave)) return NextResponse.next();
  }

  return new NextResponse('Esta demo pide una clave.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Demo GESEMCO", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

/** Compara en tiempo constante: los dos hash miden siempre lo mismo. */
function iguales(a: string, b: string) {
  const hash = (x: string) => createHash('sha256').update(x).digest();
  return timingSafeEqual(hash(a), hash(b));
}

export const config = {
  // Los archivos estáticos de Next no pasan por acá; todo lo demás sí,
  // incluidas las acciones del servidor y las planillas.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
