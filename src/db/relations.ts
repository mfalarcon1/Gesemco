import { relations } from "drizzle-orm/relations";
import { colegio, anioPresupuestario, usuario, departamento, asignatura, rolAsignado, profesorAsignatura, presupuesto, movimientoPresupuesto, ordenCompra, proveedor, itemOrden, categoriaGasto, solicitudExcepcion, adjunto, recepcion, bitacora, folioContador } from "./schema";

export const anioPresupuestarioRelations = relations(anioPresupuestario, ({one, many}) => ({
	colegio: one(colegio, {
		fields: [anioPresupuestario.colegioId],
		references: [colegio.id]
	}),
	profesorAsignaturas: many(profesorAsignatura),
	presupuestos: many(presupuesto),
	ordenCompras: many(ordenCompra),
	folioContadors: many(folioContador),
}));

export const colegioRelations = relations(colegio, ({many}) => ({
	anioPresupuestarios: many(anioPresupuestario),
	usuarios: many(usuario),
	departamentos: many(departamento),
}));

export const usuarioRelations = relations(usuario, ({one, many}) => ({
	colegio: one(colegio, {
		fields: [usuario.colegioId],
		references: [colegio.id]
	}),
	departamentos: many(departamento),
	rolAsignados: many(rolAsignado),
	profesorAsignaturas: many(profesorAsignatura),
	presupuestos: many(presupuesto),
	movimientoPresupuestos: many(movimientoPresupuesto),
	ordenCompras_solicitanteId: many(ordenCompra, {
		relationName: "ordenCompra_solicitanteId_usuario_id"
	}),
	ordenCompras_aprobadorId: many(ordenCompra, {
		relationName: "ordenCompra_aprobadorId_usuario_id"
	}),
	solicitudExcepcions: many(solicitudExcepcion),
	adjuntos: many(adjunto),
	recepcions: many(recepcion),
	bitacoras: many(bitacora),
}));

export const departamentoRelations = relations(departamento, ({one, many}) => ({
	colegio: one(colegio, {
		fields: [departamento.colegioId],
		references: [colegio.id]
	}),
	usuario: one(usuario, {
		fields: [departamento.jefeUsuarioId],
		references: [usuario.id]
	}),
	asignaturas: many(asignatura),
}));

export const asignaturaRelations = relations(asignatura, ({one, many}) => ({
	departamento: one(departamento, {
		fields: [asignatura.departamentoId],
		references: [departamento.id]
	}),
	profesorAsignaturas: many(profesorAsignatura),
	presupuestos: many(presupuesto),
	ordenCompras: many(ordenCompra),
}));

export const rolAsignadoRelations = relations(rolAsignado, ({one}) => ({
	usuario: one(usuario, {
		fields: [rolAsignado.usuarioId],
		references: [usuario.id]
	}),
}));

export const profesorAsignaturaRelations = relations(profesorAsignatura, ({one}) => ({
	usuario: one(usuario, {
		fields: [profesorAsignatura.usuarioId],
		references: [usuario.id]
	}),
	asignatura: one(asignatura, {
		fields: [profesorAsignatura.asignaturaId],
		references: [asignatura.id]
	}),
	anioPresupuestario: one(anioPresupuestario, {
		fields: [profesorAsignatura.anioId],
		references: [anioPresupuestario.id]
	}),
}));

export const presupuestoRelations = relations(presupuesto, ({one, many}) => ({
	asignatura: one(asignatura, {
		fields: [presupuesto.asignaturaId],
		references: [asignatura.id]
	}),
	anioPresupuestario: one(anioPresupuestario, {
		fields: [presupuesto.anioId],
		references: [anioPresupuestario.id]
	}),
	usuario: one(usuario, {
		fields: [presupuesto.asignadoPor],
		references: [usuario.id]
	}),
	movimientoPresupuestos_presupuestoOrigenId: many(movimientoPresupuesto, {
		relationName: "movimientoPresupuesto_presupuestoOrigenId_presupuesto_id"
	}),
	movimientoPresupuestos_presupuestoDestinoId: many(movimientoPresupuesto, {
		relationName: "movimientoPresupuesto_presupuestoDestinoId_presupuesto_id"
	}),
	ordenCompras: many(ordenCompra),
}));

export const movimientoPresupuestoRelations = relations(movimientoPresupuesto, ({one}) => ({
	presupuesto_presupuestoOrigenId: one(presupuesto, {
		fields: [movimientoPresupuesto.presupuestoOrigenId],
		references: [presupuesto.id],
		relationName: "movimientoPresupuesto_presupuestoOrigenId_presupuesto_id"
	}),
	presupuesto_presupuestoDestinoId: one(presupuesto, {
		fields: [movimientoPresupuesto.presupuestoDestinoId],
		references: [presupuesto.id],
		relationName: "movimientoPresupuesto_presupuestoDestinoId_presupuesto_id"
	}),
	usuario: one(usuario, {
		fields: [movimientoPresupuesto.autorizadoPor],
		references: [usuario.id]
	}),
}));

export const ordenCompraRelations = relations(ordenCompra, ({one, many}) => ({
	asignatura: one(asignatura, {
		fields: [ordenCompra.asignaturaId],
		references: [asignatura.id]
	}),
	anioPresupuestario: one(anioPresupuestario, {
		fields: [ordenCompra.anioId],
		references: [anioPresupuestario.id]
	}),
	usuario_solicitanteId: one(usuario, {
		fields: [ordenCompra.solicitanteId],
		references: [usuario.id],
		relationName: "ordenCompra_solicitanteId_usuario_id"
	}),
	proveedor: one(proveedor, {
		fields: [ordenCompra.proveedorId],
		references: [proveedor.id]
	}),
	usuario_aprobadorId: one(usuario, {
		fields: [ordenCompra.aprobadorId],
		references: [usuario.id],
		relationName: "ordenCompra_aprobadorId_usuario_id"
	}),
	presupuesto: one(presupuesto, {
		fields: [ordenCompra.asignaturaId],
		references: [presupuesto.asignaturaId]
	}),
	itemOrdens: many(itemOrden),
	solicitudExcepcions: many(solicitudExcepcion),
	adjuntos: many(adjunto),
	recepcions: many(recepcion),
}));

export const proveedorRelations = relations(proveedor, ({many}) => ({
	ordenCompras: many(ordenCompra),
}));

export const itemOrdenRelations = relations(itemOrden, ({one}) => ({
	ordenCompra: one(ordenCompra, {
		fields: [itemOrden.ordenId],
		references: [ordenCompra.id]
	}),
	categoriaGasto: one(categoriaGasto, {
		fields: [itemOrden.categoriaGastoId],
		references: [categoriaGasto.id]
	}),
}));

export const categoriaGastoRelations = relations(categoriaGasto, ({many}) => ({
	itemOrdens: many(itemOrden),
}));

export const solicitudExcepcionRelations = relations(solicitudExcepcion, ({one}) => ({
	ordenCompra: one(ordenCompra, {
		fields: [solicitudExcepcion.ordenId],
		references: [ordenCompra.id]
	}),
	usuario: one(usuario, {
		fields: [solicitudExcepcion.resueltoPor],
		references: [usuario.id]
	}),
}));

export const adjuntoRelations = relations(adjunto, ({one}) => ({
	ordenCompra: one(ordenCompra, {
		fields: [adjunto.ordenId],
		references: [ordenCompra.id]
	}),
	usuario: one(usuario, {
		fields: [adjunto.subidoPor],
		references: [usuario.id]
	}),
}));

export const recepcionRelations = relations(recepcion, ({one}) => ({
	ordenCompra: one(ordenCompra, {
		fields: [recepcion.ordenId],
		references: [ordenCompra.id]
	}),
	usuario: one(usuario, {
		fields: [recepcion.recibidoPor],
		references: [usuario.id]
	}),
}));

export const bitacoraRelations = relations(bitacora, ({one}) => ({
	usuario: one(usuario, {
		fields: [bitacora.usuarioId],
		references: [usuario.id]
	}),
}));

export const folioContadorRelations = relations(folioContador, ({one}) => ({
	anioPresupuestario: one(anioPresupuestario, {
		fields: [folioContador.anioId],
		references: [anioPresupuestario.id]
	}),
}));