# Presupuesto Escolar · GESEMCO

Sistema de gestión presupuestaria para los colegios que administra GESEMCO. Funciona en
dos etapas:

1. **Formulación** (septiembre a noviembre del año anterior). El año tiene tres periodos:
   marzo a mayo, junio a agosto y septiembre a diciembre. Cada jefe de departamento elige
   un periodo y arma los programas que hará en él, con los artículos que necesita (desde
   un catálogo con precios de tiendas) o con líneas libres para servicios; un programa que
   sigue en varios periodos se ingresa en cada uno. Dirección aprueba o devuelve el
   presupuesto; si lo aprueba, pasa a contabilidad, que lo aprueba o envía reparos. El jefe
   corrige los reparos y lo reenvía directo a contabilidad. Con lo aprobado salen tres
   órdenes de compra, una por periodo, del colegio completo y con el detalle de cada
   departamento.
2. **Ejecución.** El profesor solicita, el jefe emite la orden de compra y el equipo de
   compra compra. El saldo se controla contra el total anual del departamento, a precio
   presupuesto. Lo que no cabe queda como pendiente de pedido para Dirección.

**Estado:** la etapa 1 funciona completa. La etapa 2 ya está en la base de datos, con sus
reglas probadas; sus pantallas son lo siguiente.

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

Abre http://localhost:3000. Arriba a la derecha hay un selector para entrar como
distintas personas del colegio de prueba:

| Persona | Rol | Qué probar |
| --- | --- | --- |
| Camila Rojas | Jefa de Arte | Presupuesto 2027 en preparación, con programas en los tres periodos: agrega programas e ítems y envíalo |
| Rodrigo Tapia | Jefe de Matemática | Enviado, esperando a Dirección |
| Sebastián Vidal | Jefe de Ciencia | Devuelto por Dirección con comentario |
| Javier Contreras | Jefe de Historia | Con reparos de contabilidad: corrígelo y reenvíalo directo a contabilidad |
| Luis Pizarro | Jefe de Reproducción de imagen | En revisión de contabilidad (Dirección ya lo aprobó) |
| Verónica Soto | Jefa de Biblioteca | Aprobado: sus ítems están en las órdenes de compra |
| Andrés Bulnes | Dirección | Aprueba (pasa a contabilidad) o devuelve; ve los pendientes de pedido |
| Marcela Ovalle | Contabilidad GESEMCO | Aprueba o envía reparos; órdenes de compra 2027 por periodo y su CSV; ejecución 2026 |
| Ignacio Vera | Profesor de Matemática y Física | Ve el saldo de sus departamentos |

Sin pgAdmin a mano, `npm run db:reset` hace todo desde la consola. Si prefieres pgAdmin,
abre `db/esquema_gesemco.sql` en el Query Tool de la base `gesemco`, ejecútalo con F5 y
después haz lo mismo con `db/datos_prueba.sql`.

## Cómo está organizado

```
db/esquema_gesemco.sql     El modelo: tablas, vistas, triggers y reglas de negocio
db/datos_prueba.sql        Colegio Santa Úrsula con datos inventados: ejecución 2026 y formulación 2027
db/pruebas.sql             38 pruebas de las reglas (deshacen todo al terminar)
scripts/db.mjs             db:reset, db:test y db:pull, iguales en Windows y Linux
src/db/schema.ts           Tipos de TypeScript, GENERADOS desde la base (no editar)
src/lib/sesion.ts          Quién eres, tus roles y qué puedes ver
src/lib/acciones.ts        Piezas comunes de las acciones del servidor
src/lib/formulacion.ts     Consultas de la etapa 1: presupuestos, periodos y órdenes de compra
src/lib/periodos.ts        Los tres periodos del año (sin base: lo usan también componentes de cliente)
src/lib/catalogo.ts        Catálogo y precios de referencia
src/lib/consultas.ts       Saldos de la ejecución, avisos y pendientes
src/app/page.tsx           Inicio, distinto según el rol
src/app/formulacion/       Presupuesto por departamento, por periodo, y sus acciones
src/app/catalogo/          El catálogo tipo marketplace
src/app/ordenes-de-compra/ Las tres órdenes de compra del año para GESEMCO y su exportación a CSV
src/components/            Encabezado, avisos, pasos, ítems, campos y gráficos
```

## Cuando cambie el modelo de datos

El archivo `.sql` es la fuente de verdad, no el ORM:

1. Editas `db/esquema_gesemco.sql` (y `db/datos_prueba.sql` si hace falta).
2. `npm run db:reset` recrea la base.
3. `npm run db:test` confirma que las reglas siguen cumpliéndose.
4. `npm run db:pull` regenera `src/db/schema.ts` y `src/db/relations.ts`.

## Decisiones que conviene no deshacer sin pensarlo

- **Las reglas viven en la base.** Triggers y restricciones: qué se puede editar y cuándo,
  la regla del disponible, los pendientes de pedido. La app hace la operación y muestra el
  mensaje de la base. Así ninguna pantalla nueva se las puede saltar.
- **El saldo se calcula, no se guarda.** Sale de las vistas en cada consulta. Un campo
  `saldo` almacenado se desincroniza y después nadie sabe cuál número es el bueno.
- **Los montos son enteros, en pesos y con IVA.** El parser de `src/db/index.ts` convierte
  `bigint` y `numeric` a `number`.
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
  principal por pantalla y confirmación antes de borrar o aprobar. `CLAUDE.md` tiene las
  reglas y el vocabulario de la pantalla.

## Lo que sigue

1. Etapa 2: solicitud del profesor, bandeja del jefe, pendientes de Dirección, cola del
   equipo de compra y tablero de contabilidad con exportación a Excel. La compra de cada
   periodo es su orden más los extras aprobados hasta entonces.
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
