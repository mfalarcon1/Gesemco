import { defineConfig } from 'drizzle-kit';

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
