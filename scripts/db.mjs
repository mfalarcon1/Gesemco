/**
 * Tareas de base de datos, iguales en Windows, Mac y Linux (no necesitan
 * psql en el PATH):
 *
 *   npm run db:reset   Borra la base y la recrea: esquema + datos de prueba.
 *   npm run db:test    Corre db/pruebas.sql (deshace todo al final).
 *   npm run db:pull    Regenera src/db/schema.ts y src/db/relations.ts.
 *
 * Lee DATABASE_URL de .env.local, igual que la app.
 */
import { copyFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import pg from 'pg';

if (!process.env.DATABASE_URL && existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL. Copia .env.example a .env.local y complétalo.');
  process.exit(1);
}

const [comando, ...opciones] = process.argv.slice(2);

async function conectar({ mostrarAvisos = false } = {}) {
  const cliente = new pg.Client({ connectionString: url });
  if (mostrarAvisos) cliente.on('notice', (aviso) => console.log(aviso.message));
  await cliente.connect();
  return cliente;
}

const leer = (archivo) => readFileSync(path.join('db', archivo), 'utf8');

async function reset() {
  // db:reset borra todo. Solo contra una base local, salvo que se fuerce.
  const { hostname } = new URL(url);
  if (!['localhost', '127.0.0.1', '::1'].includes(hostname) && !opciones.includes('--forzar')) {
    console.error(`db:reset borra la base completa y DATABASE_URL apunta a "${hostname}".`);
    console.error('Si de verdad quieres hacerlo: npm run db:reset -- --forzar');
    process.exit(1);
  }

  const cliente = await conectar();
  try {
    await cliente.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await cliente.query(leer('esquema_gesemco.sql'));
    await cliente.query(leer('datos_prueba.sql'));
    console.log('Base recreada: esquema y datos de prueba cargados.');
  } finally {
    await cliente.end();
  }
}

async function test() {
  const cliente = await conectar({ mostrarAvisos: true });
  try {
    await cliente.query(leer('pruebas.sql'));
  } finally {
    await cliente.end();
  }
}

function pull() {
  // drizzle-kit escribe en db/drizzle junto con archivos de migración que
  // no usamos (el .sql es la fuente de verdad). Nos quedamos con los dos
  // archivos de tipos y borramos el resto.
  const bin = path.join('node_modules', 'drizzle-kit', 'bin.cjs');
  const r = spawnSync(process.execPath, [bin, 'pull'], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);

  for (const archivo of ['schema.ts', 'relations.ts']) {
    copyFileSync(path.join('db', 'drizzle', archivo), path.join('src', 'db', archivo));
  }
  rmSync(path.join('db', 'drizzle'), { recursive: true, force: true });
  console.log('Listo: src/db/schema.ts y src/db/relations.ts regenerados desde la base.');
}

try {
  if (comando === 'reset') await reset();
  else if (comando === 'test') await test();
  else if (comando === 'pull') pull();
  else {
    console.error('Uso: node scripts/db.mjs reset | test | pull');
    process.exit(1);
  }
} catch (error) {
  console.error(`\n${error.message}`);
  if (error.where) console.error(error.where);
  process.exit(1);
}
