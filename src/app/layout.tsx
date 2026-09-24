import type { Metadata } from 'next';
// Las fuentes viven en node_modules (paquetes @fontsource): no dependen de
// Google Fonts ni en el build ni en el navegador, así que la app se ve igual
// en la red del colegio, sin internet o detrás de un firewall.
import '@fontsource-variable/archivo';
import '@fontsource-variable/ibm-plex-sans';
import './globals.css';

export const metadata: Metadata = {
  title: 'Presupuesto Escolar · GESEMCO',
  description: 'Gestión presupuestaria y órdenes de compra para los colegios administrados por GESEMCO',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
