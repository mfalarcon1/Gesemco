import { pgTable, unique, serial, text, boolean, timestamp, foreignKey, check, integer, smallint, date, uniqueIndex, index, bigserial, jsonb, pgView, bigint, numeric, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const accionBitacora = pgEnum("accion_bitacora", ['crear', 'actualizar', 'cambiar_estado', 'baja_logica'])
export const ambitoTipo = pgEnum("ambito_tipo", ['asignatura', 'departamento', 'colegio'])
export const estadoAnio = pgEnum("estado_anio", ['abierto', 'cerrado'])
export const estadoExcepcion = pgEnum("estado_excepcion", ['pendiente', 'aprobada', 'rechazada'])
export const estadoOrden = pgEnum("estado_orden", ['borrador', 'enviada', 'excepcion', 'aprobada', 'rechazada', 'recepcionada', 'pagada', 'anulada'])
export const nivelEnsenanza = pgEnum("nivel_ensenanza", ['prebasica', 'basica', 'media'])
export const rolSistema = pgEnum("rol_sistema", ['profesor', 'jefe_departamento', 'contabilidad', 'direccion', 'administrador'])
export const tipoAdjunto = pgEnum("tipo_adjunto", ['cotizacion', 'orden_firmada', 'boleta', 'factura', 'otro'])


export const colegio = pgTable("colegio", {
	id: serial().primaryKey().notNull(),
	nombre: text().notNull(),
	rbd: text().notNull(),
	direccion: text(),
	comuna: text(),
	activo: boolean().default(true).notNull(),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("colegio_rbd_key").on(table.rbd),
]);

export const anioPresupuestario = pgTable("anio_presupuestario", {
	id: serial().primaryKey().notNull(),
	colegioId: integer("colegio_id").notNull(),
	anio: smallint().notNull(),
	estado: estadoAnio().default('abierto').notNull(),
	fechaApertura: date("fecha_apertura").default(sql`CURRENT_DATE`).notNull(),
	fechaCierre: date("fecha_cierre"),
}, (table) => [
	foreignKey({
			columns: [table.colegioId],
			foreignColumns: [colegio.id],
			name: "anio_presupuestario_colegio_id_fkey"
		}),
	unique("uq_anio_colegio").on(table.colegioId, table.anio),
	check("ck_anio_rango", sql`(anio >= 2020) AND (anio <= 2100)`),
	check("ck_anio_cierre", sql`(estado = 'cerrado'::estado_anio) = (fecha_cierre IS NOT NULL)`),
]);

export const usuario = pgTable("usuario", {
	id: serial().primaryKey().notNull(),
	colegioId: integer("colegio_id").notNull(),
	nombre: text().notNull(),
	email: text().notNull(),
	rut: text(),
	activo: boolean().default(true).notNull(),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("uq_usuario_email").using("btree", sql`lower(email)`),
	uniqueIndex("uq_usuario_rut_unico").using("btree", table.rut.asc().nullsLast().op("text_ops")).where(sql`(rut IS NOT NULL)`),
	foreignKey({
			columns: [table.colegioId],
			foreignColumns: [colegio.id],
			name: "usuario_colegio_id_fkey"
		}),
	check("uq_usuario_rut", sql`(rut IS NULL) OR (rut ~ '^[0-9]{7,8}-[0-9kK]$'::text)`),
]);

export const departamento = pgTable("departamento", {
	id: serial().primaryKey().notNull(),
	colegioId: integer("colegio_id").notNull(),
	nombre: text().notNull(),
	nivel: nivelEnsenanza().notNull(),
	jefeUsuarioId: integer("jefe_usuario_id"),
	activo: boolean().default(true).notNull(),
}, (table) => [
	index("ix_departamento_colegio").using("btree", table.colegioId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.colegioId],
			foreignColumns: [colegio.id],
			name: "departamento_colegio_id_fkey"
		}),
	foreignKey({
			columns: [table.jefeUsuarioId],
			foreignColumns: [usuario.id],
			name: "departamento_jefe_usuario_id_fkey"
		}),
	unique("uq_departamento_nivel").on(table.colegioId, table.nivel),
]);

export const asignatura = pgTable("asignatura", {
	id: serial().primaryKey().notNull(),
	departamentoId: integer("departamento_id").notNull(),
	nombre: text().notNull(),
	codigo: text().notNull(),
	activa: boolean().default(true).notNull(),
}, (table) => [
	index("ix_asignatura_departamento").using("btree", table.departamentoId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.departamentoId],
			foreignColumns: [departamento.id],
			name: "asignatura_departamento_id_fkey"
		}),
	unique("asignatura_codigo_key").on(table.codigo),
]);

export const rolAsignado = pgTable("rol_asignado", {
	id: serial().primaryKey().notNull(),
	usuarioId: integer("usuario_id").notNull(),
	rol: rolSistema().notNull(),
	ambitoTipo: ambitoTipo("ambito_tipo").notNull(),
	ambitoId: integer("ambito_id").notNull(),
	desde: date().default(sql`CURRENT_DATE`).notNull(),
	hasta: date(),
}, (table) => [
	index("ix_rol_usuario").using("btree", table.usuarioId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.usuarioId],
			foreignColumns: [usuario.id],
			name: "rol_asignado_usuario_id_fkey"
		}).onDelete("cascade"),
	unique("uq_rol_ambito").on(table.usuarioId, table.rol, table.ambitoTipo, table.ambitoId),
	check("ck_vigencia", sql`(hasta IS NULL) OR (hasta >= desde)`),
]);

export const profesorAsignatura = pgTable("profesor_asignatura", {
	id: serial().primaryKey().notNull(),
	usuarioId: integer("usuario_id").notNull(),
	asignaturaId: integer("asignatura_id").notNull(),
	anioId: integer("anio_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.usuarioId],
			foreignColumns: [usuario.id],
			name: "profesor_asignatura_usuario_id_fkey"
		}),
	foreignKey({
			columns: [table.asignaturaId],
			foreignColumns: [asignatura.id],
			name: "profesor_asignatura_asignatura_id_fkey"
		}),
	foreignKey({
			columns: [table.anioId],
			foreignColumns: [anioPresupuestario.id],
			name: "profesor_asignatura_anio_id_fkey"
		}),
	unique("uq_profesor_asignatura").on(table.usuarioId, table.asignaturaId, table.anioId),
]);

export const presupuesto = pgTable("presupuesto", {
	id: serial().primaryKey().notNull(),
	asignaturaId: integer("asignatura_id").notNull(),
	anioId: integer("anio_id").notNull(),
	montoAsignado: integer("monto_asignado").notNull(),
	montoVigente: integer("monto_vigente").notNull(),
	asignadoPor: integer("asignado_por").notNull(),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_presupuesto_anio").using("btree", table.anioId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.asignaturaId],
			foreignColumns: [asignatura.id],
			name: "presupuesto_asignatura_id_fkey"
		}),
	foreignKey({
			columns: [table.anioId],
			foreignColumns: [anioPresupuestario.id],
			name: "presupuesto_anio_id_fkey"
		}),
	foreignKey({
			columns: [table.asignadoPor],
			foreignColumns: [usuario.id],
			name: "presupuesto_asignado_por_fkey"
		}),
	unique("uq_presupuesto").on(table.asignaturaId, table.anioId),
	check("presupuesto_monto_asignado_check", sql`monto_asignado >= 0`),
	check("presupuesto_monto_vigente_check", sql`monto_vigente >= 0`),
]);

export const movimientoPresupuesto = pgTable("movimiento_presupuesto", {
	id: serial().primaryKey().notNull(),
	presupuestoOrigenId: integer("presupuesto_origen_id"),
	presupuestoDestinoId: integer("presupuesto_destino_id"),
	monto: integer().notNull(),
	motivo: text().notNull(),
	autorizadoPor: integer("autorizado_por").notNull(),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.presupuestoOrigenId],
			foreignColumns: [presupuesto.id],
			name: "movimiento_presupuesto_presupuesto_origen_id_fkey"
		}),
	foreignKey({
			columns: [table.presupuestoDestinoId],
			foreignColumns: [presupuesto.id],
			name: "movimiento_presupuesto_presupuesto_destino_id_fkey"
		}),
	foreignKey({
			columns: [table.autorizadoPor],
			foreignColumns: [usuario.id],
			name: "movimiento_presupuesto_autorizado_por_fkey"
		}),
	check("movimiento_presupuesto_monto_check", sql`monto > 0`),
	check("ck_movimiento_lados", sql`(presupuesto_origen_id IS NOT NULL) OR (presupuesto_destino_id IS NOT NULL)`),
	check("ck_movimiento_distintos", sql`presupuesto_origen_id IS DISTINCT FROM presupuesto_destino_id`),
]);

export const ordenCompra = pgTable("orden_compra", {
	id: serial().primaryKey().notNull(),
	folio: text().notNull(),
	asignaturaId: integer("asignatura_id").notNull(),
	anioId: integer("anio_id").notNull(),
	solicitanteId: integer("solicitante_id").notNull(),
	proveedorId: integer("proveedor_id"),
	fechaSolicitud: date("fecha_solicitud").default(sql`CURRENT_DATE`).notNull(),
	montoTotal: integer("monto_total").default(0).notNull(),
	estado: estadoOrden().default('borrador').notNull(),
	justificacion: text(),
	aprobadorId: integer("aprobador_id"),
	fechaAprobacion: timestamp("fecha_aprobacion", { withTimezone: true, mode: 'string' }),
	comentarioAprobacion: text("comentario_aprobacion"),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	actualizadoEn: timestamp("actualizado_en", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_orden_asig_anio").using("btree", table.asignaturaId.asc().nullsLast().op("int4_ops"), table.anioId.asc().nullsLast().op("int4_ops")),
	index("ix_orden_estado").using("btree", table.estado.asc().nullsLast().op("enum_ops")),
	index("ix_orden_solicitante").using("btree", table.solicitanteId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.asignaturaId],
			foreignColumns: [asignatura.id],
			name: "orden_compra_asignatura_id_fkey"
		}),
	foreignKey({
			columns: [table.anioId],
			foreignColumns: [anioPresupuestario.id],
			name: "orden_compra_anio_id_fkey"
		}),
	foreignKey({
			columns: [table.solicitanteId],
			foreignColumns: [usuario.id],
			name: "orden_compra_solicitante_id_fkey"
		}),
	foreignKey({
			columns: [table.proveedorId],
			foreignColumns: [proveedor.id],
			name: "orden_compra_proveedor_id_fkey"
		}),
	foreignKey({
			columns: [table.aprobadorId],
			foreignColumns: [usuario.id],
			name: "orden_compra_aprobador_id_fkey"
		}),
	foreignKey({
			columns: [table.asignaturaId, table.anioId],
			foreignColumns: [presupuesto.asignaturaId, presupuesto.anioId],
			name: "fk_orden_presupuesto"
		}),
	unique("orden_compra_folio_key").on(table.folio),
	check("orden_compra_monto_total_check", sql`monto_total >= 0`),
	check("ck_rechazo_con_motivo", sql`(estado <> 'rechazada'::estado_orden) OR (comentario_aprobacion IS NOT NULL)`),
	check("ck_aprobacion_con_aprobador", sql`(estado <> ALL (ARRAY['aprobada'::estado_orden, 'recepcionada'::estado_orden, 'pagada'::estado_orden])) OR (aprobador_id IS NOT NULL)`),
]);

export const proveedor = pgTable("proveedor", {
	id: serial().primaryKey().notNull(),
	rut: text().notNull(),
	razonSocial: text("razon_social").notNull(),
	giro: text(),
	email: text(),
	telefono: text(),
	activo: boolean().default(true).notNull(),
}, (table) => [
	unique("proveedor_rut_key").on(table.rut),
]);

export const itemOrden = pgTable("item_orden", {
	id: serial().primaryKey().notNull(),
	ordenId: integer("orden_id").notNull(),
	categoriaGastoId: integer("categoria_gasto_id").notNull(),
	descripcion: text().notNull(),
	cantidad: integer().notNull(),
	precioUnitario: integer("precio_unitario").notNull(),
	subtotal: integer().generatedAlwaysAs(sql`(cantidad * precio_unitario)`),
}, (table) => [
	index("ix_item_orden").using("btree", table.ordenId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.ordenId],
			foreignColumns: [ordenCompra.id],
			name: "item_orden_orden_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.categoriaGastoId],
			foreignColumns: [categoriaGasto.id],
			name: "item_orden_categoria_gasto_id_fkey"
		}),
	check("item_orden_cantidad_check", sql`cantidad > 0`),
	check("item_orden_precio_unitario_check", sql`precio_unitario >= 0`),
]);

export const categoriaGasto = pgTable("categoria_gasto", {
	id: serial().primaryKey().notNull(),
	nombre: text().notNull(),
	cuentaContable: text("cuenta_contable"),
	activa: boolean().default(true).notNull(),
}, (table) => [
	unique("categoria_gasto_nombre_key").on(table.nombre),
]);

export const solicitudExcepcion = pgTable("solicitud_excepcion", {
	id: serial().primaryKey().notNull(),
	ordenId: integer("orden_id").notNull(),
	montoExcedido: integer("monto_excedido").notNull(),
	motivo: text().notNull(),
	estado: estadoExcepcion().default('pendiente').notNull(),
	resueltoPor: integer("resuelto_por"),
	fechaResolucion: timestamp("fecha_resolucion", { withTimezone: true, mode: 'string' }),
	comentario: text(),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.ordenId],
			foreignColumns: [ordenCompra.id],
			name: "solicitud_excepcion_orden_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.resueltoPor],
			foreignColumns: [usuario.id],
			name: "solicitud_excepcion_resuelto_por_fkey"
		}),
	unique("solicitud_excepcion_orden_id_key").on(table.ordenId),
	check("solicitud_excepcion_monto_excedido_check", sql`monto_excedido > 0`),
	check("ck_resolucion", sql`(estado = 'pendiente'::estado_excepcion) = ((resuelto_por IS NULL) AND (fecha_resolucion IS NULL))`),
]);

export const adjunto = pgTable("adjunto", {
	id: serial().primaryKey().notNull(),
	ordenId: integer("orden_id").notNull(),
	tipo: tipoAdjunto().notNull(),
	nombre: text().notNull(),
	url: text().notNull(),
	subidoPor: integer("subido_por").notNull(),
	subidoEn: timestamp("subido_en", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_adjunto_orden").using("btree", table.ordenId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.ordenId],
			foreignColumns: [ordenCompra.id],
			name: "adjunto_orden_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.subidoPor],
			foreignColumns: [usuario.id],
			name: "adjunto_subido_por_fkey"
		}),
]);

export const recepcion = pgTable("recepcion", {
	id: serial().primaryKey().notNull(),
	ordenId: integer("orden_id").notNull(),
	montoReal: integer("monto_real").notNull(),
	fechaRecepcion: date("fecha_recepcion").default(sql`CURRENT_DATE`).notNull(),
	recibidoPor: integer("recibido_por").notNull(),
	observaciones: text(),
}, (table) => [
	foreignKey({
			columns: [table.ordenId],
			foreignColumns: [ordenCompra.id],
			name: "recepcion_orden_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.recibidoPor],
			foreignColumns: [usuario.id],
			name: "recepcion_recibido_por_fkey"
		}),
	unique("recepcion_orden_id_key").on(table.ordenId),
	check("recepcion_monto_real_check", sql`monto_real >= 0`),
]);

export const bitacora = pgTable("bitacora", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	usuarioId: integer("usuario_id"),
	entidad: text().notNull(),
	entidadId: integer("entidad_id").notNull(),
	accion: accionBitacora().notNull(),
	datosAntes: jsonb("datos_antes"),
	datosDespues: jsonb("datos_despues"),
	ocurridoEn: timestamp("ocurrido_en", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_bitacora_entidad").using("btree", table.entidad.asc().nullsLast().op("int4_ops"), table.entidadId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.usuarioId],
			foreignColumns: [usuario.id],
			name: "bitacora_usuario_id_fkey"
		}),
]);

export const folioContador = pgTable("folio_contador", {
	anioId: integer("anio_id").primaryKey().notNull(),
	ultimo: integer().default(0).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.anioId],
			foreignColumns: [anioPresupuestario.id],
			name: "folio_contador_anio_id_fkey"
		}),
]);
export const vwSaldoAsignatura = pgView("vw_saldo_asignatura", {	presupuestoId: integer("presupuesto_id"),
	asignaturaId: integer("asignatura_id"),
	asignatura: text(),
	departamentoId: integer("departamento_id"),
	departamento: text(),
	nivel: nivelEnsenanza(),
	anioId: integer("anio_id"),
	anio: smallint(),
	asignado: integer(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	comprometido: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	ejecutado: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	disponible: bigint({ mode: "number" }),
}).as(sql`SELECT p.id AS presupuesto_id, a.id AS asignatura_id, a.nombre AS asignatura, d.id AS departamento_id, d.nombre AS departamento, d.nivel, ap.id AS anio_id, ap.anio, p.monto_vigente AS asignado, COALESCE(sum(oc.monto_total) FILTER (WHERE oc.estado = ANY (ARRAY['enviada'::estado_orden, 'aprobada'::estado_orden])), 0::bigint) AS comprometido, COALESCE(sum(COALESCE(r.monto_real, oc.monto_total)) FILTER (WHERE oc.estado = ANY (ARRAY['recepcionada'::estado_orden, 'pagada'::estado_orden])), 0::bigint) AS ejecutado, p.monto_vigente - COALESCE(sum(oc.monto_total) FILTER (WHERE oc.estado = ANY (ARRAY['enviada'::estado_orden, 'aprobada'::estado_orden])), 0::bigint) - COALESCE(sum(COALESCE(r.monto_real, oc.monto_total)) FILTER (WHERE oc.estado = ANY (ARRAY['recepcionada'::estado_orden, 'pagada'::estado_orden])), 0::bigint) AS disponible FROM presupuesto p JOIN asignatura a ON a.id = p.asignatura_id JOIN departamento d ON d.id = a.departamento_id JOIN anio_presupuestario ap ON ap.id = p.anio_id LEFT JOIN orden_compra oc ON oc.asignatura_id = p.asignatura_id AND oc.anio_id = p.anio_id LEFT JOIN recepcion r ON r.orden_id = oc.id GROUP BY p.id, a.id, d.id, ap.id`);

export const vwSaldoDepartamento = pgView("vw_saldo_departamento", {	departamentoId: integer("departamento_id"),
	departamento: text(),
	nivel: nivelEnsenanza(),
	anioId: integer("anio_id"),
	anio: smallint(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	asignado: bigint({ mode: "number" }),
	comprometido: numeric(),
	ejecutado: numeric(),
	disponible: numeric(),
}).as(sql`SELECT departamento_id, departamento, nivel, anio_id, anio, sum(asignado) AS asignado, sum(comprometido) AS comprometido, sum(ejecutado) AS ejecutado, sum(disponible) AS disponible FROM vw_saldo_asignatura GROUP BY departamento_id, departamento, nivel, anio_id, anio`);

export const vwConsolidadoColegio = pgView("vw_consolidado_colegio", {	colegioId: integer("colegio_id"),
	colegio: text(),
	anio: smallint(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	asignado: bigint({ mode: "number" }),
	comprometido: numeric(),
	ejecutado: numeric(),
	disponible: numeric(),
	pctUsado: numeric("pct_usado"),
}).as(sql`SELECT c.id AS colegio_id, c.nombre AS colegio, v.anio, sum(v.asignado) AS asignado, sum(v.comprometido) AS comprometido, sum(v.ejecutado) AS ejecutado, sum(v.disponible) AS disponible, round(100.0 * (sum(v.comprometido) + sum(v.ejecutado)) / NULLIF(sum(v.asignado), 0)::numeric, 1) AS pct_usado FROM vw_saldo_asignatura v JOIN departamento d ON d.id = v.departamento_id JOIN colegio c ON c.id = d.colegio_id GROUP BY c.id, v.anio`);