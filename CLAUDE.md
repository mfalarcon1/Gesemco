# Contexto para Claude

Sistema de gestión presupuestaria escolar para GESEMCO (empresa contable que administra
unos 12 colegios). Desarrollador único, part-time. Todo el código, los comentarios, los
nombres de variables y la interfaz van en **español**.

## Regla número uno: el SQL manda

`db/esquema_gesemco.sql` es la fuente de verdad del modelo. `src/db/schema.ts` está
**generado** por `npm run db:pull` — nunca lo edites a mano, se sobrescribe.

Para cambiar el modelo: editas el `.sql`, lo aplicas en la base, corres `npm run db:pull`.
Nunca al revés.

Los arreglos que sobrevivan a un `db:pull` van en `src/lib/consultas.ts`, no en
`schema.ts`. Ejemplo vivo: el helper `num()` que convierte los `numeric` de las vistas.

## Modelo de dominio

```
Colegio → Departamento (prebásica | básica | media) → Asignatura → Profesor
```

- El **presupuesto vive en la asignatura**, una fila por asignatura y por año.
  El departamento aprueba y supervisa, pero no administra bolsa propia.
- "Matemática básica" y "Matemática media" son dos asignaturas distintas, cada una
  colgando de su departamento.
- **Disponible = asignado − comprometido − ejecutado**, siempre calculado desde
  `vw_saldo_asignatura`. Nunca guardes un campo `saldo`.
- Comprometido = órdenes `enviada` o `aprobada`. Ejecutado = `recepcionada` o `pagada`,
  al monto real de la recepción si existe.
- Una orden que excede el disponible no se rechaza: se manda como `excepcion` y la
  resuelve Dirección.

## Invariantes que ya están en la base, no las dupliques en la app

- Clave foránea compuesta `orden_compra (asignatura_id, anio_id) → presupuesto`.
- Trigger `fn_recalcular_total_orden`: el total de la orden es la suma de sus ítems.
- Trigger `fn_validar_saldo_orden`: valida el saldo al pasar a `enviada`.
- Trigger `fn_bloquear_anio_cerrado`: un año cerrado es inmutable.
- Trigger `fn_bitacora`: audita `orden_compra`, `presupuesto` y `solicitud_excepcion`.
- Orden correcto al crear una orden: `borrador` → insertar ítems → `enviada`.
  Si la creas directo en `enviada` el total es 0 y la validación pasa trivialmente.

## Convenciones

- Montos en **enteros** (pesos chilenos). El parser de `src/db/index.ts` convierte
  `bigint` y `numeric` a `number`; no uses `float` ni agregues decimales.
- Permisos por `rol_asignado` (rol + ámbito), nunca por nombre de persona.
  `getSesion()` resuelve el rol de mayor alcance y el `Alcance` correspondiente.
- Estilos con tokens de `src/app/globals.css` (`bg-surface`, `text-ink-2`, `border-line`,
  `text-accent`…). No metas colores literales: rompen el modo oscuro.
- El login es provisorio: selector de usuario por cookie. Cuando entre Auth.js solo
  cambia `getSesion()` y desaparece `src/app/actions.ts`.

## Antes de dar algo por terminado

`npm run typecheck` y `npm run build`. El build corre TypeScript en serio.
