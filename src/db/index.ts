import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, types } from 'pg';
import * as schema from './schema';
import * as relations from './relations';

/**
 * node-postgres devuelve bigint (int8) y numeric como string para no perder
 * precisión. Todos nuestros montos son pesos chilenos enteros, muy por debajo
 * del entero seguro de JavaScript, así que los convertimos a number una sola
 * vez acá en vez de andar haciendo Number(...) en cada consulta.
 *
 * Si algún día esto maneja una moneda con decimales, hay que sacar estas
 * dos líneas y tratar los montos como string o como Decimal.
 */
types.setTypeParser(types.builtins.INT8, (v) => Number(v));
types.setTypeParser(types.builtins.NUMERIC, (v) => Number(v));

// En desarrollo Next recarga los módulos en cada cambio. Sin esto, cada
// recarga abriría un pool nuevo hasta agotar las conexiones de PostgreSQL.
const globalForDb = globalThis as unknown as { __pool?: Pool };

const pool =
  globalForDb.__pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });

if (process.env.NODE_ENV !== 'production') globalForDb.__pool = pool;

export const db = drizzle(pool, { schema: { ...schema, ...relations } });
export * from './schema';
