# Presupuesto Escolar · GESEMCO

Sistema de gestión presupuestaria y órdenes de compra para los colegios que administra
GESEMCO. El presupuesto se asigna por **asignatura**, el **departamento** (prebásica,
básica o media) aprueba el gasto de las suyas, y **contabilidad** consolida el colegio
completo.

Estado: Fase 1 en construcción. Funciona el dashboard de saldos leyendo de la base real,
con los cuatro roles.

## Requisitos

- **Node.js 20 o superior** — `node --version` en PowerShell. Si no lo tienes, instálalo
  desde nodejs.org (versión LTS).
- **PostgreSQL** corriendo en local, con la base `gesemco` creada.

## Puesta en marcha

```powershell
# 1. Dependencias
npm install

# 2. Base de datos: crea la base y carga el esquema
#    (desde pgAdmin: clic derecho en Databases -> Create -> Database... -> "gesemco",
#     luego abre db\esquema_gesemco.sql en el Query Tool de esa base y ejecuta con F5)

# 3. Variables de entorno
copy .env.example .env.local
#    Edita .env.local con tu usuario, contraseña y puerto reales de PostgreSQL.

# 4. Levantar
npm run dev
```

Abre http://localhost:3000. Arriba a la derecha hay un selector para cambiar con qué
usuario entras: Marcela Ovalle ve el colegio completo, Paula Sandoval solo el
departamento de Media, Ignacio Vera solo sus dos asignaturas.

Si la página dice "Sin datos todavía", te faltó correr la sección de datos de prueba del
`.sql`, que es la que crea el colegio y el año presupuestario 2026.

## Cómo está organizado

```
db/esquema_gesemco.sql   El modelo completo: 18 tablas, 3 vistas, 5 triggers, datos de prueba
src/db/schema.ts         Tipos de TypeScript, GENERADO desde la base (no editar a mano)
src/db/index.ts          Pool de conexiones y configuración de drizzle
src/lib/sesion.ts        Quién eres, qué rol tienes y qué alcance te corresponde
src/lib/consultas.ts     Consultas tipadas sobre las vistas de saldo
src/lib/formato.ts       Pesos chilenos, fechas, iniciales
src/app/page.tsx         El dashboard de saldos
src/components/          Barra de saldo, tarjetas de cifra, selector de usuario
```

## Cuando cambie el modelo de datos

El archivo `.sql` es la fuente de verdad, no el ORM. El ciclo es siempre el mismo:

1. Editas `db/esquema_gesemco.sql`.
2. Aplicas el cambio en la base (o recreas la base y corres el archivo completo).
3. `npm run db:pull` — drizzle lee la base y regenera `src/db/schema.ts`.

Así los triggers, las vistas y las columnas generadas siguen viviendo en PostgreSQL, que
es donde pueden garantizar de verdad las reglas. Nunca al revés: no escribas el esquema
en TypeScript esperando que drizzle genere el SQL.

## Decisiones que conviene no deshacer sin pensarlo

- **El saldo se calcula, no se guarda.** Sale de `vw_saldo_asignatura` en cada consulta.
  Un campo `saldo` almacenado se desincroniza y después nadie sabe cuál número es el bueno.
- **Los montos son enteros.** Pesos chilenos sin decimales. El parser de `src/db/index.ts`
  convierte `bigint` y `numeric` a `number` porque node-postgres los devuelve como string.
- **El login es provisorio.** El selector de usuario reemplaza la autenticación mientras
  construimos las pantallas. Cuando entre Auth.js, se borra `src/app/actions.ts` y se
  cambia `getSesion()`; el resto del código no se entera.
- **Las fuentes se cargan por `<link>`, no con `next/font/google`.** next/font las descarga
  durante el build, así que una red sin salida a Google Fonts rompe el build completo.

## Lo que sigue

1. Formulario de orden de compra con ítems y validación contra el disponible.
2. Bandeja de aprobación del jefe de departamento.
3. Solicitud y resolución de excepción por sobregiro.
4. Exportación del consolidado a Excel.
5. Autenticación real y bitácora visible.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build de producción |
| `npm run typecheck` | Revisa los tipos sin compilar |
| `npm run db:pull` | Regenera `src/db/schema.ts` desde la base |
| `npm run db:studio` | Explorador visual de la base en el navegador |
