# Contexto para Claude

Sistema de gestión presupuestaria escolar para GESEMCO (empresa contable que administra
unos 12 colegios; la v1 es para un colegio). Desarrollador único, part-time. Todo el
código, los comentarios, los nombres de variables y la interfaz van en **español**.

## Regla número uno: el SQL manda

`db/esquema_gesemco.sql` es la fuente de verdad del modelo. `src/db/schema.ts` y
`src/db/relations.ts` están **generados** por `npm run db:pull`: nunca los edites a mano,
se sobrescriben.

Para cambiar el modelo: editas el `.sql`, `npm run db:reset` (recrea la base con esquema
y datos de prueba), `npm run db:test`, `npm run db:pull`. Nunca al revés.

Los arreglos que sobrevivan a un `db:pull` van en `src/lib/`, no en `schema.ts`. Ejemplo
vivo: el helper `num()` de `src/lib/consultas.ts`, que convierte los `numeric` de las vistas.

## Modelo de dominio

```
Colegio → Departamento (por área, con jefe) → presupuesto anual → Programa (en un periodo) → Línea (artículo × cantidad × precio)
```

Departamentos: formación, matemática, física, historia, inglés, lenguaje, biblioteca,
reproducción de imagen, alemán, arte, ciencia, pastoral, apoyo al aprendizaje.

Roles (`rol_asignado`): profesor y jefe_departamento van con departamento; direccion,
contabilidad (GESEMCO), equipo_compra y administrador valen para todo el colegio. Un
profesor puede estar en varios departamentos; un jefe también puede hacer clases.

Cada año pasa por `formulacion → ejecucion → cerrado`. Conviven dos: se ejecuta un año
mientras se formula el siguiente (la sesión trae `anioFormulacion` y `anioEjecucion`).

**Etapa 1 — formulación (construida)**
- Se formula entre septiembre y noviembre del año anterior (`anio_presupuestario.formulacion_hasta`,
  solo informativo: no bloquea nada).
- El año tiene tres periodos (tabla `periodo`): 1 marzo–mayo, 2 junio–agosto, 3
  septiembre–diciembre. Cada programa va en un periodo; uno que sigue en varios se ingresa
  en cada uno, con lo que necesita ahí. No hay desglose mensual.
- El jefe arma programas con líneas del catálogo (precio = mediana de las ofertas
  vigentes, congelado en la línea) o líneas libres (fuera de catálogo).
- `presupuesto_departamento`: borrador → enviado → revision_contabilidad → aprobado.
  Dirección puede devolverlo (devuelto → enviado) y el jefe retirar el envío (→ borrador).
  Contabilidad puede enviar reparos (con_reparos): el jefe corrige y lo reenvía **directo
  a contabilidad**, sin pasar otra vez por Dirección. La negociación con Dirección es en
  reunión, fuera del sistema.
- La aprobación de contabilidad congela `monto_aprobado`. Lo aprobado arma las **órdenes de
  compra de cada periodo** (`vw_orden_periodo`): tres al año, del colegio completo, con el
  detalle de cada departamento. No son filas de `orden_compra`: esa es la orden de la
  etapa 2, que emite el jefe.

**Etapa 2 — ejecución (en la base, sin pantallas todavía)**
- Profesor → `solicitud_compra` → jefe emite `orden_compra` → `equipo_compra` compra
  (`compra`, monto real) → `recepcion`.
- El disponible se controla contra el **total anual del departamento**, siempre a
  **precio presupuesto**. El monto real solo alimenta la desviación que ve contabilidad.
- La app pide `estado = 'emitida'` y la base decide: si cabe, queda emitida; si no, queda
  `pendiente_direccion` y se crea el `pendiente_pedido`. Dirección lo resuelve con
  `fn_resolver_pendiente(id, aprobar, explicacion)`: aprobar suma una
  `modificacion_presupuestaria` por lo que falte y emite; denegar exige explicación y
  avisa al jefe.
- Ítems sin línea del presupuesto quedan `no_planificado`. Una sola bolsa por colegio.
- Pendiente para cuando se construyan sus pantallas: en cada periodo se compra la orden
  de ese periodo **más** los extras que pidieron los jefes y que se aprobaron hasta
  entonces. El disponible sigue siendo el total del año.

## Invariantes que viven en la base: no las dupliques en la app

- `fn_guardia_anio_cerrado` (triggers `trg_a_…`): un año cerrado no admite cambios.
- `fn_guardia_presupuesto_editable`: programas y líneas solo cambian en borrador, devuelto
  o con reparos.
- `fn_transicion_presupuesto`: transiciones válidas, no enviar vacío (tampoco al reenviar
  tras reparos), fechas de cada revisión, congelar el aprobado.
- `fn_avisar_presupuesto`: los avisos de cada paso (a Dirección, a contabilidad, al jefe).
- `fn_transicion_orden` + `fn_efectos_orden`: la regla del disponible, el pendiente de
  pedido y los avisos. Una orden nace en borrador; sus ítems solo cambian en borrador.
- `fn_bitacora` (triggers `trg_z_…`): auditoría de todo lo que cambia de estado.
- Saldos, montos por periodo, órdenes de compra y catálogo salen de vistas (`vw_…`).
  **Nunca guardes un saldo.**

Los triggers del mismo evento corren en orden alfabético: guardias `trg_a_`/`trg_b_`,
efectos `trg_z_`.

## Convenciones

- Montos en **enteros**, pesos chilenos **con IVA**. El parser de `src/db/index.ts` convierte
  `bigint` y `numeric` a `number`; no uses `float`.
- Quién actúa: toda escritura pasa por `comoUsuario(sesion, tx => …)` de `src/lib/acciones.ts`,
  que hace `set_config('app.usuario_id', …)`. Sin eso la bitácora queda sin autor.
- Acciones del servidor: `exigirSesion()` + permiso del rol con `exigir(...)`, trabajo en
  `comoUsuario`, y `responder(ruta, …)` vuelve con `?ok=` o `?error=`. Los mensajes de los
  `RAISE EXCEPTION` ya están escritos para el usuario y se muestran tal cual; para
  restricciones con nombre técnico, agrega el texto en `POR_RESTRICCION`.
- La base decide qué transición es válida; la app, quién la hace. A revisión de contabilidad
  se llega por dos caminos de roles distintos (Dirección aprueba lo enviado; el jefe reenvía
  lo que tenía reparos): `cambiarEstado(..., desde)` exige el estado de partida.
- Permisos por `rol_asignado`, nunca por nombre de persona. Helpers en `src/lib/sesion.ts`
  (`esJefeDe`, `esDireccion`, `puedeVerDepartamento`…). Se consultan en la página y se
  vuelven a exigir en la acción.
- Estilos con tokens de `src/app/globals.css` y clases de `src/components/ui.ts`. No metas
  colores literales: rompen el modo oscuro.
- Gráficos: `--dato` / `--dato-2` son una rampa ordinal validada en claro y oscuro. Los
  colores `ok`, `warn` y `bad` son de **estado**: nunca para una serie, y siempre con ícono
  y texto. Cada gráfico tiene su tabla con los mismos valores.
- El login es provisorio: selector de usuario por cookie ("Modo de prueba" arriba de todo).
  Cuando entre Auth.js solo cambia `getSesion()` y desaparece `src/app/actions.ts`.
- Resultado de las acciones (`responder`): si sale bien, redirige con `?ok=` y un `#ancla`
  (la fila o el programa que se tocó); la página se vuelve a montar y los formularios se
  cierran. Si sale mal, no cambia de dirección: el error viaja en la cookie `gesemco_error`
  y la página se redibuja en el mismo lugar, con los formularios abiertos y lo escrito.
  `<Aviso>` muestra ambos flotando bajo el encabezado.
- Los componentes de cliente (`'use client'`) no pueden importar nada que toque `@/db`
  (el build falla): los estados del presupuesto están en `src/lib/estados.ts` por eso.

## Diseño de la interfaz

Algunos jefes de departamento usan poco el computador. Por eso:

- Texto base de 16px y nunca menos de 13px. Botones de al menos 44px de alto: usa las
  clases de `boton` en `ui.ts`. Una acción principal por pantalla.
- Cada pantalla dice qué hacer ahora: `Pasos` muestra las tres etapas del presupuesto
  (armar, revisión de Dirección, revisión de contabilidad: `pasosDe` en `src/lib/etapas.ts`)
  y debajo va una tarjeta con la acción que toca.
- Lo que no se deshace pregunta antes (`BotonConConfirmacion`): quitar un ítem, eliminar
  un programa, aprobar un presupuesto (Dirección y contabilidad).
- Los estados van en palabras, no solo en color: píldoras con ícono y texto.
- Vocabulario de la pantalla (el código y la base siguen con sus nombres):
  | En la base | En la pantalla |
  | --- | --- |
  | línea | ítem |
  | línea libre, `fuera_catalogo` | ítem agregado a mano, "Fuera del catálogo" |
  | formulado | total (o "total pedido") |
  | mediana de las ofertas | precio del medio |
  | `revision_contabilidad`, `con_reparos` | En revisión de contabilidad, Con reparos |
  | `vw_orden_periodo` | orden de compra del periodo |
- Montos que escribe una persona: `CampoPesos` (separador de miles mientras tipea).
  Cantidades con botones − y +: `CampoCantidad`.
- El presupuesto se ve por periodo: un resumen con el total de cada uno y una sección por
  periodo con sus programas. Al crear un programa se sugieren los que el departamento ya
  tiene en otros periodos, para no tipearlos de nuevo.
- En celular las listas de ítems son tarjetas y las tablas largas van dentro de un
  contenedor con scroll (con `relative` si llevan texto `sr-only`, que es absoluto).
- Las fuentes vienen de `@fontsource-variable` (Archivo e IBM Plex Sans), empaquetadas
  con la app: no dependen de internet.

## Antes de dar algo por terminado

`npm run db:test`, `npm run typecheck`, `npm run lint` y `npm run build`.
