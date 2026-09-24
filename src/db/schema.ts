import { pgTable, index, uniqueIndex, foreignKey, unique, check, serial, integer, date, text, boolean, timestamp, smallint, bigserial, bigint, jsonb, primaryKey, pgView, numeric, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const accionBitacora = pgEnum("accion_bitacora", ['crear', 'actualizar', 'cambiar_estado', 'eliminar'])
export const estadoOrden = pgEnum("estado_orden", ['borrador', 'pendiente_direccion', 'emitida', 'denegada', 'comprada', 'recibida', 'anulada'])
export const estadoPendiente = pgEnum("estado_pendiente", ['pendiente', 'aprobado', 'denegado'])
export const estadoPresupuesto = pgEnum("estado_presupuesto", ['borrador', 'enviado', 'devuelto', 'aprobado'])
export const estadoSolicitud = pgEnum("estado_solicitud", ['borrador', 'enviada', 'aprobada', 'rechazada', 'anulada'])
export const etapaAnio = pgEnum("etapa_anio", ['formulacion', 'ejecucion', 'cerrado'])
export const plataformaTienda = pgEnum("plataforma_tienda", ['vtex', 'woocommerce', 'shopify', 'jumpseller', 'mercado_publico', 'manual'])
export const rolSistema = pgEnum("rol_sistema", ['profesor', 'jefe_departamento', 'direccion', 'contabilidad', 'equipo_compra', 'administrador'])
export const tipoAdjunto = pgEnum("tipo_adjunto", ['cotizacion', 'factura', 'boleta', 'orden_firmada', 'otro'])
export const tipoDocumento = pgEnum("tipo_documento", ['factura', 'boleta', 'otro'])


export const rolAsignado = pgTable("rol_asignado", {
	id: serial().primaryKey().notNull(),
	usuarioId: integer("usuario_id").notNull(),
	rol: rolSistema().notNull(),
	departamentoId: integer("departamento_id"),
	desde: date().default(sql`CURRENT_DATE`).notNull(),
	hasta: date(),
}, (table) => [
	index("ix_rol_departamento").using("btree", table.departamentoId.asc().nullsLast().op("int4_ops")),
	index("ix_rol_usuario").using("btree", table.usuarioId.asc().nullsLast().op("int4_ops")),
	uniqueIndex("uq_un_jefe_vigente").using("btree", table.departamentoId.asc().nullsLast().op("int4_ops")).where(sql`((rol = 'jefe_departamento'::rol_sistema) AND (hasta IS NULL))`),
	foreignKey({
			columns: [table.usuarioId],
			foreignColumns: [usuario.id],
			name: "rol_asignado_usuario_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.departamentoId],
			foreignColumns: [departamento.id],
			name: "rol_asignado_departamento_id_fkey"
		}),
	unique("uq_rol").on(table.usuarioId, table.rol, table.departamentoId),
	check("ck_rol_ambito", sql`(rol = ANY (ARRAY['profesor'::rol_sistema, 'jefe_departamento'::rol_sistema])) = (departamento_id IS NOT NULL)`),
	check("ck_vigencia", sql`(hasta IS NULL) OR (hasta >= desde)`),
]);

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
	etapa: etapaAnio().default('formulacion').notNull(),
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
	check("ck_anio_cierre", sql`(etapa = 'cerrado'::etapa_anio) = (fecha_cierre IS NOT NULL)`),
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
	uniqueIndex("uq_usuario_rut").using("btree", table.rut.asc().nullsLast().op("text_ops")).where(sql`(rut IS NOT NULL)`),
	foreignKey({
			columns: [table.colegioId],
			foreignColumns: [colegio.id],
			name: "usuario_colegio_id_fkey"
		}),
	check("ck_usuario_rut", sql`(rut IS NULL) OR (rut ~ '^[0-9]{7,8}-[0-9kK]$'::text)`),
]);

export const departamento = pgTable("departamento", {
	id: serial().primaryKey().notNull(),
	colegioId: integer("colegio_id").notNull(),
	nombre: text().notNull(),
	centroCosto: text("centro_costo"),
	activo: boolean().default(true).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.colegioId],
			foreignColumns: [colegio.id],
			name: "departamento_colegio_id_fkey"
		}),
	unique("uq_departamento_nombre").on(table.colegioId, table.nombre),
]);

export const cuentaContable = pgTable("cuenta_contable", {
	id: serial().primaryKey().notNull(),
	codigo: text().notNull(),
	nombre: text().notNull(),
	activa: boolean().default(true).notNull(),
}, (table) => [
	unique("cuenta_contable_codigo_key").on(table.codigo),
]);

export const categoriaArticulo = pgTable("categoria_articulo", {
	id: serial().primaryKey().notNull(),
	nombre: text().notNull(),
	cuentaContableId: integer("cuenta_contable_id"),
	orden: smallint().default(0).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.cuentaContableId],
			foreignColumns: [cuentaContable.id],
			name: "categoria_articulo_cuenta_contable_id_fkey"
		}),
	unique("categoria_articulo_nombre_key").on(table.nombre),
]);

export const articulo = pgTable("articulo", {
	id: serial().primaryKey().notNull(),
	nombre: text().notNull(),
	descripcion: text(),
	unidad: text().default('unidad').notNull(),
	categoriaId: integer("categoria_id").notNull(),
	activo: boolean().default(true).notNull(),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_articulo_categoria").using("btree", table.categoriaId.asc().nullsLast().op("int4_ops")),
	uniqueIndex("uq_articulo_nombre").using("btree", sql`lower(nombre)`),
	foreignKey({
			columns: [table.categoriaId],
			foreignColumns: [categoriaArticulo.id],
			name: "articulo_categoria_id_fkey"
		}),
]);

export const tienda = pgTable("tienda", {
	id: serial().primaryKey().notNull(),
	nombre: text().notNull(),
	url: text(),
	plataforma: plataformaTienda().default('manual').notNull(),
	preciosConIva: boolean("precios_con_iva"),
	activa: boolean().default(true).notNull(),
}, (table) => [
	unique("tienda_nombre_key").on(table.nombre),
]);

export const productoTienda = pgTable("producto_tienda", {
	id: serial().primaryKey().notNull(),
	tiendaId: integer("tienda_id").notNull(),
	sku: text().notNull(),
	nombre: text().notNull(),
	marca: text(),
	url: text(),
	articuloId: integer("articulo_id"),
	activo: boolean().default(true).notNull(),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_producto_articulo").using("btree", table.articuloId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.tiendaId],
			foreignColumns: [tienda.id],
			name: "producto_tienda_tienda_id_fkey"
		}),
	foreignKey({
			columns: [table.articuloId],
			foreignColumns: [articulo.id],
			name: "producto_tienda_articulo_id_fkey"
		}),
	unique("uq_producto_tienda").on(table.tiendaId, table.sku),
]);

export const precioObservado = pgTable("precio_observado", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	productoTiendaId: integer("producto_tienda_id").notNull(),
	precio: integer().notNull(),
	conIva: boolean("con_iva"),
	stock: integer(),
	observadoEn: timestamp("observado_en", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_precio_producto_fecha").using("btree", table.productoTiendaId.asc().nullsLast().op("int4_ops"), table.observadoEn.desc().nullsFirst().op("int4_ops")),
	foreignKey({
			columns: [table.productoTiendaId],
			foreignColumns: [productoTienda.id],
			name: "precio_observado_producto_tienda_id_fkey"
		}).onDelete("cascade"),
	check("precio_observado_precio_check", sql`precio > 0`),
]);

export const presupuestoDepartamento = pgTable("presupuesto_departamento", {
	id: serial().primaryKey().notNull(),
	departamentoId: integer("departamento_id").notNull(),
	anioId: integer("anio_id").notNull(),
	estado: estadoPresupuesto().default('borrador').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	montoAprobado: bigint("monto_aprobado", { mode: "number" }),
	enviadoEn: timestamp("enviado_en", { withTimezone: true, mode: 'string' }),
	resueltoEn: timestamp("resuelto_en", { withTimezone: true, mode: 'string' }),
	resueltoPor: integer("resuelto_por"),
	comentarioDireccion: text("comentario_direccion"),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_presupuesto_anio").using("btree", table.anioId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.departamentoId],
			foreignColumns: [departamento.id],
			name: "presupuesto_departamento_departamento_id_fkey"
		}),
	foreignKey({
			columns: [table.anioId],
			foreignColumns: [anioPresupuestario.id],
			name: "presupuesto_departamento_anio_id_fkey"
		}),
	foreignKey({
			columns: [table.resueltoPor],
			foreignColumns: [usuario.id],
			name: "presupuesto_departamento_resuelto_por_fkey"
		}),
	unique("uq_presupuesto_depto_anio").on(table.departamentoId, table.anioId),
	check("presupuesto_departamento_monto_aprobado_check", sql`monto_aprobado >= 0`),
	check("ck_aprobado_congelado", sql`(estado = 'aprobado'::estado_presupuesto) = (monto_aprobado IS NOT NULL)`),
	check("ck_devuelto_con_comentario", sql`(estado <> 'devuelto'::estado_presupuesto) OR (NULLIF(btrim(comentario_direccion), ''::text) IS NOT NULL)`),
]);

export const programa = pgTable("programa", {
	id: serial().primaryKey().notNull(),
	presupuestoId: integer("presupuesto_id").notNull(),
	nombre: text().notNull(),
	descripcion: text(),
	creadoPor: integer("creado_por"),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_programa_presupuesto").using("btree", table.presupuestoId.asc().nullsLast().op("int4_ops")),
	uniqueIndex("uq_programa_nombre").using("btree", sql`presupuesto_id`, sql`lower(nombre)`),
	foreignKey({
			columns: [table.presupuestoId],
			foreignColumns: [presupuestoDepartamento.id],
			name: "programa_presupuesto_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.creadoPor],
			foreignColumns: [usuario.id],
			name: "programa_creado_por_fkey"
		}),
]);

export const lineaPresupuesto = pgTable("linea_presupuesto", {
	id: serial().primaryKey().notNull(),
	programaId: integer("programa_id").notNull(),
	articuloId: integer("articulo_id"),
	descripcion: text().notNull(),
	cantidad: integer().notNull(),
	precioUnitario: integer("precio_unitario").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	subtotal: bigint({ mode: "number" }).generatedAlwaysAs(sql`((cantidad)::bigint * precio_unitario)`),
	fueraCatalogo: boolean("fuera_catalogo").generatedAlwaysAs(sql`(articulo_id IS NULL)`),
	cuentaContableId: integer("cuenta_contable_id"),
	origenPrecio: text("origen_precio"),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_linea_articulo").using("btree", table.articuloId.asc().nullsLast().op("int4_ops")),
	index("ix_linea_programa").using("btree", table.programaId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.programaId],
			foreignColumns: [programa.id],
			name: "linea_presupuesto_programa_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.articuloId],
			foreignColumns: [articulo.id],
			name: "linea_presupuesto_articulo_id_fkey"
		}),
	foreignKey({
			columns: [table.cuentaContableId],
			foreignColumns: [cuentaContable.id],
			name: "linea_presupuesto_cuenta_contable_id_fkey"
		}),
	check("linea_presupuesto_cantidad_check", sql`cantidad > 0`),
	check("linea_presupuesto_precio_unitario_check", sql`precio_unitario >= 0`),
]);

export const lineaCalendario = pgTable("linea_calendario", {
	id: serial().primaryKey().notNull(),
	lineaId: integer("linea_id").notNull(),
	mes: smallint().notNull(),
	cantidad: integer().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.lineaId],
			foreignColumns: [lineaPresupuesto.id],
			name: "linea_calendario_linea_id_fkey"
		}).onDelete("cascade"),
	unique("uq_linea_mes").on(table.lineaId, table.mes),
	check("linea_calendario_mes_check", sql`(mes >= 1) AND (mes <= 12)`),
	check("linea_calendario_cantidad_check", sql`cantidad > 0`),
]);

export const solicitudCompra = pgTable("solicitud_compra", {
	id: serial().primaryKey().notNull(),
	folio: text().notNull(),
	presupuestoId: integer("presupuesto_id").notNull(),
	solicitanteId: integer("solicitante_id").notNull(),
	estado: estadoSolicitud().default('borrador').notNull(),
	justificacion: text(),
	fechaSolicitud: date("fecha_solicitud").default(sql`CURRENT_DATE`).notNull(),
	resueltoPor: integer("resuelto_por"),
	resueltoEn: timestamp("resuelto_en", { withTimezone: true, mode: 'string' }),
	motivoRechazo: text("motivo_rechazo"),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_solicitud_presupuesto").using("btree", table.presupuestoId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.presupuestoId],
			foreignColumns: [presupuestoDepartamento.id],
			name: "solicitud_compra_presupuesto_id_fkey"
		}),
	foreignKey({
			columns: [table.solicitanteId],
			foreignColumns: [usuario.id],
			name: "solicitud_compra_solicitante_id_fkey"
		}),
	foreignKey({
			columns: [table.resueltoPor],
			foreignColumns: [usuario.id],
			name: "solicitud_compra_resuelto_por_fkey"
		}),
	unique("solicitud_compra_folio_key").on(table.folio),
	check("ck_rechazo_con_motivo", sql`(estado <> 'rechazada'::estado_solicitud) OR (NULLIF(btrim(motivo_rechazo), ''::text) IS NOT NULL)`),
]);

export const itemSolicitud = pgTable("item_solicitud", {
	id: serial().primaryKey().notNull(),
	solicitudId: integer("solicitud_id").notNull(),
	lineaId: integer("linea_id"),
	articuloId: integer("articulo_id"),
	descripcion: text().notNull(),
	cantidad: integer().notNull(),
	precioReferencia: integer("precio_referencia").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	subtotal: bigint({ mode: "number" }).generatedAlwaysAs(sql`((cantidad)::bigint * precio_referencia)`),
}, (table) => [
	index("ix_item_solicitud").using("btree", table.solicitudId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.solicitudId],
			foreignColumns: [solicitudCompra.id],
			name: "item_solicitud_solicitud_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.lineaId],
			foreignColumns: [lineaPresupuesto.id],
			name: "item_solicitud_linea_id_fkey"
		}),
	foreignKey({
			columns: [table.articuloId],
			foreignColumns: [articulo.id],
			name: "item_solicitud_articulo_id_fkey"
		}),
	check("item_solicitud_cantidad_check", sql`cantidad > 0`),
	check("item_solicitud_precio_referencia_check", sql`precio_referencia >= 0`),
]);

export const ordenCompra = pgTable("orden_compra", {
	id: serial().primaryKey().notNull(),
	folio: text().notNull(),
	presupuestoId: integer("presupuesto_id").notNull(),
	solicitudId: integer("solicitud_id"),
	emitidaPor: integer("emitida_por").notNull(),
	estado: estadoOrden().default('borrador').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	montoPresupuesto: bigint("monto_presupuesto", { mode: "number" }).default(0).notNull(),
	fechaEmision: timestamp("fecha_emision", { withTimezone: true, mode: 'string' }),
	observacion: text(),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	actualizadoEn: timestamp("actualizado_en", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_orden_presupuesto").using("btree", table.presupuestoId.asc().nullsLast().op("int4_ops"), table.estado.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.presupuestoId],
			foreignColumns: [presupuestoDepartamento.id],
			name: "orden_compra_presupuesto_id_fkey"
		}),
	foreignKey({
			columns: [table.solicitudId],
			foreignColumns: [solicitudCompra.id],
			name: "orden_compra_solicitud_id_fkey"
		}),
	foreignKey({
			columns: [table.emitidaPor],
			foreignColumns: [usuario.id],
			name: "orden_compra_emitida_por_fkey"
		}),
	unique("orden_compra_folio_key").on(table.folio),
	check("orden_compra_monto_presupuesto_check", sql`monto_presupuesto >= 0`),
]);

export const itemOrden = pgTable("item_orden", {
	id: serial().primaryKey().notNull(),
	ordenId: integer("orden_id").notNull(),
	lineaId: integer("linea_id"),
	articuloId: integer("articulo_id"),
	descripcion: text().notNull(),
	cantidad: integer().notNull(),
	precioPresupuesto: integer("precio_presupuesto").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	subtotal: bigint({ mode: "number" }).generatedAlwaysAs(sql`((cantidad)::bigint * precio_presupuesto)`),
	noPlanificado: boolean("no_planificado").generatedAlwaysAs(sql`(linea_id IS NULL)`),
	cuentaContableId: integer("cuenta_contable_id"),
}, (table) => [
	index("ix_item_orden").using("btree", table.ordenId.asc().nullsLast().op("int4_ops")),
	index("ix_item_orden_linea").using("btree", table.lineaId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.articuloId],
			foreignColumns: [articulo.id],
			name: "item_orden_articulo_id_fkey"
		}),
	foreignKey({
			columns: [table.cuentaContableId],
			foreignColumns: [cuentaContable.id],
			name: "item_orden_cuenta_contable_id_fkey"
		}),
	foreignKey({
			columns: [table.ordenId],
			foreignColumns: [ordenCompra.id],
			name: "item_orden_orden_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.lineaId],
			foreignColumns: [lineaPresupuesto.id],
			name: "item_orden_linea_id_fkey"
		}),
	check("item_orden_cantidad_check", sql`cantidad > 0`),
	check("item_orden_precio_presupuesto_check", sql`precio_presupuesto >= 0`),
]);

export const pendientePedido = pgTable("pendiente_pedido", {
	id: serial().primaryKey().notNull(),
	ordenId: integer("orden_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	montoExcedido: bigint("monto_excedido", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	disponibleAlEmitir: bigint("disponible_al_emitir", { mode: "number" }).notNull(),
	estado: estadoPendiente().default('pendiente').notNull(),
	resueltoPor: integer("resuelto_por"),
	resueltoEn: timestamp("resuelto_en", { withTimezone: true, mode: 'string' }),
	explicacion: text(),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.ordenId],
			foreignColumns: [ordenCompra.id],
			name: "pendiente_pedido_orden_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.resueltoPor],
			foreignColumns: [usuario.id],
			name: "pendiente_pedido_resuelto_por_fkey"
		}),
	unique("pendiente_pedido_orden_id_key").on(table.ordenId),
	check("pendiente_pedido_monto_excedido_check", sql`monto_excedido > 0`),
	check("ck_pendiente_resolucion", sql`(estado = 'pendiente'::estado_pendiente) = ((resuelto_por IS NULL) AND (resuelto_en IS NULL))`),
	check("ck_denegado_con_explicacion", sql`(estado <> 'denegado'::estado_pendiente) OR (NULLIF(btrim(explicacion), ''::text) IS NOT NULL)`),
]);

export const modificacionPresupuestaria = pgTable("modificacion_presupuestaria", {
	id: serial().primaryKey().notNull(),
	presupuestoId: integer("presupuesto_id").notNull(),
	monto: integer().notNull(),
	motivo: text().notNull(),
	pendienteId: integer("pendiente_id"),
	autorizadoPor: integer("autorizado_por").notNull(),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_modificacion_pres").using("btree", table.presupuestoId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.presupuestoId],
			foreignColumns: [presupuestoDepartamento.id],
			name: "modificacion_presupuestaria_presupuesto_id_fkey"
		}),
	foreignKey({
			columns: [table.pendienteId],
			foreignColumns: [pendientePedido.id],
			name: "modificacion_presupuestaria_pendiente_id_fkey"
		}),
	foreignKey({
			columns: [table.autorizadoPor],
			foreignColumns: [usuario.id],
			name: "modificacion_presupuestaria_autorizado_por_fkey"
		}),
	unique("modificacion_presupuestaria_pendiente_id_key").on(table.pendienteId),
	check("modificacion_presupuestaria_monto_check", sql`monto <> 0`),
]);

export const compra = pgTable("compra", {
	id: serial().primaryKey().notNull(),
	ordenId: integer("orden_id").notNull(),
	tiendaId: integer("tienda_id"),
	proveedor: text().notNull(),
	tipoDocumento: tipoDocumento("tipo_documento").default('factura').notNull(),
	numeroDocumento: text("numero_documento"),
	fechaCompra: date("fecha_compra").default(sql`CURRENT_DATE`).notNull(),
	montoTotal: integer("monto_total").notNull(),
	registradaPor: integer("registrada_por").notNull(),
	observaciones: text(),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_compra_orden").using("btree", table.ordenId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.ordenId],
			foreignColumns: [ordenCompra.id],
			name: "compra_orden_id_fkey"
		}),
	foreignKey({
			columns: [table.tiendaId],
			foreignColumns: [tienda.id],
			name: "compra_tienda_id_fkey"
		}),
	foreignKey({
			columns: [table.registradaPor],
			foreignColumns: [usuario.id],
			name: "compra_registrada_por_fkey"
		}),
	check("compra_monto_total_check", sql`monto_total >= 0`),
]);

export const recepcion = pgTable("recepcion", {
	id: serial().primaryKey().notNull(),
	ordenId: integer("orden_id").notNull(),
	recibidoPor: integer("recibido_por").notNull(),
	fechaRecepcion: date("fecha_recepcion").default(sql`CURRENT_DATE`).notNull(),
	conforme: boolean().default(true).notNull(),
	observaciones: text(),
}, (table) => [
	foreignKey({
			columns: [table.ordenId],
			foreignColumns: [ordenCompra.id],
			name: "recepcion_orden_id_fkey"
		}),
	foreignKey({
			columns: [table.recibidoPor],
			foreignColumns: [usuario.id],
			name: "recepcion_recibido_por_fkey"
		}),
	unique("recepcion_orden_id_key").on(table.ordenId),
]);

export const adjunto = pgTable("adjunto", {
	id: serial().primaryKey().notNull(),
	entidad: text().notNull(),
	entidadId: integer("entidad_id").notNull(),
	tipo: tipoAdjunto().notNull(),
	nombre: text().notNull(),
	url: text().notNull(),
	subidoPor: integer("subido_por").notNull(),
	subidoEn: timestamp("subido_en", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_adjunto_entidad").using("btree", table.entidad.asc().nullsLast().op("int4_ops"), table.entidadId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.subidoPor],
			foreignColumns: [usuario.id],
			name: "adjunto_subido_por_fkey"
		}),
	check("adjunto_entidad_check", sql`entidad = ANY (ARRAY['linea_presupuesto'::text, 'solicitud_compra'::text, 'orden_compra'::text, 'compra'::text])`),
]);

export const notificacion = pgTable("notificacion", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	usuarioId: integer("usuario_id").notNull(),
	titulo: text().notNull(),
	mensaje: text(),
	enlace: text(),
	leida: boolean().default(false).notNull(),
	creadaEn: timestamp("creada_en", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_notificacion_usuario").using("btree", table.usuarioId.asc().nullsLast().op("bool_ops"), table.leida.asc().nullsLast().op("int4_ops"), table.creadaEn.desc().nullsFirst().op("bool_ops")),
	foreignKey({
			columns: [table.usuarioId],
			foreignColumns: [usuario.id],
			name: "notificacion_usuario_id_fkey"
		}),
]);

export const bitacora = pgTable("bitacora", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	usuarioId: integer("usuario_id"),
	entidad: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	entidadId: bigint("entidad_id", { mode: "number" }).notNull(),
	accion: accionBitacora().notNull(),
	datosAntes: jsonb("datos_antes"),
	datosDespues: jsonb("datos_despues"),
	ocurridoEn: timestamp("ocurrido_en", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_bitacora_entidad").using("btree", table.entidad.asc().nullsLast().op("int8_ops"), table.entidadId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.usuarioId],
			foreignColumns: [usuario.id],
			name: "bitacora_usuario_id_fkey"
		}),
]);

export const folioContador = pgTable("folio_contador", {
	anioId: integer("anio_id").notNull(),
	prefijo: text().notNull(),
	ultimo: integer().default(0).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.anioId],
			foreignColumns: [anioPresupuestario.id],
			name: "folio_contador_anio_id_fkey"
		}),
	primaryKey({ columns: [table.anioId, table.prefijo], name: "folio_contador_pkey"}),
]);
export const vwPrecioVigente = pgView("vw_precio_vigente", {	productoTiendaId: integer("producto_tienda_id"),
	articuloId: integer("articulo_id"),
	tiendaId: integer("tienda_id"),
	tienda: text(),
	producto: text(),
	marca: text(),
	url: text(),
	precio: integer(),
	conIva: boolean("con_iva"),
	precioConIva: integer("precio_con_iva"),
	stock: integer(),
	observadoEn: timestamp("observado_en", { withTimezone: true, mode: 'string' }),
}).as(sql`SELECT DISTINCT ON (pt.id) pt.id AS producto_tienda_id, pt.articulo_id, t.id AS tienda_id, t.nombre AS tienda, pt.nombre AS producto, pt.marca, pt.url, po.precio, COALESCE(po.con_iva, t.precios_con_iva) AS con_iva, CASE WHEN COALESCE(po.con_iva, t.precios_con_iva, true) THEN po.precio ELSE round(po.precio::numeric * 1.19)::integer END AS precio_con_iva, po.stock, po.observado_en FROM producto_tienda pt JOIN tienda t ON t.id = pt.tienda_id AND t.activa JOIN precio_observado po ON po.producto_tienda_id = pt.id WHERE pt.activo ORDER BY pt.id, po.observado_en DESC, po.id DESC`);

export const vwCatalogoArticulo = pgView("vw_catalogo_articulo", {	articuloId: integer("articulo_id"),
	nombre: text(),
	descripcion: text(),
	unidad: text(),
	categoriaId: integer("categoria_id"),
	categoria: text(),
	cuentaContableId: integer("cuenta_contable_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	ofertas: bigint({ mode: "number" }),
	precioMin: integer("precio_min"),
	precioMax: integer("precio_max"),
	precioReferencia: integer("precio_referencia"),
	actualizadoEn: timestamp("actualizado_en", { withTimezone: true, mode: 'string' }),
}).as(sql`SELECT a.id AS articulo_id, a.nombre, a.descripcion, a.unidad, c.id AS categoria_id, c.nombre AS categoria, c.cuenta_contable_id, count(pv.producto_tienda_id) AS ofertas, min(pv.precio_con_iva) AS precio_min, max(pv.precio_con_iva) AS precio_max, round(percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (pv.precio_con_iva::double precision)))::integer AS precio_referencia, max(pv.observado_en) AS actualizado_en FROM articulo a JOIN categoria_articulo c ON c.id = a.categoria_id LEFT JOIN vw_precio_vigente pv ON pv.articulo_id = a.id WHERE a.activo GROUP BY a.id, c.id`);

export const vwPresupuestoDepartamento = pgView("vw_presupuesto_departamento", {	colegioId: integer("colegio_id"),
	departamentoId: integer("departamento_id"),
	departamento: text(),
	centroCosto: text("centro_costo"),
	anioId: integer("anio_id"),
	anio: smallint(),
	etapa: etapaAnio(),
	presupuestoId: integer("presupuesto_id"),
	estado: estadoPresupuesto(),
	enviadoEn: timestamp("enviado_en", { withTimezone: true, mode: 'string' }),
	resueltoEn: timestamp("resuelto_en", { withTimezone: true, mode: 'string' }),
	comentarioDireccion: text("comentario_direccion"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	programas: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	lineas: bigint({ mode: "number" }),
	formulado: numeric(),
	fueraCatalogo: numeric("fuera_catalogo"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	montoAprobado: bigint("monto_aprobado", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	modificaciones: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	vigente: bigint({ mode: "number" }),
}).as(sql`WITH lineas AS ( SELECT p.presupuesto_id, count(DISTINCT p.id) AS programas, count(l_1.id) AS lineas, COALESCE(sum(l_1.subtotal), 0::numeric) AS formulado, COALESCE(sum(l_1.subtotal) FILTER (WHERE l_1.articulo_id IS NULL), 0::numeric) AS fuera_catalogo FROM programa p LEFT JOIN linea_presupuesto l_1 ON l_1.programa_id = p.id GROUP BY p.presupuesto_id ), modificaciones AS ( SELECT modificacion_presupuestaria.presupuesto_id, sum(modificacion_presupuestaria.monto) AS modificaciones FROM modificacion_presupuestaria GROUP BY modificacion_presupuestaria.presupuesto_id ) SELECT d.colegio_id, d.id AS departamento_id, d.nombre AS departamento, d.centro_costo, ap.id AS anio_id, ap.anio, ap.etapa, pd.id AS presupuesto_id, pd.estado, pd.enviado_en, pd.resuelto_en, pd.comentario_direccion, COALESCE(l.programas, 0::bigint) AS programas, COALESCE(l.lineas, 0::bigint) AS lineas, COALESCE(l.formulado, 0::numeric) AS formulado, COALESCE(l.fuera_catalogo, 0::numeric) AS fuera_catalogo, pd.monto_aprobado, COALESCE(m.modificaciones, 0::bigint) AS modificaciones, CASE WHEN pd.estado = 'aprobado'::estado_presupuesto THEN pd.monto_aprobado + COALESCE(m.modificaciones, 0::bigint) ELSE 0::bigint END AS vigente FROM departamento d JOIN anio_presupuestario ap ON ap.colegio_id = d.colegio_id LEFT JOIN presupuesto_departamento pd ON pd.departamento_id = d.id AND pd.anio_id = ap.id LEFT JOIN lineas l ON l.presupuesto_id = pd.id LEFT JOIN modificaciones m ON m.presupuesto_id = pd.id WHERE d.activo`);

export const vwSaldoDepartamento = pgView("vw_saldo_departamento", {	colegioId: integer("colegio_id"),
	departamentoId: integer("departamento_id"),
	departamento: text(),
	centroCosto: text("centro_costo"),
	anioId: integer("anio_id"),
	anio: smallint(),
	presupuestoId: integer("presupuesto_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	aprobado: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	modificaciones: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	vigente: bigint({ mode: "number" }),
	comprometido: numeric(),
	ejecutado: numeric(),
	disponible: numeric(),
	enPendiente: numeric("en_pendiente"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	pendientes: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	gastoReal: bigint("gasto_real", { mode: "number" }),
	desviacion: numeric(),
	pctUsado: numeric("pct_usado"),
	pctEjecutado: numeric("pct_ejecutado"),
}).as(sql`WITH ordenes AS ( SELECT orden_compra.presupuesto_id, COALESCE(sum(orden_compra.monto_presupuesto) FILTER (WHERE orden_compra.estado = 'emitida'::estado_orden), 0::numeric) AS comprometido, COALESCE(sum(orden_compra.monto_presupuesto) FILTER (WHERE orden_compra.estado = ANY (ARRAY['comprada'::estado_orden, 'recibida'::estado_orden])), 0::numeric) AS ejecutado, COALESCE(sum(orden_compra.monto_presupuesto) FILTER (WHERE orden_compra.estado = 'pendiente_direccion'::estado_orden), 0::numeric) AS en_pendiente, count(*) FILTER (WHERE orden_compra.estado = 'pendiente_direccion'::estado_orden) AS pendientes FROM orden_compra GROUP BY orden_compra.presupuesto_id ), reales AS ( SELECT oc.presupuesto_id, sum(c.monto_total) AS gasto_real, sum(c.monto_total) FILTER (WHERE oc.estado = ANY (ARRAY['comprada'::estado_orden, 'recibida'::estado_orden])) AS real_ejecutado FROM compra c JOIN orden_compra oc ON oc.id = c.orden_id GROUP BY oc.presupuesto_id ) SELECT v.colegio_id, v.departamento_id, v.departamento, v.centro_costo, v.anio_id, v.anio, v.presupuesto_id, v.monto_aprobado AS aprobado, v.modificaciones, v.vigente, COALESCE(o.comprometido, 0::numeric) AS comprometido, COALESCE(o.ejecutado, 0::numeric) AS ejecutado, v.vigente::numeric - COALESCE(o.comprometido, 0::numeric) - COALESCE(o.ejecutado, 0::numeric) AS disponible, COALESCE(o.en_pendiente, 0::numeric) AS en_pendiente, COALESCE(o.pendientes, 0::bigint) AS pendientes, COALESCE(r.gasto_real, 0::bigint) AS gasto_real, COALESCE(r.real_ejecutado, 0::bigint)::numeric - COALESCE(o.ejecutado, 0::numeric) AS desviacion, round(100.0 * (COALESCE(o.comprometido, 0::numeric) + COALESCE(o.ejecutado, 0::numeric)) / NULLIF(v.vigente, 0)::numeric, 1) AS pct_usado, round(100.0 * COALESCE(o.ejecutado, 0::numeric) / NULLIF(v.vigente, 0)::numeric, 1) AS pct_ejecutado FROM vw_presupuesto_departamento v LEFT JOIN ordenes o ON o.presupuesto_id = v.presupuesto_id LEFT JOIN reales r ON r.presupuesto_id = v.presupuesto_id WHERE v.estado = 'aprobado'::estado_presupuesto`);

export const vwProyeccionMensual = pgView("vw_proyeccion_mensual", {	presupuestoId: integer("presupuesto_id"),
	colegioId: integer("colegio_id"),
	departamentoId: integer("departamento_id"),
	departamento: text(),
	anioId: integer("anio_id"),
	anio: smallint(),
	estado: estadoPresupuesto(),
	mes: smallint(),
	monto: numeric(),
}).as(sql`SELECT pd.id AS presupuesto_id, d.colegio_id, d.id AS departamento_id, d.nombre AS departamento, ap.id AS anio_id, ap.anio, pd.estado, lc.mes, sum(lc.cantidad::bigint * l.precio_unitario) AS monto FROM linea_calendario lc JOIN linea_presupuesto l ON l.id = lc.linea_id JOIN programa p ON p.id = l.programa_id JOIN presupuesto_departamento pd ON pd.id = p.presupuesto_id JOIN departamento d ON d.id = pd.departamento_id JOIN anio_presupuestario ap ON ap.id = pd.anio_id GROUP BY pd.id, d.id, ap.id, lc.mes`);

export const vwCalendarizacionLinea = pgView("vw_calendarizacion_linea", {	lineaId: integer("linea_id"),
	programaId: integer("programa_id"),
	presupuestoId: integer("presupuesto_id"),
	cantidad: integer(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	cantidadConMes: bigint("cantidad_con_mes", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	cantidadSinMes: bigint("cantidad_sin_mes", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	montoSinMes: bigint("monto_sin_mes", { mode: "number" }),
}).as(sql`SELECT l.id AS linea_id, l.programa_id, p.presupuesto_id, l.cantidad, COALESCE(sum(lc.cantidad), 0::bigint) AS cantidad_con_mes, l.cantidad - COALESCE(sum(lc.cantidad), 0::bigint) AS cantidad_sin_mes, (l.cantidad - COALESCE(sum(lc.cantidad), 0::bigint)) * l.precio_unitario AS monto_sin_mes FROM linea_presupuesto l JOIN programa p ON p.id = l.programa_id LEFT JOIN linea_calendario lc ON lc.linea_id = l.id GROUP BY l.id, p.id`);

export const vwConsolidadoColegio = pgView("vw_consolidado_colegio", {	colegioId: integer("colegio_id"),
	colegio: text(),
	anioId: integer("anio_id"),
	anio: smallint(),
	vigente: numeric(),
	comprometido: numeric(),
	ejecutado: numeric(),
	disponible: numeric(),
	gastoReal: numeric("gasto_real"),
	desviacion: numeric(),
	pctUsado: numeric("pct_usado"),
}).as(sql`SELECT c.id AS colegio_id, c.nombre AS colegio, s.anio_id, s.anio, sum(s.vigente) AS vigente, sum(s.comprometido) AS comprometido, sum(s.ejecutado) AS ejecutado, sum(s.disponible) AS disponible, sum(s.gasto_real) AS gasto_real, sum(s.desviacion) AS desviacion, round(100.0 * (sum(s.comprometido) + sum(s.ejecutado)) / NULLIF(sum(s.vigente), 0::numeric), 1) AS pct_usado FROM vw_saldo_departamento s JOIN colegio c ON c.id = s.colegio_id GROUP BY c.id, s.anio_id, s.anio`);