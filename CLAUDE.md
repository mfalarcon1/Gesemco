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
Colegio → Departamento (por área, con jefe) → presupuesto anual → Programa → Línea (artículo × cantidad × precio × meses)
```

Departamentos: formación, matemática, física, historia, inglés, lenguaje, biblioteca,
reproducción de imagen, alemán, arte, ciencia, pastoral, apoyo al aprendizaje.

Roles (`rol_asignado`): profesor y jefe_departamento van con departamento; direccion,
contabilidad (GESEMCO), equipo_compra y administrador valen para todo el colegio. Un
profesor puede estar en varios departamentos; un jefe también puede hacer clases.

Cada año pasa por `formulacion → ejecucion → cerrado`. Conviven dos: se ejecuta un año
mientras se formula el siguiente (la sesión trae `anioFormulacion` y `anioEjecucion`).

**Etapa 1 — formulación (construida)**
- El jefe arma programas con líneas del catálogo (precio = mediana de las ofertas
  vigentes, congelado en la línea) o líneas libres (fuera de catálogo).
- `presupuesto_departamento`: borrador → enviado → aprobado | devuelto → enviado. El jefe
  puede retirar un envío. La negociación con Dirección es en reunión, fuera del sistema.
- Aprobar congela `monto_aprobado`. Después el jefe escribe cuántas unidades de cada línea
  necesita en cada mes (`linea_calendario`; la cantidad es libre y puede quedar a medias)
  → proyección mensual para GESEMCO. Informativa: no bloquea compras.

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

## Invariantes que viven en la base: no las dupliques en la app

- `fn_guardia_anio_cerrado` (triggers `trg_a_…`): un año cerrado no admite cambios.
- `fn_guardia_presupuesto_editable`: programas y líneas solo cambian en borrador o devuelto.
- `fn_transicion_presupuesto`: transiciones válidas, no enviar vacío, congelar el aprobado.
- `fn_calendario_cuadra`: los meses no suman más que la línea; bajar la cantidad bajo lo
  repartido reinicia los meses de esa línea.
- `fn_transicion_orden` + `fn_efectos_orden`: la regla del disponible, el pendiente de
  pedido y los avisos. Una orden nace en borrador; sus ítems solo cambian en borrador.
- `fn_bitacora` (triggers `trg_z_…`): auditoría de todo lo que cambia de estado.
- Saldos, proyección y catálogo salen de vistas (`vw_…`). **Nunca guardes un saldo.**

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
- Permisos por `rol_asignado`, nunca por nombre de persona. Helpers en `src/lib/sesion.ts`
  (`esJefeDe`, `esDireccion`, `puedeVerDepartamento`…). Se consultan en la página y se
  vuelven a exigir en la acción.
- Estilos con tokens de `src/app/globals.css` y clases de `src/components/ui.ts`. No metas
  colores literales: rompen el modo oscuro.
- Gráficos: `--dato` / `--dato-2` son una rampa ordinal validada en claro y oscuro. Los
  colores `ok`, `warn` y `bad` son de **estado**: nunca para una serie, y siempre con ícono
  y texto. Cada gráfico tiene su tabla con los mismos valores.
- El login es provisorio: selector de usuario por cookie. Cuando entre Auth.js solo
  cambia `getSesion()` y desaparece `src/app/actions.ts`.

## Antes de dar algo por terminado

`npm run db:test`, `npm run typecheck`, `npm run lint` y `npm run build`.
