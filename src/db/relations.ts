import { relations } from "drizzle-orm/relations";
import { colegio, anioPresupuestario, usuario, departamento, rolAsignado, cuentaContable, categoriaArticulo, articulo, tienda, productoTienda, precioObservado, presupuestoDepartamento, programa, lineaPresupuesto, lineaCalendario, ordenCompra, itemOrden, pendientePedido, modificacionPresupuestaria, compra, recepcion, adjunto, notificacion, bitacora, folioContador } from "./schema";

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
	ordenCompras: many(ordenCompra),
	modificacionPresupuestarias: many(modificacionPresupuestaria),
}));

export const programaRelations = relations(programa, ({one, many}) => ({
	presupuestoDepartamento: one(presupuestoDepartamento, {
		fields: [programa.presupuestoId],
		references: [presupuestoDepartamento.id]
	}),
	usuario: one(usuario, {
		fields: [programa.creadoPor],
		references: [usuario.id]
	}),
	lineaPresupuestos: many(lineaPresupuesto),
}));

export const lineaCalendarioRelations = relations(lineaCalendario, ({one}) => ({
	lineaPresupuesto: one(lineaPresupuesto, {
		fields: [lineaCalendario.lineaId],
		references: [lineaPresupuesto.id]
	}),
}));

export const lineaPresupuestoRelations = relations(lineaPresupuesto, ({one, many}) => ({
	lineaCalendarios: many(lineaCalendario),
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
	itemOrdens: many(itemOrden),
}));

export const ordenCompraRelations = relations(ordenCompra, ({one, many}) => ({
	presupuestoDepartamento: one(presupuestoDepartamento, {
		fields: [ordenCompra.presupuestoId],
		references: [presupuestoDepartamento.id]
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