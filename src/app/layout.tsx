import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Presupuesto Escolar · GESEMCO',
  description: 'Gestión presupuestaria y órdenes de compra para los colegios administrados por GESEMCO',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        {/*
          Las fuentes se cargan por <link> y no con next/font/google a propósito:
          next/font las descarga durante el build, así que una red sin salida a
          fonts.googleapis.com (un pipeline de CI, la red del colegio) rompe el
          build entero. Así, si no cargan, la app se ve con la tipografía del
          sistema y sigue funcionando. Los fallbacks están en globals.css.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
