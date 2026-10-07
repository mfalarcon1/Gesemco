import { relations } from "drizzle-orm/relations";
import { colegio, anioPresupuestario, usuario, departamento, rolAsignado, cuentaContable, categoriaArticulo, articulo, tienda, productoTienda, precioObservado, presupuestoDepartamento, programa, lineaPresupuesto, periodo, solicitudCompra, itemSolicitud, ordenCompra, itemOrden, pendientePedido, modificacionPresupuestaria, compra, recepcion, adjunto, notificacion, bitacora, folioContador } from "./schema";

export const anioPresupuestarioRelations = relations(anioPresupuestario, ({one, many}) => ({
	colegio: one(colegio, {
		fields: [anioPresupuestario.colegioId],
		references: [colegio.id]
	}),
	presupuestoDepartamentos: many(presupuestoDepartamento),
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
	rolAsignados: many(rolAsignado),
	presupuestoDepartamentos_resueltoDireccionPor: many(presupuestoDepartamento, {
		relationName: "presupuestoDepartamento_resueltoDireccionPor_usuario_id"
	}),
	presupuestoDepartamentos_resueltoContabilidadPor: many(presupuestoDepartamento, {
		relationName: "presupuestoDepartamento_resueltoContabilidadPor_usuario_id"
	}),
	programas: many(programa),
	solicitudCompras_solicitanteId: many(solicitudCompra, {
		relationName: "solicitudCompra_solicitanteId_usuario_id"
	}),
	solicitudCompras_resueltoPor: many(solicitudCompra, {
		relationName: "solicitudCompra_resueltoPor_usuario_id"
	}),
	ordenCompras: many(ordenCompra),
	pendientePedidos: many(pendientePedido),
	modificacionPresupuestarias: many(modificacionPresupuestaria),
	compras: many(compra),
	recepcions: many(recepcion),
	adjuntos: many(adjunto),
	notificacions: many(notificacion),
	bitacoras: many(bitacora),
}));

export const departamentoRelations = relations(departamento, ({one, many}) => ({
	colegio: one(colegio, {
		fields: [departamento.colegioId],
		references: [colegio.id]
	}),
	rolAsignados: many(rolAsignado),
	presupuestoDepartamentos: many(presupuestoDepartamento),
}));

export const rolAsignadoRelations = relations(rolAsignado, ({one}) => ({
	usuario: one(usuario, {
		fields: [rolAsignado.usuarioId],
		references: [usuario.id]
	}),
	departamento: one(departamento, {
		fields: [rolAsignado.departamentoId],
		references: [departamento.id]
	}),
}));

export const categoriaArticuloRelations = relations(categoriaArticulo, ({one, many}) => ({
	cuentaContable: one(cuentaContable, {
		fields: [categoriaArticulo.cuentaContableId],
		references: [cuentaContable.id]
	}),
	articulos: many(articulo),
}));

export const cuentaContableRelations = relations(cuentaContable, ({many}) => ({
	categoriaArticulos: many(categoriaArticulo),
	lineaPresupuestos: many(lineaPresupuesto),
	itemOrdens: many(itemOrden),
}));

export const articuloRelations = relations(articulo, ({one, many}) => ({
	categoriaArticulo: one(categoriaArticulo, {
		fields: [articulo.categoriaId],
		references: [categoriaArticulo.id]
	}),
	productoTiendas: many(productoTienda),
	lineaPresupuestos: many(lineaPresupuesto),
	itemSolicituds: many(itemSolicitud),
	itemOrdens: many(itemOrden),
}));

export const productoTiendaRelations = relations(productoTienda, ({one, many}) => ({
	tienda: one(tienda, {
		fields: [productoTienda.tiendaId],
		references: [tienda.id]
	}),
	articulo: one(articulo, {
		fields: [productoTienda.articuloId],
		references: [articulo.id]
	}),
	precioObservados: many(precioObservado),
}));

export const tiendaRelations = relations(tienda, ({many}) => ({
	productoTiendas: many(productoTienda),
	compras: many(compra),
}));

export const precioObservadoRelations = relations(precioObservado, ({one}) => ({
	productoTienda: one(productoTienda, {
		fields: [precioObservado.productoTiendaId],
		references: [productoTienda.id]
	}),
}));

export const presupuestoDepartamentoRelations = relations(presupuestoDepartamento, ({one, many}) => ({
	departamento: one(departamento, {
		fields: [presupuestoDepartamento.departamentoId],
		references: [departamento.id]
	}),
	anioPresupuestario: one(anioPresupuestario, {
		fields: [presupuestoDepartamento.anioId],
		references: [anioPresupuestario.id]
	}),
	usuario_resueltoDireccionPor: one(usuario, {
		fields: [presupuestoDepartamento.resueltoDireccionPor],
		references: [usuario.id],
		relationName: "presupuestoDepartamento_resueltoDireccionPor_usuario_id"
	}),
	usuario_resueltoContabilidadPor: one(usuario, {
		fields: [presupuestoDepartamento.resueltoContabilidadPor],
		references: [usuario.id],
		relationName: "presupuestoDepartamento_resueltoContabilidadPor_usuario_id"
	}),
	programas: many(programa),
	solicitudCompras: many(solicitudCompra),
	ordenCompras: many(ordenCompra),
	modificacionPresupuestarias: many(modificacionPresupuestaria),
}));

export const lineaPresupuestoRelations = relations(lineaPresupuesto, ({one, many}) => ({
	programa: one(programa, {
		fields: [lineaPresupuesto.programaId],
		references: [programa.id]
	}),
	articulo: one(articulo, {
		fields: [lineaPresupuesto.articuloId],
		references: [articulo.id]
	}),
	cuentaContable: one(cuentaContable, {
		fields: [lineaPresupuesto.cuentaContableId],
		references: [cuentaContable.id]
	}),
	itemSolicituds: many(itemSolicitud),
	itemOrdens: many(itemOrden),
}));

export const programaRelations = relations(programa, ({one, many}) => ({
	lineaPresupuestos: many(lineaPresupuesto),
	presupuestoDepartamento: one(presupuestoDepartamento, {
		fields: [programa.presupuestoId],
		references: [presupuestoDepartamento.id]
	}),
	periodo: one(periodo, {
		fields: [programa.periodo],
		references: [periodo.numero]
	}),
	usuario: one(usuario, {
		fields: [programa.creadoPor],
		references: [usuario.id]
	}),
}));

export const periodoRelations = relations(periodo, ({many}) => ({
	programas: many(programa),
}));

export const solicitudCompraRelations = relations(solicitudCompra, ({one, many}) => ({
	presupuestoDepartamento: one(presupuestoDepartamento, {
		fields: [solicitudCompra.presupuestoId],
		references: [presupuestoDepartamento.id]
	}),
	usuario_solicitanteId: one(usuario, {
		fields: [solicitudCompra.solicitanteId],
		references: [usuario.id],
		relationName: "solicitudCompra_solicitanteId_usuario_id"
	}),
	usuario_resueltoPor: one(usuario, {
		fields: [solicitudCompra.resueltoPor],
		references: [usuario.id],
		relationName: "solicitudCompra_resueltoPor_usuario_id"
	}),
	itemSolicituds: many(itemSolicitud),
	ordenCompras: many(ordenCompra),
}));

export const itemSolicitudRelations = relations(itemSolicitud, ({one}) => ({
	solicitudCompra: one(solicitudCompra, {
		fields: [itemSolicitud.solicitudId],
		references: [solicitudCompra.id]
	}),
	lineaPresupuesto: one(lineaPresupuesto, {
		fields: [itemSolicitud.lineaId],
		references: [lineaPresupuesto.id]
	}),
	articulo: one(articulo, {
		fields: [itemSolicitud.articuloId],
		references: [articulo.id]
	}),
}));

export const ordenCompraRelations = relations(ordenCompra, ({one, many}) => ({
	presupuestoDepartamento: one(presupuestoDepartamento, {
		fields: [ordenCompra.presupuestoId],
		references: [presupuestoDepartamento.id]
	}),
	solicitudCompra: one(solicitudCompra, {
		fields: [ordenCompra.solicitudId],
		references: [solicitudCompra.id]
	}),
	usuario: one(usuario, {
		fields: [ordenCompra.emitidaPor],
		references: [usuario.id]
	}),
	itemOrdens: many(itemOrden),
	pendientePedidos: many(pendientePedido),
	compras: many(compra),
	recepcions: many(recepcion),
}));

export const itemOrdenRelations = relations(itemOrden, ({one}) => ({
	ordenCompra: one(ordenCompra, {
		fields: [itemOrden.ordenId],
		references: [ordenCompra.id]
	}),
	lineaPresupuesto: one(lineaPresupuesto, {
		fields: [itemOrden.lineaId],
		references: [lineaPresupuesto.id]
	}),
	articulo: one(articulo, {
		fields: [itemOrden.articuloId],
		references: [articulo.id]
	}),
	cuentaContable: one(cuentaContable, {
		fields: [itemOrden.cuentaContableId],
		references: [cuentaContable.id]
	}),
}));

export const pendientePedidoRelations = relations(pendientePedido, ({one, many}) => ({
	ordenCompra: one(ordenCompra, {
		fields: [pendientePedido.ordenId],
		references: [ordenCompra.id]
	}),
	usuario: one(usuario, {
		fields: [pendientePedido.resueltoPor],
		references: [usuario.id]
	}),
	modificacionPresupuestarias: many(modificacionPresupuestaria),
}));

export const modificacionPresupuestariaRelations = relations(modificacionPresupuestaria, ({one}) => ({
	presupuestoDepartamento: one(presupuestoDepartamento, {
		fields: [modificacionPresupuestaria.presupuestoId],
		references: [presupuestoDepartamento.id]
	}),
	pendientePedido: one(pendientePedido, {
		fields: [modificacionPresupuestaria.pendienteId],
		references: [pendientePedido.id]
	}),
	usuario: one(usuario, {
		fields: [modificacionPresupuestaria.autorizadoPor],
		references: [usuario.id]
	}),
}));

export const compraRelations = relations(compra, ({one}) => ({
	ordenCompra: one(ordenCompra, {
		fields: [compra.ordenId],
		references: [ordenCompra.id]
	}),
	tienda: one(tienda, {
		fields: [compra.tiendaId],
		references: [tienda.id]
	}),
	usuario: one(usuario, {
		fields: [compra.registradaPor],
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

export const adjuntoRelations = relations(adjunto, ({one}) => ({
	usuario: one(usuario, {
		fields: [adjunto.subidoPor],
		references: [usuario.id]
	}),
}));

export const notificacionRelations = relations(notificacion, ({one}) => ({
	usuario: one(usuario, {
		fields: [notificacion.usuarioId],
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