import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit no lee .env.local por su cuenta (Next sí). Así `npm run db:pull`
// usa la misma DATABASE_URL que la app sin exportarla a mano.
// process.loadEnvFile existe desde Node 20.12; en uno anterior, exporta DATABASE_URL a mano.
if (!process.env.DATABASE_URL && existsSync('.env.local') && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile('.env.local');
}

/**
 * El archivo db/esquema_gesemco.sql es la fuente de verdad del modelo.
 * Drizzle no genera el esquema: lo lee desde la base con `npm run db:pull`
 * y regenera src/db/schema.ts. Así los triggers, las vistas y las columnas
 * generadas siguen viviendo en PostgreSQL, que es donde corresponden.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './db/drizzle',
  dbCredentials: { url: process.env.DATABASE_URL! },
  verbose: true,
  strict: true,
});
