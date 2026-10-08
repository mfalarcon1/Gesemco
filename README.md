# Presupuesto Escolar · GESEMCO

Sistema de gestión presupuestaria para los colegios que administra GESEMCO. Funciona en
dos etapas:

1. **Formulación** (octubre del año anterior para armarlo, noviembre para aprobarlo). Cada
   jefe de departamento arma los programas que hará el año siguiente, con los artículos que
   necesita (desde un catálogo con precios de tiendas) o con ítems a mano para servicios, e
   indica cuántas unidades de cada ítem usará en cada mes. Sin los meses de todos sus ítems
   no se puede enviar. Dirección aprueba o devuelve el presupuesto; si lo aprueba, pasa a
   contabilidad, que lo aprueba o envía reparos. El jefe corrige los reparos y lo reenvía
   directo a contabilidad. Con lo aprobado, GESEMCO sabe cuánto dinero necesitará cada mes.
2. **Ejecución.** Los profesores no usan el sistema: el jefe pide lo que necesita al lado
   de cada ítem de su presupuesto, o algo que no estaba, siempre con la fecha en que lo
   necesita (al menos una semana después). Si cabe en lo que le queda del año, el pedido
   pasa a orden de compra y se descuenta a precio presupuesto; si no, va a Dirección como
   solicitud para extender el presupuesto. El equipo de compra compra primero lo que se
   necesita antes y anota lo que pagó; el jefe confirma cuando llega. Los meses son una
   guía: lo que se controla es el total del año.

**Estado:** las dos etapas funcionan completas.

## La demo en línea (rama `demo`)

Esta rama es la que se publica para que el cliente pruebe: la app en Vercel y la base en
Neon. Lo único que la distingue de `main` es una clave para entrar (`src/proxy.ts`), que se
activa solo si existe la variable `DEMO_CLAVE`. Adentro siguen el selector de "Modo de
prueba" y los datos inventados. El desarrollo de la versión final va en `main`.

Variables en Vercel: `DATABASE_URL` (la URL de Neon con pooling, la que dice `-pooler`) y
`DEMO_CLAVE`. En Vercel la rama de producción es `demo` y el *Ignored Build Step* salta las
demás ramas, así que lo que subas a `main` no se publica.

Cargar o reiniciar la base de la demo (borra lo que hayan probado):

```powershell
$env:DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require"   # la URL directa, sin -pooler
node scripts/db.mjs reset --forzar   # sin npm: PowerShell a veces se come el "--"
Remove-Item Env:DATABASE_URL    # para que lo siguiente vuelva a usar tu base local
```

Llevar a la demo un arreglo hecho en `main`: `git switch demo`, `git cherry-pick <commit>`
y `git push`. Cuando quieras mostrar la versión nueva completa: `git merge main`.

## Requisitos

- **Node.js 20.12 o superior**: `node --version` en PowerShell. Si no lo tienes o es más
  antiguo, instala la versión LTS desde nodejs.org.
- **PostgreSQL 15 o superior** corriendo en local, con una base vacía llamada `gesemco`.
  En pgAdmin: clic derecho en Databases → Create → Database… → `gesemco`.

## Puesta en marcha

```powershell
# 1. Dependencias
npm install

# 2. Variables de entorno
copy .env.example .env.local
#    Edita .env.local con tu usuario, contraseña y puerto reales de PostgreSQL.

# 3. Base de datos: carga el esquema y los datos de prueba (borra lo que haya)
npm run db:reset

# 4. Comprueba que las reglas de negocio se cumplen
npm run db:test

# 5. Levantar
npm run dev
```

Abre http://localhost:3000. Arriba hay un selector para entrar como distintas personas del
colegio de prueba, que está al 8 de octubre de 2026: ejecutando el presupuesto 2026 y
formulando el 2027.

| Persona | Rol | Qué probar |
| --- | --- | --- |
| Camila Rojas | Jefa de Arte | 2027 en preparación con todos sus meses (el ejemplo de las presentaciones): agrega ítems, indica sus meses y envíalo. En «Pedidos 2026»: pide el montaje (no cabe y va a Dirección), algo fuera del presupuesto, confirma la cartulina que llegó |
| Daniela Fuentes | Jefa de Inglés | 2027 con un ítem sin meses: no se puede enviar hasta indicarlos |
| Rodrigo Tapia | Jefe de Matemática | 2027 enviado, esperando a Dirección |
| Sebastián Vidal | Jefe de Ciencia | 2027 devuelto por Dirección; en 2026, un pedido esperando a Dirección |
| Javier Contreras | Jefe de Historia | 2027 con reparos de contabilidad: corrígelo y reenvíalo directo a contabilidad |
| Luis Pizarro | Jefe de Reproducción de imagen | 2027 en revisión de contabilidad |
| Verónica Soto | Jefa de Biblioteca | 2027 aprobado; en 2026, un pedido que Dirección denegó |
| Andrés Bulnes | Dirección | Aprueba o devuelve presupuestos; resuelve las solicitudes para extender un presupuesto |
| Marcela Ovalle | Contabilidad GESEMCO | Aprueba o envía reparos; proyección mensual 2027 y su CSV; ejecución 2026 y sus planillas |
| Tomás Ríos | Equipo de compra | La cola de compras por fecha; registra lo que pagó |

Sin pgAdmin a mano, `npm run db:reset` hace todo desde la consola. Si prefieres pgAdmin,
abre `db/esquema_gesemco.sql` en el Query Tool de la base `gesemco`, ejecútalo con F5 y
después haz lo mismo con `db/datos_prueba.sql`.

## Cómo está organizado

```
db/esquema_gesemco.sql      El modelo: tablas, vistas, triggers y reglas de negocio
db/datos_prueba.sql         Colegio Santa Úrsula con datos inventados: ejecución 2026 y formulación 2027
db/pruebas.sql              49 pruebas de las reglas (deshacen todo al terminar)
scripts/db.mjs              db:reset, db:test y db:pull, iguales en Windows y Linux
src/db/schema.ts            Tipos de TypeScript, GENERADOS desde la base (no editar)
src/lib/sesion.ts           Quién eres, tus roles y qué puedes ver
src/lib/acciones.ts         Piezas comunes de las acciones del servidor
src/lib/formulacion.ts      Etapa 1: presupuestos, ítems con sus meses, mes a mes y proyección
src/lib/ejecucion.ts        Etapa 2: pedidos, lo que se propone pedir, solicitudes y mes a mes
src/lib/estados.ts          Estados del presupuesto y de los pedidos (sin base: también para el navegador)
src/lib/catalogo.ts         Catálogo y precios de referencia
src/lib/consultas.ts        Saldos de la ejecución y avisos
src/lib/csv.ts              Planillas para Excel
src/app/page.tsx            Inicio, distinto según el rol
src/app/formulacion/        Presupuesto por departamento, la grilla de meses y sus acciones
src/app/proyeccion/         Lo aprobado, mes a mes, para GESEMCO, y su CSV
src/app/ejecucion/          Pedidos de cada departamento, la ejecución del colegio, sus planillas y las acciones de la etapa 2
src/app/solicitudes/        Lo que espera a Dirección
src/app/compras/            La cola del equipo de compra
src/app/catalogo/           El catálogo tipo marketplace
src/components/             Encabezado, avisos, pasos, ítems, pedidos, campos y gráficos
```

## Cuando cambie el modelo de datos

El archivo `.sql` es la fuente de verdad, no el ORM:

1. Editas `db/esquema_gesemco.sql` (y `db/datos_prueba.sql` si hace falta).
2. `npm run db:reset` recrea la base.
3. `npm run db:test` confirma que las reglas siguen cumpliéndose.
4. `npm run db:pull` regenera `src/db/schema.ts` y `src/db/relations.ts`.

## Decisiones que conviene no deshacer sin pensarlo

- **Las reglas viven en la base.** Triggers y restricciones: qué se puede editar y cuándo,
  que no se envíe sin meses, la anticipación de los pedidos, la regla del disponible, las
  solicitudes a Dirección, que lo comprado y lo recibido solo lo marquen la compra y la
  recepción. La app hace la operación y muestra el mensaje de la base. Así ninguna pantalla
  nueva se las puede saltar.
- **El saldo se calcula, no se guarda.** Sale de las vistas en cada consulta. Un campo
  `saldo` almacenado se desincroniza y después nadie sabe cuál número es el bueno.
- **Se controla el total del año, no cada ítem ni cada mes.** Se puede pedir cualquier
  cantidad de un ítem, o algo que no estaba; los meses son información para la caja de
  GESEMCO.
- **Los montos son enteros, en pesos y con IVA.** El parser de `src/db/index.ts` convierte
  `bigint` y `numeric` a `number`. Lo pedido descuenta a precio presupuesto; lo pagado de
  verdad solo alimenta la desviación.
- **El precio de una línea se congela al agregarla.** Si el catálogo cambia después, el
  presupuesto aprobado no se mueve.
- **Dos revisiones, en orden.** Primero Dirección, después contabilidad. Los reparos de
  contabilidad vuelven directo a ella: Dirección ya aprobó y no se le pide de nuevo.
- **El login es provisorio.** El selector de usuario reemplaza la autenticación mientras
  construimos. Cuando entre Auth.js, se borra `src/app/actions.ts` y se cambia
  `getSesion()`; el resto del código no se entera.
- **Las fuentes vienen en paquetes `@fontsource-variable`**, dentro de `node_modules`: la
  app no depende de Google Fonts ni para compilar ni para verse bien en la red del colegio.
- **Pensada para quien usa poco el computador.** Texto grande, botones grandes, una acción
  principal por pantalla y confirmación antes de borrar, anular o aprobar. `CLAUDE.md` tiene
  las reglas y el vocabulario de la pantalla.

## Lo que sigue

1. Lo que falta definir con GESEMCO: el plan de cuentas y los centros de costo reales, si
   una orden se compra en partes, si Dirección puede reabrir o recortar un presupuesto
   aprobado y con qué correo se avisa.
2. Scraper de precios (Dimeiggs, Lápiz López, Librería Nacional, LABdeCiencias) e
   histórico de referencia desde las órdenes públicas de Mercado Público.
3. Autenticación real y avisos por correo.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build de producción |
| `npm run typecheck` | Revisa los tipos sin compilar |
| `npm run lint` | Revisa el estilo del código |
| `npm run db:reset` | Borra la base y carga esquema + datos de prueba (solo en local) |
| `npm run db:test` | Corre las pruebas de las reglas de negocio |
| `npm run db:pull` | Regenera `src/db/schema.ts` desde la base |
| `npm run db:studio` | Explorador visual de la base en el navegador |
