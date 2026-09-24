# Presupuesto Escolar · GESEMCO

Sistema de gestión presupuestaria para los colegios que administra GESEMCO. Funciona en
dos etapas:

1. **Formulación.** Cada jefe de departamento arma los programas que hará el próximo
   año, con los artículos que necesita (desde un catálogo con precios de tiendas) o con
   líneas libres para servicios. Dirección aprueba o devuelve cada presupuesto, y con el
   presupuesto aprobado el jefe asigna los meses: así GESEMCO recibe cuánta caja se
   necesita cada mes.
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
| Camila Rojas | Jefa de Arte | Presupuesto 2027 en preparación: crea programas, agrega del catálogo, envíalo |
| Rodrigo Tapia | Jefe de Matemática | Presupuesto enviado, esperando a Dirección |
| Sebastián Vidal | Jefe de Ciencia | Presupuesto devuelto con comentario |
| Luis Pizarro | Jefe de Reproducción de imagen | Presupuesto aprobado, con los meses asignados |
| Andrés Bulnes | Dirección | Aprueba o devuelve; ve los pendientes de pedido |
| Marcela Ovalle | Contabilidad GESEMCO | Ejecución 2026, proyección mensual 2027 y su CSV |
| Ignacio Vera | Profesor de Matemática y Física | Ve el saldo de sus departamentos |

Sin pgAdmin a mano, `npm run db:reset` hace todo desde la consola. Si prefieres pgAdmin,
abre `db/esquema_gesemco.sql` en el Query Tool de la base `gesemco`, ejecútalo con F5 y
después haz lo mismo con `db/datos_prueba.sql`.

## Cómo está organizado

```
db/esquema_gesemco.sql     El modelo: tablas, vistas, triggers y reglas de negocio
db/datos_prueba.sql        Colegio Santa Úrsula con datos inventados: ejecución 2026 y formulación 2027
db/pruebas.sql             35 pruebas de las reglas (deshacen todo al terminar)
scripts/db.mjs             db:reset, db:test y db:pull, iguales en Windows y Linux
src/db/schema.ts           Tipos de TypeScript, GENERADOS desde la base (no editar)
src/lib/sesion.ts          Quién eres, tus roles y qué puedes ver
src/lib/acciones.ts        Piezas comunes de las acciones del servidor
src/lib/formulacion.ts     Consultas de la etapa 1
src/lib/catalogo.ts        Catálogo y precios de referencia
src/lib/consultas.ts       Saldos de la ejecución, avisos y pendientes
src/app/page.tsx           Inicio, distinto según el rol
src/app/formulacion/       Presupuesto por departamento y sus acciones
src/app/catalogo/          El catálogo tipo marketplace
src/app/proyeccion/        Proyección mensual para GESEMCO y su exportación a CSV
src/components/            Encabezado, gráfico mensual, barra de saldo, avisos
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
- **El login es provisorio.** El selector de usuario reemplaza la autenticación mientras
  construimos. Cuando entre Auth.js, se borra `src/app/actions.ts` y se cambia
  `getSesion()`; el resto del código no se entera.
- **Las fuentes se cargan por `<link>`, no con `next/font/google`.** next/font las descarga
  durante el build, así que una red sin salida a Google Fonts rompe el build completo.

## Lo que sigue

1. Etapa 2: solicitud del profesor, bandeja del jefe, pendientes de Dirección, cola del
   equipo de compra y tablero de contabilidad con exportación a Excel.
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
