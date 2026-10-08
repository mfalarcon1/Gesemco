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
Colegio → Departamento (por área, con jefe) → presupuesto anual → Programa → Línea (artículo × cantidad × precio) → sus meses
```

Departamentos: formación, matemática, física, historia, inglés, lenguaje, biblioteca,
reproducción de imagen, alemán, arte, ciencia, pastoral, apoyo al aprendizaje.

Roles (`rol_asignado`): jefe_departamento va con su departamento; direccion, contabilidad
(GESEMCO), equipo_compra y administrador valen para todo el colegio. **No hay profesores**:
lo que necesita un departamento lo pide su jefe.

Cada año pasa por `formulacion → ejecucion → cerrado`. Conviven dos: se ejecuta un año
mientras se formula el siguiente (la sesión trae `anioFormulacion` y `anioEjecucion`).

**Etapa 1 — formulación**
- Octubre del año anterior para armarlo (`anio_presupuestario.formulacion_hasta`) y
  noviembre para aprobarlo (`aprobacion_hasta`). Solo informativos: no bloquean nada.
- El jefe arma programas con líneas del catálogo (precio = mediana de las ofertas
  vigentes, congelado en la línea) o líneas libres (fuera de catálogo), e indica cuántas
  unidades de cada línea usará en cada mes (`linea_calendario`, en la grilla de meses).
  Los meses no pueden sumar más que la línea, y **para enviar, todas las unidades deben
  tener su mes** (también al reenviar tras reparos). Si cambia la cantidad de una línea
  que va en un solo mes, el mes la sigue; si va repartida y baja de lo repartido, el
  reparto se borra y se indica de nuevo.
- `presupuesto_departamento`: borrador → enviado → revision_contabilidad → aprobado.
  Dirección puede devolverlo (devuelto → enviado) y el jefe retirar el envío (→ borrador).
  Contabilidad puede enviar reparos (con_reparos): el jefe corrige y lo reenvía **directo
  a contabilidad**, sin pasar otra vez por Dirección. La negociación con Dirección es en
  reunión, fuera del sistema.
- La aprobación de contabilidad congela `monto_aprobado`. Lo aprobado, mes a mes
  (`vw_mes_departamento.planificado`), es la proyección de caja de GESEMCO (`/proyeccion`).

**Etapa 2 — ejecución**
- El jefe pide (`orden_compra` + `item_orden`) al lado de cada ítem de su presupuesto, en
  cualquier cantidad, o algo que no estaba (`no_planificado`). Todo pedido lleva
  `necesaria_para`: al menos `colegio.anticipacion_dias` (7) después del día del pedido
  (`creado_en`) y dentro del año del presupuesto.
- La app crea el pedido en borrador, carga el ítem y pide `estado = 'emitida'`; la base
  decide: si cabe en el disponible del departamento, queda emitida (orden de compra, por
  comprar); si no, queda `pendiente_direccion` y se crea el `pendiente_pedido` (la
  solicitud para extender el presupuesto). Dirección la resuelve con
  `fn_resolver_pendiente(id, aprobar, explicacion)`: aprobar suma una
  `modificacion_presupuestaria` por lo que falte y emite; denegar exige explicación y
  avisa al jefe. El jefe puede anular lo que está por comprar o retirar lo que espera a
  Dirección (queda `retirado`).
- El equipo de compra ve lo emitido ordenado por `necesaria_para` y registra la `compra`
  (monto real): eso marca el pedido comprado. El jefe confirma la `recepcion`: eso lo marca
  recibido. Comprado y recibido **no se marcan a mano**.
- El disponible se controla contra el **total anual del departamento**, siempre a **precio
  presupuesto**. Pedir más o menos en un mes no importa: los meses son una guía para la
  caja. El monto real solo alimenta la desviación que ve contabilidad.

## Invariantes que viven en la base: no las dupliques en la app

- `fn_guardia_anio_cerrado` (triggers `trg_a_…`): un año cerrado no admite cambios.
- `fn_guardia_presupuesto_editable`: programas, líneas y sus meses solo cambian en
  borrador, devuelto o con reparos.
- `fn_calendario_cuadra` y `fn_ajustar_calendario`: los meses de una línea no pasan su
  cantidad, y se ajustan cuando la cantidad cambia.
- `fn_transicion_presupuesto`: transiciones válidas, no enviar vacío ni con ítems sin meses
  (tampoco al reenviar tras reparos), fechas de cada revisión, congelar el aprobado.
- `fn_avisar_presupuesto`: los avisos de cada paso (a Dirección, a contabilidad, al jefe).
- `fn_transicion_orden` + `fn_efectos_orden`: la fecha del pedido, la regla del
  disponible, la solicitud a Dirección, que comprado y recibido vengan de la compra y la
  recepción (`fn_marcar_orden`), y los avisos (al equipo de compra, a Dirección, al jefe).
  Un pedido nace en borrador; sus ítems solo cambian en borrador y solo pueden ser líneas
  de su propio presupuesto.
- `fn_bitacora` (triggers `trg_z_…`): auditoría de todo lo que cambia de estado.
- Saldos, mes a mes, lo pedido de cada línea, los pedidos con su historia y el catálogo
  salen de vistas (`vw_…`). **Nunca guardes un saldo.**

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
  (`esJefeDe`, `esDireccion`, `esEquipoCompra`, `veEjecucionDe`, `veGastoReal`…). Se
  consultan en la página y se vuelven a exigir en la acción.
- Fechas: las del colegio son las de Chile (`hoyEnChile`, `diaEnChile` en `src/lib/formato.ts`),
  aunque el servidor o la base estén en UTC. La base usa `America/Santiago` para la
  anticipación de los pedidos.
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
  (el build falla): los estados del presupuesto y de los pedidos están en
  `src/lib/estados.ts` por eso.
- Planillas: `respuestaCsv` de `src/lib/csv.ts` (punto y coma, BOM, sin fórmulas en los
  textos que escriben personas).

## Diseño de la interfaz

Algunos jefes de departamento usan poco el computador. Por eso:

- Texto base de 16px y nunca menos de 13px. Botones de al menos 44px de alto: usa las
  clases de `boton` en `ui.ts`. Una acción principal por pantalla.
- Cada pantalla dice qué hacer ahora: `Pasos` muestra las tres etapas del presupuesto
  (armar, revisión de Dirección, revisión de contabilidad: `pasosDe` en `src/lib/etapas.ts`)
  y debajo va una tarjeta con la acción que toca. Con ítems sin meses, la acción es
  "Indicar los meses", no "Enviar".
- Lo que no se deshace pregunta antes (`BotonConConfirmacion`): quitar un ítem, eliminar
  un programa, aprobar un presupuesto o una solicitud, anular o retirar un pedido.
- Los estados van en palabras, no solo en color: píldoras con ícono y texto.
- Vocabulario de la pantalla (el código y la base siguen con sus nombres):
  | En la base | En la pantalla |
  | --- | --- |
  | línea | ítem |
  | línea libre, `fuera_catalogo` | ítem agregado a mano, "Fuera del catálogo" |
  | formulado | total (o "total pedido") |
  | mediana de las ofertas | precio del medio |
  | `revision_contabilidad`, `con_reparos` | En revisión de contabilidad, Con reparos |
  | `linea_calendario` | los meses del ítem |
  | `orden_compra` | pedido (y orden de compra cuando pasa a compra) |
  | `emitida`, `pendiente_direccion` | Por comprar, Esperando a Dirección |
  | `pendiente_pedido` | solicitud para extender el presupuesto |
  | `modificacion_presupuestaria` (de una solicitud) | extensión de Dirección |
  | comprometido, ejecutado | por comprar, comprado |
  | disponible | lo que te queda (para el jefe) |
  | `no_planificado` | "Fuera del presupuesto" |
- Montos que escribe una persona: `CampoPesos` (separador de miles mientras tipea).
  Cantidades con botones − y +: `CampoCantidad`.
- Cada ítem muestra sus meses en una frase ("30 en abril, 15 en junio y 5 en octubre") y
  avisa si le faltan; los meses se indican en la grilla (`GrillaMeses`), todos juntos.
- Al pedir, el formulario propone la cantidad del próximo mes planificado que falta pedir
  (`sugerir` en `src/lib/ejecucion.ts`), pide la fecha con el mínimo ya puesto y dice
  mientras se escribe si cabe en lo que queda. La decisión final es de la base.
- En celular las listas de ítems son tarjetas y las tablas largas van dentro de un
  contenedor con scroll (con `relative` si llevan texto `sr-only`, que es absoluto).
- Las fuentes vienen de `@fontsource-variable` (Archivo e IBM Plex Sans), empaquetadas
  con la app: no dependen de internet.

## Antes de dar algo por terminado

`npm run db:test`, `npm run typecheck`, `npm run lint` y `npm run build`.
