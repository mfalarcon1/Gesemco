-- =====================================================================
--  GESEMCO · Sistema de gestión presupuestaria escolar
--  Esquema relacional · PostgreSQL 15 o superior
--  v0.4 · 8 de octubre de 2026 · meses y pedidos del jefe
--
--  Etapa 1, formulación: octubre del año anterior para armar el
--  presupuesto y noviembre para aprobarlo. Cada departamento arma sus
--  programas con líneas de artículos (del catálogo tipo marketplace o
--  líneas libres) e indica cuántas unidades de cada línea usará en cada
--  mes. Dirección aprueba o devuelve; después contabilidad aprueba o
--  envía reparos, que el jefe corrige y reenvía directo a contabilidad.
--  Lo aprobado, mes a mes, es la proyección de caja que recibe GESEMCO.
--
--  Etapa 2, ejecución. El jefe de departamento pide lo que necesita, con
--  la fecha en que lo necesita (al menos una semana después). Si el
--  pedido cabe en el disponible del departamento, pasa a orden de compra
--  y descuenta a precio presupuesto; si no, espera a Dirección, que
--  puede extender el presupuesto o denegarlo. El equipo de compra compra
--  primero lo que se necesita antes y anota lo que pagó; el jefe confirma
--  que llegó. Los meses son una guía: el control es el total del año.
--
--  Convenciones:
--    · Montos en pesos chilenos, enteros y con IVA incluido. Nunca float.
--    · El saldo se calcula en vistas; nunca se guarda en una columna.
--    · colegio_id viaja en toda tabla raíz aunque hoy valga siempre 1.
--    · Las reglas de negocio viven acá (constraints y triggers). La
--      aplicación no las duplica: hace la operación y muestra el error.
--    · Quién actúa: al inicio de cada transacción la aplicación hace
--          SELECT set_config('app.usuario_id', '7', true);
--      La bitácora, las resoluciones y las notificaciones lo leen de ahí.
--    · Las fechas "de hoy" son las de Chile (America/Santiago), aunque el
--      servidor esté en otra zona horaria.
--
--  Orden de ejecución: este archivo completo, de una vez, sobre una
--  base vacía. Los datos de prueba están en db/datos_prueba.sql y las
--  pruebas de las reglas en db/pruebas.sql.
-- =====================================================================

BEGIN;

-- La base vive en la hora de Chile. Las bases en la nube vienen en UTC y
-- ahí CURRENT_DATE (fechas por defecto, roles vigentes) saltaría al día
-- siguiente en la noche. Rige para las conexiones que se abran después.
DO $$
BEGIN
    EXECUTE format('ALTER DATABASE %I SET timezone = %L', current_database(), 'America/Santiago');
END
$$;

-- ---------------------------------------------------------------------
-- 0. Tipos enumerados
-- ---------------------------------------------------------------------

CREATE TYPE etapa_anio         AS ENUM ('formulacion', 'ejecucion', 'cerrado');

CREATE TYPE rol_sistema        AS ENUM ('jefe_departamento', 'direccion', 'contabilidad',
                                        'equipo_compra', 'administrador');

CREATE TYPE estado_presupuesto AS ENUM ('borrador', 'enviado', 'devuelto',
                                        'revision_contabilidad', 'con_reparos', 'aprobado');

CREATE TYPE estado_orden       AS ENUM ('borrador', 'pendiente_direccion', 'emitida',
                                        'denegada', 'comprada', 'recibida', 'anulada');

CREATE TYPE estado_pendiente   AS ENUM ('pendiente', 'aprobado', 'denegado', 'retirado');

CREATE TYPE plataforma_tienda  AS ENUM ('vtex', 'woocommerce', 'shopify', 'jumpseller',
                                        'mercado_publico', 'manual');

CREATE TYPE tipo_documento     AS ENUM ('factura', 'boleta', 'otro');

CREATE TYPE tipo_adjunto       AS ENUM ('cotizacion', 'factura', 'boleta', 'orden_firmada', 'otro');

CREATE TYPE accion_bitacora    AS ENUM ('crear', 'actualizar', 'cambiar_estado', 'eliminar');


-- ---------------------------------------------------------------------
-- 1. Estructura del colegio
-- ---------------------------------------------------------------------

CREATE TABLE colegio (
    id                 serial       PRIMARY KEY,
    nombre             text         NOT NULL,
    rbd                text         NOT NULL UNIQUE,
    direccion          text,
    comuna             text,
    anticipacion_dias  smallint     NOT NULL DEFAULT 7,
    activo             boolean      NOT NULL DEFAULT true,
    creado_en          timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT ck_anticipacion CHECK (anticipacion_dias BETWEEN 0 AND 60)
);

COMMENT ON TABLE colegio IS
    'Establecimiento educacional administrado por GESEMCO. RBD = rol base de datos del Mineduc.';
COMMENT ON COLUMN colegio.anticipacion_dias IS
    'Con cuánta anticipación se piden las compras: la fecha en que se necesita un pedido debe ser al menos esta cantidad de días después del día en que se pide.';


CREATE TABLE anio_presupuestario (
    id                 serial      PRIMARY KEY,
    colegio_id         integer     NOT NULL REFERENCES colegio (id),
    anio               smallint    NOT NULL,
    etapa              etapa_anio  NOT NULL DEFAULT 'formulacion',
    fecha_apertura     date        NOT NULL DEFAULT CURRENT_DATE,
    formulacion_hasta  date,
    aprobacion_hasta   date,
    fecha_cierre       date,

    CONSTRAINT uq_anio_colegio      UNIQUE (colegio_id, anio),
    CONSTRAINT ck_anio_rango        CHECK (anio BETWEEN 2020 AND 2100),
    CONSTRAINT ck_anio_cierre       CHECK ((etapa = 'cerrado') = (fecha_cierre IS NOT NULL)),
    CONSTRAINT ck_anio_plazo        CHECK (formulacion_hasta IS NULL OR formulacion_hasta >= fecha_apertura),
    CONSTRAINT ck_anio_aprobacion   CHECK (aprobacion_hasta IS NULL OR formulacion_hasta IS NULL
                                           OR aprobacion_hasta >= formulacion_hasta)
);

COMMENT ON TABLE anio_presupuestario IS
    'formulacion: los departamentos arman su presupuesto, Dirección y contabilidad lo aprueban. ejecucion: se pide y se compra contra lo aprobado. cerrado: inmutable. Mientras se ejecuta un año se formula el siguiente, así que conviven dos años abiertos.';
COMMENT ON COLUMN anio_presupuestario.formulacion_hasta IS
    'Hasta cuándo se arma el presupuesto: fines de octubre del año anterior. Informativo; no bloquea nada.';
COMMENT ON COLUMN anio_presupuestario.aprobacion_hasta IS
    'Hasta cuándo lo aprueban Dirección y contabilidad: fines de noviembre del año anterior. Informativo; no bloquea nada.';


CREATE TABLE usuario (
    id          serial       PRIMARY KEY,
    colegio_id  integer      NOT NULL REFERENCES colegio (id),
    nombre      text         NOT NULL,
    email       text         NOT NULL,
    rut         text,
    activo      boolean      NOT NULL DEFAULT true,
    creado_en   timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT ck_usuario_rut CHECK (rut IS NULL OR rut ~ '^[0-9]{7,8}-[0-9kK]$')
);

-- El correo identifica al usuario sin importar mayúsculas.
CREATE UNIQUE INDEX uq_usuario_email ON usuario (lower(email));
CREATE UNIQUE INDEX uq_usuario_rut   ON usuario (rut) WHERE rut IS NOT NULL;


CREATE TABLE departamento (
    id            serial   PRIMARY KEY,
    colegio_id    integer  NOT NULL REFERENCES colegio (id),
    nombre        text     NOT NULL,
    centro_costo  text,
    activo        boolean  NOT NULL DEFAULT true,

    CONSTRAINT uq_departamento_nombre UNIQUE (colegio_id, nombre)
);

COMMENT ON TABLE departamento IS
    'Área del colegio con jefe propio: matemática, arte, biblioteca… Es la unidad presupuestaria: el saldo se controla contra su total anual.';
COMMENT ON COLUMN departamento.centro_costo IS
    'Código del centro de costo en la contabilidad de GESEMCO. Provisorio hasta recibir su plan de cuentas.';


-- ---------------------------------------------------------------------
-- 2. Personas y permisos
-- ---------------------------------------------------------------------

CREATE TABLE rol_asignado (
    id               serial       PRIMARY KEY,
    usuario_id       integer      NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
    rol              rol_sistema  NOT NULL,
    departamento_id  integer      REFERENCES departamento (id),
    desde            date         NOT NULL DEFAULT CURRENT_DATE,
    hasta            date,

    CONSTRAINT uq_rol UNIQUE NULLS NOT DISTINCT (usuario_id, rol, departamento_id),
    -- El jefe pertenece a un departamento; los demás roles valen para
    -- todo el colegio del usuario.
    CONSTRAINT ck_rol_ambito CHECK ((rol = 'jefe_departamento') = (departamento_id IS NOT NULL)),
    CONSTRAINT ck_vigencia CHECK (hasta IS NULL OR hasta >= desde)
);

-- Un solo jefe vigente por departamento.
CREATE UNIQUE INDEX uq_un_jefe_vigente ON rol_asignado (departamento_id)
    WHERE rol = 'jefe_departamento' AND hasta IS NULL;

COMMENT ON TABLE rol_asignado IS
    'Los permisos salen de acá, nunca del nombre de la persona. Los profesores no usan el sistema: lo que necesita un departamento lo pide su jefe.';


-- ---------------------------------------------------------------------
-- 3. Catálogo tipo marketplace
--
--    articulo           Lo genérico: "Cuaderno universitario 100 hojas".
--    producto_tienda    Lo que publica cada tienda. Lo carga el scraper.
--    precio_observado   Cada pasada del scraper agrega una fila, nunca
--                       actualiza. Así queda el histórico de precios.
-- ---------------------------------------------------------------------

CREATE TABLE cuenta_contable (
    id      serial   PRIMARY KEY,
    codigo  text     NOT NULL UNIQUE,
    nombre  text     NOT NULL,
    activa  boolean  NOT NULL DEFAULT true
);

COMMENT ON TABLE cuenta_contable IS
    'Plan de cuentas de GESEMCO para imputar cada línea y cada compra. Los códigos de los datos de prueba son provisorios.';


CREATE TABLE categoria_articulo (
    id                  serial    PRIMARY KEY,
    nombre              text      NOT NULL UNIQUE,
    cuenta_contable_id  integer   REFERENCES cuenta_contable (id),
    orden               smallint  NOT NULL DEFAULT 0
);

COMMENT ON COLUMN categoria_articulo.cuenta_contable_id IS
    'Cuenta por defecto para las líneas de artículos de esta categoría.';


CREATE TABLE articulo (
    id            serial       PRIMARY KEY,
    nombre        text         NOT NULL,
    descripcion   text,
    unidad        text         NOT NULL DEFAULT 'unidad',
    categoria_id  integer      NOT NULL REFERENCES categoria_articulo (id),
    activo        boolean      NOT NULL DEFAULT true,
    creado_en     timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_articulo_nombre ON articulo (lower(nombre));


CREATE TABLE tienda (
    id               serial             PRIMARY KEY,
    nombre           text               NOT NULL UNIQUE,
    url              text,
    plataforma       plataforma_tienda  NOT NULL DEFAULT 'manual',
    precios_con_iva  boolean,
    activa           boolean            NOT NULL DEFAULT true
);

COMMENT ON COLUMN tienda.precios_con_iva IS
    'true: publica precios con IVA. false: netos. null: no lo indica, y se asume con IVA.';


CREATE TABLE producto_tienda (
    id           serial       PRIMARY KEY,
    tienda_id    integer      NOT NULL REFERENCES tienda (id),
    sku          text         NOT NULL,
    nombre       text         NOT NULL,
    marca        text,
    url          text,
    articulo_id  integer      REFERENCES articulo (id),
    activo       boolean      NOT NULL DEFAULT true,
    creado_en    timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT uq_producto_tienda UNIQUE (tienda_id, sku)
);

COMMENT ON COLUMN producto_tienda.articulo_id IS
    'A qué artículo genérico corresponde. Null = el scraper lo trajo pero nadie lo ha clasificado todavía.';


CREATE TABLE precio_observado (
    id                  bigserial    PRIMARY KEY,
    producto_tienda_id  integer      NOT NULL REFERENCES producto_tienda (id) ON DELETE CASCADE,
    precio              integer      NOT NULL CHECK (precio > 0),
    con_iva             boolean,
    stock               integer,
    observado_en        timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON COLUMN precio_observado.con_iva IS
    'Null = se hereda de tienda.precios_con_iva.';


-- ---------------------------------------------------------------------
-- 4. Etapa 1 · Formulación
-- ---------------------------------------------------------------------

CREATE TABLE presupuesto_departamento (
    id                         serial              PRIMARY KEY,
    departamento_id            integer             NOT NULL REFERENCES departamento (id),
    anio_id                    integer             NOT NULL REFERENCES anio_presupuestario (id),
    estado                     estado_presupuesto  NOT NULL DEFAULT 'borrador',
    monto_aprobado             bigint              CHECK (monto_aprobado >= 0),
    enviado_en                 timestamptz,
    resuelto_direccion_en      timestamptz,
    resuelto_direccion_por     integer             REFERENCES usuario (id),
    comentario_direccion       text,
    resuelto_contabilidad_en   timestamptz,
    resuelto_contabilidad_por  integer             REFERENCES usuario (id),
    comentario_contabilidad    text,
    creado_en                  timestamptz         NOT NULL DEFAULT now(),

    CONSTRAINT uq_presupuesto_depto_anio UNIQUE (departamento_id, anio_id),
    -- El monto aprobado existe si y solo si el presupuesto está aprobado.
    CONSTRAINT ck_aprobado_congelado CHECK ((estado = 'aprobado') = (monto_aprobado IS NOT NULL)),
    -- Dirección siempre explica por qué devuelve.
    CONSTRAINT ck_devuelto_con_comentario CHECK (
        estado <> 'devuelto' OR nullif(btrim(comentario_direccion), '') IS NOT NULL
    ),
    -- Contabilidad siempre dice qué hay que corregir.
    CONSTRAINT ck_reparos_con_comentario CHECK (
        estado <> 'con_reparos' OR nullif(btrim(comentario_contabilidad), '') IS NOT NULL
    )
);

COMMENT ON TABLE presupuesto_departamento IS
    'Presupuesto anual de un departamento. borrador → enviado (Dirección lo revisa) → revision_contabilidad → aprobado. Dirección puede devolverlo (enviado → devuelto → enviado) y contabilidad enviar reparos (revision_contabilidad → con_reparos → revision_contabilidad, sin volver a Dirección). El jefe puede retirar un envío a Dirección (enviado → borrador). Para enviarlo, cada ítem debe tener sus meses. Lo aprueba contabilidad: ahí se congela monto_aprobado y lo que venga después son modificaciones presupuestarias.';
COMMENT ON COLUMN presupuesto_departamento.enviado_en IS
    'Último envío del jefe: a Dirección o, después de reparos, a contabilidad.';


CREATE TABLE programa (
    id              serial       PRIMARY KEY,
    presupuesto_id  integer      NOT NULL REFERENCES presupuesto_departamento (id) ON DELETE CASCADE,
    nombre          text         NOT NULL,
    descripcion     text,
    creado_por      integer      REFERENCES usuario (id),
    creado_en       timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_programa_nombre ON programa (presupuesto_id, lower(nombre));

COMMENT ON TABLE programa IS
    'Lo que el departamento hará en el año (una olimpiada, una salida, el material de las clases), con lo que necesita en sus líneas.';


CREATE TABLE linea_presupuesto (
    id                  serial       PRIMARY KEY,
    programa_id         integer      NOT NULL REFERENCES programa (id) ON DELETE CASCADE,
    articulo_id         integer      REFERENCES articulo (id),
    descripcion         text         NOT NULL,
    cantidad            integer      NOT NULL CHECK (cantidad > 0),
    precio_unitario     integer      NOT NULL CHECK (precio_unitario >= 0),
    -- El subtotal se calcula, nunca se ingresa a mano.
    subtotal            bigint       GENERATED ALWAYS AS (cantidad::bigint * precio_unitario) STORED,
    fuera_catalogo      boolean      GENERATED ALWAYS AS (articulo_id IS NULL) STORED,
    cuenta_contable_id  integer      REFERENCES cuenta_contable (id),
    origen_precio       text,
    creado_en           timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON COLUMN linea_presupuesto.articulo_id IS
    'Null = línea libre (servicios, artículos que el catálogo no tiene). Queda marcada como fuera de catálogo.';
COMMENT ON COLUMN linea_presupuesto.precio_unitario IS
    'Precio presupuesto, con IVA. Se congela al agregar la línea: si el catálogo cambia después, la línea no se mueve.';
COMMENT ON COLUMN linea_presupuesto.origen_precio IS
    'De dónde salió el precio, para quien revise: "Mediana de 3 ofertas al 24-09-2026", "Cotización del proveedor", "Ajustado por el jefe".';


CREATE TABLE linea_calendario (
    id        serial    PRIMARY KEY,
    linea_id  integer   NOT NULL REFERENCES linea_presupuesto (id) ON DELETE CASCADE,
    mes       smallint  NOT NULL CHECK (mes BETWEEN 1 AND 12),
    cantidad  integer   NOT NULL CHECK (cantidad > 0),

    CONSTRAINT uq_linea_mes UNIQUE (linea_id, mes)
);

COMMENT ON TABLE linea_calendario IS
    'Cuántas unidades de la línea se usarán en cada mes. Las indica el jefe al armar el presupuesto: la suma no puede pasar la cantidad de la línea, y para enviarlo todas las unidades deben tener su mes. Es una guía para la caja de GESEMCO: durante el año se puede pedir antes, después o más en un mes, mientras el total quepa en el presupuesto.';


-- ---------------------------------------------------------------------
-- 5. Etapa 2 · Ejecución
-- ---------------------------------------------------------------------

CREATE TABLE orden_compra (
    id                 serial        PRIMARY KEY,
    folio              text          NOT NULL UNIQUE,
    presupuesto_id     integer       NOT NULL REFERENCES presupuesto_departamento (id),
    emitida_por        integer       NOT NULL REFERENCES usuario (id),
    estado             estado_orden  NOT NULL DEFAULT 'borrador',
    necesaria_para     date          NOT NULL,
    monto_presupuesto  bigint        NOT NULL DEFAULT 0 CHECK (monto_presupuesto >= 0),
    fecha_emision      timestamptz,
    observacion        text,
    creado_en          timestamptz   NOT NULL DEFAULT now(),
    actualizado_en     timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE orden_compra IS
    'Un pedido del jefe de departamento. Si cabe en el disponible pasa a orden de compra (emitida) para el equipo de compra; si no, espera a Dirección como solicitud para extender el presupuesto.';
COMMENT ON COLUMN orden_compra.necesaria_para IS
    'Para cuándo se necesita. Al pedir, debe ser al menos colegio.anticipacion_dias después del día del pedido (creado_en) y del año del presupuesto. El equipo de compra compra primero lo que se necesita antes.';
COMMENT ON COLUMN orden_compra.monto_presupuesto IS
    'Suma de los ítems a precio presupuesto. Es lo que descuenta del saldo del departamento, aunque la compra real cueste otra cosa. Lo mantiene un trigger.';
COMMENT ON COLUMN orden_compra.estado IS
    'borrador → emitida (cabe en el disponible) o pendiente_direccion (no cabe). pendiente_direccion → emitida o denegada, según resuelva Dirección, o anulada si el jefe la retira. emitida → comprada (al registrar la compra) → recibida (al confirmar la recepción). borrador o emitida → anulada.';


CREATE TABLE item_orden (
    id                  serial   PRIMARY KEY,
    orden_id            integer  NOT NULL REFERENCES orden_compra (id) ON DELETE CASCADE,
    linea_id            integer  REFERENCES linea_presupuesto (id),
    articulo_id         integer  REFERENCES articulo (id),
    descripcion         text     NOT NULL,
    cantidad            integer  NOT NULL CHECK (cantidad > 0),
    precio_presupuesto  integer  NOT NULL CHECK (precio_presupuesto >= 0),
    subtotal            bigint   GENERATED ALWAYS AS (cantidad::bigint * precio_presupuesto) STORED,
    no_planificado      boolean  GENERATED ALWAYS AS (linea_id IS NULL) STORED,
    cuenta_contable_id  integer  REFERENCES cuenta_contable (id)
);

COMMENT ON COLUMN item_orden.linea_id IS
    'La línea del presupuesto que se pide. Se puede pedir cualquier cantidad: lo que se controla es el total del año del departamento.';
COMMENT ON COLUMN item_orden.no_planificado IS
    'No estaba en el presupuesto del departamento. Se pide igual: si cabe en el disponible pasa a compra; contabilidad lo ve marcado.';


CREATE TABLE pendiente_pedido (
    id                    serial            PRIMARY KEY,
    orden_id              integer           NOT NULL UNIQUE
                                            REFERENCES orden_compra (id) ON DELETE CASCADE,
    monto_excedido        bigint            NOT NULL CHECK (monto_excedido > 0),
    disponible_al_emitir  bigint            NOT NULL,
    estado                estado_pendiente  NOT NULL DEFAULT 'pendiente',
    resuelto_por          integer           REFERENCES usuario (id),
    resuelto_en           timestamptz,
    explicacion           text,
    creado_en             timestamptz       NOT NULL DEFAULT now(),

    CONSTRAINT ck_pendiente_resolucion CHECK (
        (estado = 'pendiente') = (resuelto_por IS NULL AND resuelto_en IS NULL)
    ),
    -- Si Dirección deniega, el jefe recibe la explicación.
    CONSTRAINT ck_denegado_con_explicacion CHECK (
        estado <> 'denegado' OR nullif(btrim(explicacion), '') IS NOT NULL
    )
);

COMMENT ON TABLE pendiente_pedido IS
    'La solicitud a Dirección para extender el presupuesto, cuando un pedido no cabe. Dirección la aprueba (sube el presupuesto en lo que falte y el pedido pasa a compra) o la deniega con una explicación. Si el jefe anula el pedido antes, queda retirada.';
COMMENT ON COLUMN pendiente_pedido.monto_excedido IS
    'Cuánto faltaba al momento de pedir. Se congela: si después entra plata, el registro sigue contando la historia real.';


CREATE TABLE modificacion_presupuestaria (
    id              serial       PRIMARY KEY,
    presupuesto_id  integer      NOT NULL REFERENCES presupuesto_departamento (id),
    monto           integer      NOT NULL CHECK (monto <> 0),
    motivo          text         NOT NULL,
    pendiente_id    integer      UNIQUE REFERENCES pendiente_pedido (id),
    autorizado_por  integer      NOT NULL REFERENCES usuario (id),
    creado_en       timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE modificacion_presupuestaria IS
    'Explica por qué el vigente no es el aprobado. Positivo = aumento (por ejemplo, una extensión aprobada por Dirección); negativo = recorte.';


CREATE TABLE compra (
    id                serial          PRIMARY KEY,
    orden_id          integer         NOT NULL REFERENCES orden_compra (id),
    tienda_id         integer         REFERENCES tienda (id),
    proveedor         text            NOT NULL,
    tipo_documento    tipo_documento  NOT NULL DEFAULT 'factura',
    numero_documento  text,
    fecha_compra      date            NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santiago')::date,
    monto_total       integer         NOT NULL CHECK (monto_total >= 0),
    registrada_por    integer         NOT NULL REFERENCES usuario (id),
    observaciones     text,
    creado_en         timestamptz     NOT NULL DEFAULT now()
);

COMMENT ON TABLE compra IS
    'Lo que el equipo de compra pagó de verdad, con IVA. La primera compra de un pedido lo marca comprado; puede haber más (despachos parciales, dos proveedores). No toca el saldo: alimenta la desviación que ve contabilidad.';


CREATE TABLE recepcion (
    id               serial   PRIMARY KEY,
    orden_id         integer  NOT NULL UNIQUE REFERENCES orden_compra (id),
    recibido_por     integer  NOT NULL REFERENCES usuario (id),
    fecha_recepcion  date     NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santiago')::date,
    conforme         boolean  NOT NULL DEFAULT true,
    observaciones    text
);

COMMENT ON TABLE recepcion IS
    'El jefe confirma que llegó lo comprado, y si llegó bien. Marca el pedido recibido.';


-- ---------------------------------------------------------------------
-- 6. Trazabilidad
-- ---------------------------------------------------------------------

CREATE TABLE adjunto (
    id          serial        PRIMARY KEY,
    entidad     text          NOT NULL CHECK (entidad IN ('linea_presupuesto', 'orden_compra', 'compra')),
    entidad_id  integer       NOT NULL,
    tipo        tipo_adjunto  NOT NULL,
    nombre      text          NOT NULL,
    url         text          NOT NULL,
    subido_por  integer       NOT NULL REFERENCES usuario (id),
    subido_en   timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE adjunto IS
    'Cotizaciones de líneas libres, facturas de compras. entidad + entidad_id es polimórfico y por eso no lleva clave foránea.';


CREATE TABLE notificacion (
    id          bigserial    PRIMARY KEY,
    usuario_id  integer      NOT NULL REFERENCES usuario (id),
    titulo      text         NOT NULL,
    mensaje     text,
    enlace      text,
    leida       boolean      NOT NULL DEFAULT false,
    creada_en   timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE notificacion IS
    'Avisos dentro de la app. Los generan los triggers de cada cambio de estado; el correo se agrega después leyendo esta tabla.';


CREATE TABLE bitacora (
    id             bigserial        PRIMARY KEY,
    usuario_id     integer          REFERENCES usuario (id),
    entidad        text             NOT NULL,
    entidad_id     bigint           NOT NULL,
    accion         accion_bitacora  NOT NULL,
    datos_antes    jsonb,
    datos_despues  jsonb,
    ocurrido_en    timestamptz      NOT NULL DEFAULT now()
);

-- La bitácora es solo inserción, ni siquiera para el administrador.
REVOKE UPDATE, DELETE ON bitacora FROM PUBLIC;


-- Tabla auxiliar, no es una entidad del modelo: genera los folios
-- correlativos sin la condición de carrera de un COUNT(*) + 1.
CREATE TABLE folio_contador (
    anio_id  integer  NOT NULL REFERENCES anio_presupuestario (id),
    prefijo  text     NOT NULL,
    ultimo   integer  NOT NULL DEFAULT 0,

    PRIMARY KEY (anio_id, prefijo)
);


-- ---------------------------------------------------------------------
-- 7. Índices
-- ---------------------------------------------------------------------

CREATE INDEX ix_rol_usuario            ON rol_asignado (usuario_id);
CREATE INDEX ix_rol_departamento       ON rol_asignado (departamento_id);
CREATE INDEX ix_articulo_categoria     ON articulo (categoria_id);
CREATE INDEX ix_producto_articulo      ON producto_tienda (articulo_id);
CREATE INDEX ix_precio_producto_fecha  ON precio_observado (producto_tienda_id, observado_en DESC);
CREATE INDEX ix_presupuesto_anio       ON presupuesto_departamento (anio_id);
CREATE INDEX ix_programa_presupuesto   ON programa (presupuesto_id);
CREATE INDEX ix_linea_programa         ON linea_presupuesto (programa_id);
CREATE INDEX ix_linea_articulo         ON linea_presupuesto (articulo_id);
CREATE INDEX ix_orden_presupuesto      ON orden_compra (presupuesto_id, estado);
CREATE INDEX ix_orden_necesaria        ON orden_compra (estado, necesaria_para);
CREATE INDEX ix_item_orden             ON item_orden (orden_id);
CREATE INDEX ix_item_orden_linea       ON item_orden (linea_id);
CREATE INDEX ix_modificacion_pres      ON modificacion_presupuestaria (presupuesto_id);
CREATE INDEX ix_compra_orden           ON compra (orden_id);
CREATE INDEX ix_adjunto_entidad        ON adjunto (entidad, entidad_id);
CREATE INDEX ix_notificacion_usuario   ON notificacion (usuario_id, leida, creada_en DESC);
CREATE INDEX ix_bitacora_entidad       ON bitacora (entidad, entidad_id);


-- ---------------------------------------------------------------------
-- 8. Vistas
--
--    Decisión de arquitectura: el saldo se calcula, no se guarda. Un
--    campo saldo almacenado se desincroniza tarde o temprano y después
--    nadie sabe cuál número es el bueno. Si el rendimiento llega a
--    molestar, esto pasa a vista materializada, nunca a columna.
-- ---------------------------------------------------------------------

-- 8.1 Precio vigente de cada producto: su última observación. Los precios
--     netos se llevan a precio con IVA para que todo compare en la misma
--     moneda que el presupuesto.
CREATE VIEW vw_precio_vigente AS
SELECT DISTINCT ON (pt.id)
    pt.id                                                AS producto_tienda_id,
    pt.articulo_id,
    t.id                                                 AS tienda_id,
    t.nombre                                             AS tienda,
    pt.nombre                                            AS producto,
    pt.marca,
    pt.url,
    po.precio,
    COALESCE(po.con_iva, t.precios_con_iva)              AS con_iva,
    CASE WHEN COALESCE(po.con_iva, t.precios_con_iva, true) THEN po.precio
         ELSE round(po.precio * 1.19)::integer END       AS precio_con_iva,
    po.stock,
    po.observado_en
FROM producto_tienda pt
JOIN tienda           t  ON t.id = pt.tienda_id AND t.activa
JOIN precio_observado po ON po.producto_tienda_id = pt.id
WHERE pt.activo
ORDER BY pt.id, po.observado_en DESC, po.id DESC;


-- 8.2 El catálogo que ve el jefe de departamento. El precio de referencia
--     es la mediana de las ofertas vigentes: no se deja llevar por una
--     sola tienda muy barata o muy cara.
CREATE VIEW vw_catalogo_articulo AS
SELECT
    a.id                                                  AS articulo_id,
    a.nombre,
    a.descripcion,
    a.unidad,
    c.id                                                  AS categoria_id,
    c.nombre                                              AS categoria,
    c.cuenta_contable_id,
    count(pv.producto_tienda_id)                          AS ofertas,
    min(pv.precio_con_iva)                                AS precio_min,
    max(pv.precio_con_iva)                                AS precio_max,
    round(percentile_cont(0.5) WITHIN GROUP (ORDER BY pv.precio_con_iva))::integer
                                                          AS precio_referencia,
    max(pv.observado_en)                                  AS actualizado_en
FROM articulo a
JOIN categoria_articulo c ON c.id = a.categoria_id
LEFT JOIN vw_precio_vigente pv ON pv.articulo_id = a.id
WHERE a.activo
GROUP BY a.id, c.id;


-- 8.3 Cuánto de cada línea ya tiene mes. Para enviar el presupuesto,
--     cantidad_sin_mes tiene que ser 0 en todas sus líneas.
CREATE VIEW vw_calendarizacion_linea AS
SELECT
    l.id                                                        AS linea_id,
    l.programa_id,
    p.presupuesto_id,
    l.cantidad,
    COALESCE(sum(lc.cantidad), 0)                               AS cantidad_con_mes,
    l.cantidad - COALESCE(sum(lc.cantidad), 0)                  AS cantidad_sin_mes,
    (l.cantidad - COALESCE(sum(lc.cantidad), 0))::bigint * l.precio_unitario
                                                                AS monto_sin_mes
FROM linea_presupuesto l
JOIN programa p ON p.id = l.programa_id
LEFT JOIN linea_calendario lc ON lc.linea_id = l.id
GROUP BY l.id, p.id;


-- 8.4 Estado de la formulación de cada departamento en cada año. Incluye
--     los departamentos que todavía no empiezan (estado null).
CREATE VIEW vw_presupuesto_departamento AS
WITH lineas AS (
    SELECT p.presupuesto_id,
           count(DISTINCT p.id)                                           AS programas,
           count(l.id)                                                    AS lineas,
           COALESCE(sum(l.subtotal), 0)                                   AS formulado,
           COALESCE(sum(l.subtotal) FILTER (WHERE l.articulo_id IS NULL), 0) AS fuera_catalogo
      FROM programa p
      LEFT JOIN linea_presupuesto l ON l.programa_id = p.id
     GROUP BY p.presupuesto_id
), sin_mes AS (
    SELECT presupuesto_id,
           count(*) FILTER (WHERE cantidad_sin_mes > 0)  AS lineas_sin_mes,
           COALESCE(sum(monto_sin_mes), 0)               AS monto_sin_mes
      FROM vw_calendarizacion_linea
     GROUP BY presupuesto_id
), modificaciones AS (
    SELECT presupuesto_id, sum(monto) AS modificaciones
      FROM modificacion_presupuestaria
     GROUP BY presupuesto_id
)
SELECT
    d.colegio_id,
    d.id                                AS departamento_id,
    d.nombre                            AS departamento,
    d.centro_costo,
    ap.id                               AS anio_id,
    ap.anio,
    ap.etapa,
    ap.formulacion_hasta,
    ap.aprobacion_hasta,
    pd.id                               AS presupuesto_id,
    pd.estado,
    pd.enviado_en,
    pd.resuelto_direccion_en,
    pd.comentario_direccion,
    pd.resuelto_contabilidad_en,
    pd.comentario_contabilidad,
    -- Desde cuándo lo tiene contabilidad: desde que lo aprobó Dirección o
    -- desde que el jefe lo reenvió con los reparos corregidos.
    CASE WHEN pd.estado = 'revision_contabilidad'
         THEN GREATEST(pd.resuelto_direccion_en, pd.enviado_en) END
                                        AS en_contabilidad_desde,
    COALESCE(l.programas, 0)            AS programas,
    COALESCE(l.lineas, 0)               AS lineas,
    COALESCE(s.lineas_sin_mes, 0)       AS lineas_sin_mes,
    COALESCE(s.monto_sin_mes, 0)        AS monto_sin_mes,
    COALESCE(l.formulado, 0)            AS formulado,
    COALESCE(l.fuera_catalogo, 0)       AS fuera_catalogo,
    pd.monto_aprobado,
    COALESCE(m.modificaciones, 0)       AS modificaciones,
    CASE WHEN pd.estado = 'aprobado'
         THEN pd.monto_aprobado + COALESCE(m.modificaciones, 0)
         ELSE 0 END                     AS vigente
FROM departamento d
JOIN anio_presupuestario ap ON ap.colegio_id = d.colegio_id
LEFT JOIN presupuesto_departamento pd ON pd.departamento_id = d.id AND pd.anio_id = ap.id
LEFT JOIN lineas         l ON l.presupuesto_id = pd.id
LEFT JOIN sin_mes        s ON s.presupuesto_id = pd.id
LEFT JOIN modificaciones m ON m.presupuesto_id = pd.id
WHERE d.activo;

COMMENT ON VIEW vw_presupuesto_departamento IS
    'estado null = el departamento todavía no empieza su formulación. lineas_sin_mes = ítems a los que les faltan meses: con alguno no se puede enviar. vigente = aprobado + modificaciones, y vale 0 mientras no esté aprobado.';


-- 8.5 El saldo de la ejecución, siempre a precio presupuesto.
--       comprometido  pedidos por comprar (emitidos)
--       ejecutado     pedidos comprados o recibidos
--       disponible    vigente − comprometido − ejecutado
--     Los pedidos que esperan a Dirección no tocan el saldo: si Dirección
--     aprueba, primero aumenta el presupuesto y recién ahí pasan a compra.
CREATE VIEW vw_saldo_departamento AS
WITH ordenes AS (
    SELECT presupuesto_id,
           COALESCE(sum(monto_presupuesto) FILTER (WHERE estado = 'emitida'), 0)                  AS comprometido,
           COALESCE(sum(monto_presupuesto) FILTER (WHERE estado IN ('comprada', 'recibida')), 0) AS ejecutado,
           COALESCE(sum(monto_presupuesto) FILTER (WHERE estado = 'pendiente_direccion'), 0)      AS en_pendiente,
           count(*) FILTER (WHERE estado = 'pendiente_direccion')                                 AS pendientes
      FROM orden_compra
     GROUP BY presupuesto_id
), reales AS (
    SELECT oc.presupuesto_id,
           sum(c.monto_total)                                                     AS gasto_real,
           sum(c.monto_total) FILTER (WHERE oc.estado IN ('comprada', 'recibida')) AS real_ejecutado
      FROM compra c
      JOIN orden_compra oc ON oc.id = c.orden_id
     GROUP BY oc.presupuesto_id
)
SELECT
    v.colegio_id,
    v.departamento_id,
    v.departamento,
    v.centro_costo,
    v.anio_id,
    v.anio,
    v.presupuesto_id,
    v.monto_aprobado                                                   AS aprobado,
    v.modificaciones,
    v.vigente,
    COALESCE(o.comprometido, 0)                                        AS comprometido,
    COALESCE(o.ejecutado, 0)                                           AS ejecutado,
    v.vigente - COALESCE(o.comprometido, 0) - COALESCE(o.ejecutado, 0) AS disponible,
    COALESCE(o.en_pendiente, 0)                                        AS en_pendiente,
    COALESCE(o.pendientes, 0)                                          AS pendientes,
    COALESCE(r.gasto_real, 0)                                          AS gasto_real,
    COALESCE(r.real_ejecutado, 0) - COALESCE(o.ejecutado, 0)           AS desviacion,
    round(100.0 * (COALESCE(o.comprometido, 0) + COALESCE(o.ejecutado, 0))
          / NULLIF(v.vigente, 0), 1)                                   AS pct_usado,
    round(100.0 * COALESCE(o.ejecutado, 0) / NULLIF(v.vigente, 0), 1)  AS pct_ejecutado
FROM vw_presupuesto_departamento v
LEFT JOIN ordenes o ON o.presupuesto_id = v.presupuesto_id
LEFT JOIN reales  r ON r.presupuesto_id = v.presupuesto_id
WHERE v.estado = 'aprobado';

COMMENT ON VIEW vw_saldo_departamento IS
    'desviacion = lo pagado de verdad por los pedidos comprados − lo que esos pedidos descontaron a precio presupuesto. Positiva: se pagó más de lo presupuestado.';


-- 8.6 Mes a mes de cada presupuesto: lo planificado al formular (los meses
--     de cada línea por su precio) y lo pedido durante el año (los pedidos
--     que pasaron a compra, en el mes en que se necesitan). Las doce filas
--     de cada presupuesto existen siempre, aunque valgan cero. Incluye
--     todos los estados: la aplicación decide si muestra solo lo aprobado.
CREATE VIEW vw_mes_departamento AS
WITH meses AS (
    SELECT generate_series(1, 12)::smallint AS mes
), plan AS (
    SELECT p.presupuesto_id, lc.mes, sum(lc.cantidad::bigint * l.precio_unitario) AS monto
      FROM linea_calendario lc
      JOIN linea_presupuesto l ON l.id = lc.linea_id
      JOIN programa          p ON p.id = l.programa_id
     GROUP BY p.presupuesto_id, lc.mes
), pedidos AS (
    SELECT presupuesto_id,
           extract(month FROM necesaria_para)::smallint AS mes,
           sum(monto_presupuesto)                        AS monto,
           count(*)                                      AS cantidad
      FROM orden_compra
     WHERE estado IN ('emitida', 'comprada', 'recibida')
     GROUP BY presupuesto_id, extract(month FROM necesaria_para)
)
SELECT
    d.colegio_id,
    d.id                        AS departamento_id,
    d.nombre                    AS departamento,
    d.centro_costo,
    ap.id                       AS anio_id,
    ap.anio,
    pd.id                       AS presupuesto_id,
    pd.estado,
    m.mes,
    COALESCE(pl.monto, 0)       AS planificado,
    COALESCE(pe.monto, 0)       AS pedido,
    COALESCE(pe.cantidad, 0)    AS pedidos
FROM presupuesto_departamento pd
JOIN departamento        d  ON d.id  = pd.departamento_id
JOIN anio_presupuestario ap ON ap.id = pd.anio_id
CROSS JOIN meses m
LEFT JOIN plan    pl ON pl.presupuesto_id = pd.id AND pl.mes = m.mes
LEFT JOIN pedidos pe ON pe.presupuesto_id = pd.id AND pe.mes = m.mes;

COMMENT ON VIEW vw_mes_departamento IS
    'planificado: lo que el jefe indicó para cada mes al formular, a precio presupuesto. pedido: lo que pasó a compra (por comprar, comprado o recibido) para ese mes, según la fecha en que se necesita. Pedir más o menos en un mes no importa mientras el total quepa en el presupuesto: los meses le sirven a GESEMCO para tener el dinero a tiempo.';


-- 8.7 Cuánto se ha pedido de cada línea del presupuesto. Se puede pedir
--     más o menos que lo planificado: es información, no un tope.
CREATE VIEW vw_linea_pedida AS
SELECT
    l.id                                                                          AS linea_id,
    p.presupuesto_id,
    l.cantidad,
    COALESCE(sum(i.cantidad) FILTER (WHERE o.estado IN ('emitida', 'comprada', 'recibida')), 0) AS pedida,
    COALESCE(sum(i.cantidad) FILTER (WHERE o.estado = 'pendiente_direccion'), 0)              AS en_espera
FROM linea_presupuesto l
JOIN programa p ON p.id = l.programa_id
LEFT JOIN item_orden   i ON i.linea_id = l.id
LEFT JOIN orden_compra o ON o.id = i.orden_id
GROUP BY l.id, p.presupuesto_id;


-- 8.8 Cada pedido con lo que hace falta para mostrarlo en una lista: el
--     departamento, sus ítems en una frase, lo pagado, la recepción y la
--     solicitud a Dirección si la hubo. Sin los borradores, que la
--     aplicación crea y pide en la misma transacción.
CREATE VIEW vw_pedido AS
WITH items AS (
    SELECT i.orden_id,
           count(*)                                                              AS items,
           string_agg(i.descripcion || ' × ' || i.cantidad, ', ' ORDER BY i.id)  AS detalle,
           bool_or(i.linea_id IS NULL)                                           AS no_planificado,
           string_agg(DISTINCT cc.codigo || ' ' || cc.nombre, ', ')              AS cuenta
      FROM item_orden i
      LEFT JOIN cuenta_contable cc ON cc.id = i.cuenta_contable_id
     GROUP BY i.orden_id
), compras AS (
    SELECT orden_id,
           sum(monto_total)                                                      AS pagado,
           max(fecha_compra)                                                     AS fecha_compra,
           string_agg(DISTINCT proveedor, ', ')                                  AS proveedor,
           string_agg(initcap(tipo_documento::text) || COALESCE(' ' || numero_documento, ''), ', ' ORDER BY id)
                                                                                 AS documento
      FROM compra
     GROUP BY orden_id
)
SELECT
    o.id                                AS orden_id,
    o.folio,
    o.estado,
    o.necesaria_para,
    o.creado_en                         AS pedido_en,
    o.fecha_emision,
    o.monto_presupuesto                 AS monto,
    o.observacion,
    o.emitida_por,
    u.nombre                            AS pedido_por,
    d.colegio_id,
    d.id                                AS departamento_id,
    d.nombre                            AS departamento,
    d.centro_costo,
    ap.id                               AS anio_id,
    ap.anio,
    o.presupuesto_id,
    COALESCE(i.items, 0)                AS items,
    i.detalle,
    COALESCE(i.no_planificado, false)   AS no_planificado,
    i.cuenta,
    c.pagado,
    c.pagado - o.monto_presupuesto      AS diferencia,
    c.fecha_compra,
    c.proveedor,
    c.documento,
    r.fecha_recepcion,
    r.conforme,
    r.observaciones                     AS observacion_recepcion,
    pp.id                               AS pendiente_id,
    pp.estado                           AS estado_solicitud,
    pp.monto_excedido,
    pp.disponible_al_emitir,
    pp.explicacion,
    pp.resuelto_en,
    m.monto                             AS extension
FROM orden_compra o
JOIN presupuesto_departamento pd ON pd.id = o.presupuesto_id
JOIN departamento             d  ON d.id  = pd.departamento_id
JOIN anio_presupuestario      ap ON ap.id = pd.anio_id
JOIN usuario                  u  ON u.id  = o.emitida_por
LEFT JOIN items                       i  ON i.orden_id = o.id
LEFT JOIN compras                     c  ON c.orden_id = o.id
LEFT JOIN recepcion                   r  ON r.orden_id = o.id
LEFT JOIN pendiente_pedido            pp ON pp.orden_id = o.id
LEFT JOIN modificacion_presupuestaria m  ON m.pendiente_id = pp.id
WHERE o.estado <> 'borrador';

COMMENT ON VIEW vw_pedido IS
    'diferencia = lo pagado − lo presupuestado (null mientras no se compra). extension = lo que Dirección sumó al presupuesto para que el pedido cupiera.';


-- 8.9 El consolidado del colegio que hoy contabilidad arma a mano.
CREATE VIEW vw_consolidado_colegio AS
SELECT
    c.id                  AS colegio_id,
    c.nombre              AS colegio,
    s.anio_id,
    s.anio,
    sum(s.vigente)        AS vigente,
    sum(s.comprometido)   AS comprometido,
    sum(s.ejecutado)      AS ejecutado,
    sum(s.disponible)     AS disponible,
    sum(s.gasto_real)     AS gasto_real,
    sum(s.desviacion)     AS desviacion,
    round(100.0 * (sum(s.comprometido) + sum(s.ejecutado)) / NULLIF(sum(s.vigente), 0), 1)
                          AS pct_usado
FROM vw_saldo_departamento s
JOIN colegio c ON c.id = s.colegio_id
GROUP BY c.id, s.anio_id, s.anio;


-- ---------------------------------------------------------------------
-- 9. Funciones de apoyo
-- ---------------------------------------------------------------------

-- 9.1 Quién actúa, según lo declaró la aplicación en esta transacción.
CREATE FUNCTION fn_usuario_actual() RETURNS integer AS $$
    SELECT NULLIF(current_setting('app.usuario_id', true), '')::integer;
$$ LANGUAGE sql STABLE;


-- 9.2 Pesos chilenos con punto de miles, sin depender del locale de la
--     base: 192700 → '$192.700'. Para los textos de los avisos.
CREATE FUNCTION fn_pesos(p_monto bigint) RETURNS text AS $$
    SELECT CASE WHEN p_monto < 0 THEN '-' ELSE '' END
           || '$' || replace(to_char(abs(p_monto), 'FM999,999,999,999'), ',', '.');
$$ LANGUAGE sql IMMUTABLE;


-- 9.3 El estado de un presupuesto como se dice en la pantalla, para los
--      mensajes de error que ve el usuario.
CREATE FUNCTION fn_nombre_estado(p_estado estado_presupuesto) RETURNS text AS $$
    SELECT CASE p_estado
        WHEN 'borrador'              THEN 'en preparación'
        WHEN 'enviado'               THEN 'en revisión de Dirección'
        WHEN 'devuelto'              THEN 'devuelto por Dirección'
        WHEN 'revision_contabilidad' THEN 'en revisión de contabilidad'
        WHEN 'con_reparos'           THEN 'con reparos de contabilidad'
        WHEN 'aprobado'              THEN 'aprobado'
    END;
$$ LANGUAGE sql IMMUTABLE;


-- 9.4 Lo mismo para un pedido.
CREATE FUNCTION fn_nombre_estado_orden(p_estado estado_orden) RETURNS text AS $$
    SELECT CASE p_estado
        WHEN 'borrador'            THEN 'en borrador'
        WHEN 'pendiente_direccion' THEN 'esperando a Dirección'
        WHEN 'emitida'             THEN 'por comprar'
        WHEN 'denegada'            THEN 'denegado'
        WHEN 'comprada'            THEN 'comprado'
        WHEN 'recibida'            THEN 'recibido'
        WHEN 'anulada'             THEN 'anulado'
    END;
$$ LANGUAGE sql IMMUTABLE;


-- 9.5 Aviso a todos los usuarios vigentes con un rol. Con departamento,
--     solo a los de ese departamento.
CREATE FUNCTION fn_notificar_rol(
    p_colegio_id      integer,
    p_rol             rol_sistema,
    p_departamento_id integer,
    p_titulo          text,
    p_mensaje         text,
    p_enlace          text
) RETURNS void AS $$
    INSERT INTO notificacion (usuario_id, titulo, mensaje, enlace)
    SELECT DISTINCT u.id, p_titulo, p_mensaje, p_enlace
      FROM rol_asignado r
      JOIN usuario u ON u.id = r.usuario_id
     WHERE r.rol = p_rol
       AND u.colegio_id = p_colegio_id
       AND u.activo
       AND (r.hasta IS NULL OR r.hasta >= CURRENT_DATE)
       AND (p_departamento_id IS NULL OR r.departamento_id = p_departamento_id);
$$ LANGUAGE sql;


-- 9.6 Folio correlativo por año y tipo de documento, a prueba de
--     concurrencia: 'OC-2027-0001'.
CREATE FUNCTION fn_folio(p_prefijo text, p_presupuesto_id integer) RETURNS text AS $$
DECLARE
    v_anio_id  integer;
    v_anio     smallint;
    v_n        integer;
BEGIN
    SELECT ap.id, ap.anio INTO v_anio_id, v_anio
      FROM presupuesto_departamento pd
      JOIN anio_presupuestario ap ON ap.id = pd.anio_id
     WHERE pd.id = p_presupuesto_id;

    IF v_anio_id IS NULL THEN
        RAISE EXCEPTION 'No existe el presupuesto %', p_presupuesto_id;
    END IF;

    INSERT INTO folio_contador (anio_id, prefijo, ultimo)
    VALUES (v_anio_id, p_prefijo, 1)
    ON CONFLICT (anio_id, prefijo) DO UPDATE
        SET ultimo = folio_contador.ultimo + 1
    RETURNING ultimo INTO v_n;

    RETURN p_prefijo || '-' || v_anio || '-' || lpad(v_n::text, 4, '0');
END;
$$ LANGUAGE plpgsql;


-- 9.7 A qué año presupuestario pertenece una fila de cualquier tabla del
--     presupuesto. Trabaja sobre jsonb para servir a todas las tablas
--     con una sola función. Devuelve null si no lo puede resolver (por
--     ejemplo, en un borrado en cascada donde el padre ya no existe).
CREATE FUNCTION fn_anio_de_fila(p_tabla text, p_fila jsonb) RETURNS integer AS $$
DECLARE
    v_anio integer;
BEGIN
    IF p_tabla = 'presupuesto_departamento' THEN
        RETURN (p_fila ->> 'anio_id')::integer;
    ELSIF p_fila ? 'presupuesto_id' THEN
        SELECT anio_id INTO v_anio
          FROM presupuesto_departamento WHERE id = (p_fila ->> 'presupuesto_id')::integer;
    ELSIF p_fila ? 'programa_id' THEN
        SELECT pd.anio_id INTO v_anio
          FROM programa p JOIN presupuesto_departamento pd ON pd.id = p.presupuesto_id
         WHERE p.id = (p_fila ->> 'programa_id')::integer;
    ELSIF p_fila ? 'orden_id' THEN
        SELECT pd.anio_id INTO v_anio
          FROM orden_compra o JOIN presupuesto_departamento pd ON pd.id = o.presupuesto_id
         WHERE o.id = (p_fila ->> 'orden_id')::integer;
    ELSIF p_fila ? 'linea_id' THEN
        SELECT pd.anio_id INTO v_anio
          FROM linea_presupuesto l
          JOIN programa p ON p.id = l.programa_id
          JOIN presupuesto_departamento pd ON pd.id = p.presupuesto_id
         WHERE l.id = (p_fila ->> 'linea_id')::integer;
    END IF;
    RETURN v_anio;
END;
$$ LANGUAGE plpgsql STABLE;


-- ---------------------------------------------------------------------
-- 10. Triggers
--
--     PostgreSQL dispara los triggers del mismo evento por orden
--     alfabético del nombre. Por eso los guardias se llaman trg_a_…
--     (corren primero) y los efectos se llaman trg_z_… (corren al final).
-- ---------------------------------------------------------------------

-- 10.1 Un año cerrado es inmutable.
CREATE FUNCTION fn_guardia_anio_cerrado() RETURNS trigger AS $$
DECLARE
    v_fila   jsonb;
    v_etapa  etapa_anio;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_fila := to_jsonb(OLD);
    ELSE
        v_fila := to_jsonb(NEW);
    END IF;

    SELECT etapa INTO v_etapa
      FROM anio_presupuestario
     WHERE id = fn_anio_de_fila(TG_TABLE_NAME, v_fila);

    IF v_etapa = 'cerrado' THEN
        RAISE EXCEPTION 'El año presupuestario está cerrado y no admite cambios'
            USING ERRCODE = 'check_violation';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_a_anio_presupuesto BEFORE INSERT OR UPDATE OR DELETE ON presupuesto_departamento
    FOR EACH ROW EXECUTE FUNCTION fn_guardia_anio_cerrado();
CREATE TRIGGER trg_a_anio_programa BEFORE INSERT OR UPDATE OR DELETE ON programa
    FOR EACH ROW EXECUTE FUNCTION fn_guardia_anio_cerrado();
CREATE TRIGGER trg_a_anio_linea BEFORE INSERT OR UPDATE OR DELETE ON linea_presupuesto
    FOR EACH ROW EXECUTE FUNCTION fn_guardia_anio_cerrado();
CREATE TRIGGER trg_a_anio_calendario BEFORE INSERT OR UPDATE OR DELETE ON linea_calendario
    FOR EACH ROW EXECUTE FUNCTION fn_guardia_anio_cerrado();
CREATE TRIGGER trg_a_anio_modificacion BEFORE INSERT OR UPDATE OR DELETE ON modificacion_presupuestaria
    FOR EACH ROW EXECUTE FUNCTION fn_guardia_anio_cerrado();
CREATE TRIGGER trg_a_anio_orden BEFORE INSERT OR UPDATE OR DELETE ON orden_compra
    FOR EACH ROW EXECUTE FUNCTION fn_guardia_anio_cerrado();
CREATE TRIGGER trg_a_anio_item_orden BEFORE INSERT OR UPDATE OR DELETE ON item_orden
    FOR EACH ROW EXECUTE FUNCTION fn_guardia_anio_cerrado();
CREATE TRIGGER trg_a_anio_compra BEFORE INSERT OR UPDATE OR DELETE ON compra
    FOR EACH ROW EXECUTE FUNCTION fn_guardia_anio_cerrado();
CREATE TRIGGER trg_a_anio_recepcion BEFORE INSERT OR UPDATE OR DELETE ON recepcion
    FOR EACH ROW EXECUTE FUNCTION fn_guardia_anio_cerrado();


-- 10.2 Programas, líneas y sus meses solo se tocan mientras el jefe tiene
--      el presupuesto: en preparación, devuelto por Dirección o con
--      reparos de contabilidad. Mientras lo revisan, o ya aprobado,
--      quedan fijos.
CREATE FUNCTION fn_guardia_presupuesto_editable() RETURNS trigger AS $$
DECLARE
    v_fila         jsonb;
    v_presupuesto  integer;
    v_estado       estado_presupuesto;
    v_depto        text;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_fila := to_jsonb(OLD);
    ELSE
        v_fila := to_jsonb(NEW);
    END IF;

    IF TG_TABLE_NAME = 'programa' THEN
        v_presupuesto := (v_fila ->> 'presupuesto_id')::integer;
    ELSIF TG_TABLE_NAME = 'linea_calendario' THEN
        SELECT p.presupuesto_id INTO v_presupuesto
          FROM linea_presupuesto l JOIN programa p ON p.id = l.programa_id
         WHERE l.id = (v_fila ->> 'linea_id')::integer;
    ELSE
        SELECT presupuesto_id INTO v_presupuesto
          FROM programa WHERE id = (v_fila ->> 'programa_id')::integer;
    END IF;

    SELECT pd.estado, d.nombre INTO v_estado, v_depto
      FROM presupuesto_departamento pd
      JOIN departamento d ON d.id = pd.departamento_id
     WHERE pd.id = v_presupuesto;

    IF v_estado IN ('enviado', 'revision_contabilidad', 'aprobado') THEN
        RAISE EXCEPTION 'El presupuesto de % está %: no se pueden cambiar sus programas, sus ítems ni sus meses',
            v_depto, fn_nombre_estado(v_estado)
            USING ERRCODE = 'check_violation';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_b_editable_programa BEFORE INSERT OR UPDATE OR DELETE ON programa
    FOR EACH ROW EXECUTE FUNCTION fn_guardia_presupuesto_editable();
CREATE TRIGGER trg_b_editable_linea BEFORE INSERT OR UPDATE OR DELETE ON linea_presupuesto
    FOR EACH ROW EXECUTE FUNCTION fn_guardia_presupuesto_editable();
CREATE TRIGGER trg_b_editable_calendario BEFORE INSERT OR UPDATE OR DELETE ON linea_calendario
    FOR EACH ROW EXECUTE FUNCTION fn_guardia_presupuesto_editable();


-- 10.3 Los meses de una línea no pueden sumar más que la línea.
CREATE FUNCTION fn_calendario_cuadra() RETURNS trigger AS $$
DECLARE
    v_total        integer;
    v_descripcion  text;
    v_otros        integer;
BEGIN
    -- Bloquea la línea para que dos repartos simultáneos no se pasen.
    SELECT cantidad, descripcion INTO v_total, v_descripcion
      FROM linea_presupuesto WHERE id = NEW.linea_id FOR UPDATE;

    SELECT COALESCE(sum(cantidad), 0) INTO v_otros
      FROM linea_calendario
     WHERE linea_id = NEW.linea_id
       AND id IS DISTINCT FROM NEW.id;

    IF v_otros + NEW.cantidad > v_total THEN
        RAISE EXCEPTION '"%" tiene % unidades y ya hay % en otros meses: no caben % más',
            v_descripcion, v_total, v_otros, NEW.cantidad
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_b_calendario_cuadra BEFORE INSERT OR UPDATE ON linea_calendario
    FOR EACH ROW EXECUTE FUNCTION fn_calendario_cuadra();


-- 10.4 Cuando el jefe cambia la cantidad de una línea, sus meses se
--      ajustan solos si se puede: si toda la línea iba en un solo mes, la
--      nueva cantidad también va en ese mes. Si iba repartida y la nueva
--      cantidad no alcanza para lo repartido, el reparto se borra y el
--      jefe lo vuelve a indicar (el presupuesto no se envía sin meses).
--      Si sube y va repartida, lo nuevo queda sin mes.
CREATE FUNCTION fn_ajustar_calendario() RETURNS trigger AS $$
DECLARE
    v_meses  integer;
    v_suma   integer;
BEGIN
    SELECT count(*), COALESCE(sum(cantidad), 0) INTO v_meses, v_suma
      FROM linea_calendario WHERE linea_id = NEW.id;

    IF v_meses = 1 AND v_suma = OLD.cantidad THEN
        UPDATE linea_calendario SET cantidad = NEW.cantidad WHERE linea_id = NEW.id;
    ELSIF v_suma > NEW.cantidad THEN
        DELETE FROM linea_calendario WHERE linea_id = NEW.id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_z_linea_ajusta_calendario AFTER UPDATE OF cantidad ON linea_presupuesto
    FOR EACH ROW WHEN (NEW.cantidad IS DISTINCT FROM OLD.cantidad)
    EXECUTE FUNCTION fn_ajustar_calendario();


-- 10.5 Ciclo de vida del presupuesto de un departamento.
--
--        borrador ──► enviado ──► revision_contabilidad ──► aprobado
--           ▲   jefe     │  Dirección      │        contabilidad
--           └─ retira ───┤ aprueba         │
--                        ▼                 ▼
--                    devuelto          con_reparos
--               (vuelve a enviado)  (vuelve a revision_contabilidad,
--                                    sin pasar por Dirección)
--
--      Quién hace cada paso lo exige la aplicación por rol; acá se
--      cuidan las transiciones, los comentarios, los meses y el monto
--      congelado.
CREATE FUNCTION fn_transicion_presupuesto() RETURNS trigger AS $$
DECLARE
    v_lineas    integer;
    v_total     bigint;
    v_sin_mes   integer;
    v_nombres   text[];
    v_lista     text;
BEGIN
    IF NEW.estado = OLD.estado THEN
        IF OLD.estado = 'aprobado' AND NEW.monto_aprobado IS DISTINCT FROM OLD.monto_aprobado THEN
            RAISE EXCEPTION 'El monto aprobado no se cambia: registra una modificación presupuestaria'
                USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
    END IF;

    IF NOT (
        (OLD.estado IN ('borrador', 'devuelto') AND NEW.estado = 'enviado') OR
        (OLD.estado = 'enviado'                 AND NEW.estado IN ('revision_contabilidad', 'devuelto', 'borrador')) OR
        (OLD.estado = 'revision_contabilidad'   AND NEW.estado IN ('aprobado', 'con_reparos')) OR
        (OLD.estado = 'con_reparos'             AND NEW.estado = 'revision_contabilidad')
    ) THEN
        RAISE EXCEPTION 'Ese cambio no corresponde: el presupuesto está % y no puede quedar %',
            fn_nombre_estado(OLD.estado), fn_nombre_estado(NEW.estado)
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT count(l.id), COALESCE(sum(l.subtotal), 0) INTO v_lineas, v_total
      FROM programa p
      JOIN linea_presupuesto l ON l.programa_id = p.id
     WHERE p.presupuesto_id = NEW.id;

    -- El jefe envía: a Dirección, o directo a contabilidad después de los reparos.
    IF NEW.estado = 'enviado' OR (OLD.estado = 'con_reparos' AND NEW.estado = 'revision_contabilidad') THEN
        IF v_lineas = 0 THEN
            RAISE EXCEPTION 'No se puede enviar un presupuesto sin ítems'
                USING ERRCODE = 'check_violation';
        END IF;

        -- Cada unidad de cada línea tiene que tener su mes.
        SELECT count(*), (array_agg('"' || l.descripcion || '"' ORDER BY l.programa_id, l.id))[1:3]
          INTO v_sin_mes, v_nombres
          FROM vw_calendarizacion_linea c
          JOIN linea_presupuesto l ON l.id = c.linea_id
         WHERE c.presupuesto_id = NEW.id AND c.cantidad_sin_mes > 0;

        IF v_sin_mes > 0 THEN
            v_lista := CASE
                WHEN v_sin_mes = 1 THEN v_nombres[1]
                WHEN v_sin_mes <= 3 THEN array_to_string(v_nombres[1:v_sin_mes - 1], ', ')
                                         || ' y ' || v_nombres[v_sin_mes]
                ELSE array_to_string(v_nombres, ', ') || ' y '
                     || CASE WHEN v_sin_mes = 4 THEN '1 ítem más' ELSE (v_sin_mes - 3) || ' ítems más' END
            END;
            RAISE EXCEPTION 'Antes de enviar, indica en qué meses usarás cada ítem. Faltan meses en %', v_lista
                USING ERRCODE = 'check_violation';
        END IF;

        NEW.enviado_en := now();
    END IF;

    IF NEW.estado = 'enviado' THEN
        NEW.resuelto_direccion_en  := NULL;
        NEW.resuelto_direccion_por := NULL;

    ELSIF NEW.estado = 'devuelto' THEN
        NEW.resuelto_direccion_en  := now();
        NEW.resuelto_direccion_por := COALESCE(NEW.resuelto_direccion_por, fn_usuario_actual());

    ELSIF NEW.estado = 'revision_contabilidad' AND OLD.estado = 'enviado' THEN
        -- Dirección lo aprobó: pasa a contabilidad.
        NEW.resuelto_direccion_en     := now();
        NEW.resuelto_direccion_por    := COALESCE(NEW.resuelto_direccion_por, fn_usuario_actual());
        NEW.resuelto_contabilidad_en  := NULL;
        NEW.resuelto_contabilidad_por := NULL;

    ELSIF NEW.estado = 'revision_contabilidad' THEN
        -- El jefe corrigió los reparos y lo reenvió. La aprobación de Dirección se mantiene.
        NEW.resuelto_contabilidad_en  := NULL;
        NEW.resuelto_contabilidad_por := NULL;

    ELSIF NEW.estado = 'con_reparos' THEN
        NEW.resuelto_contabilidad_en  := now();
        NEW.resuelto_contabilidad_por := COALESCE(NEW.resuelto_contabilidad_por, fn_usuario_actual());

    ELSIF NEW.estado = 'aprobado' THEN
        -- Se congela lo que suman las líneas en este momento.
        NEW.monto_aprobado            := v_total;
        NEW.resuelto_contabilidad_en  := now();
        NEW.resuelto_contabilidad_por := COALESCE(NEW.resuelto_contabilidad_por, fn_usuario_actual());

    ELSIF NEW.estado = 'borrador' THEN
        -- El jefe retiró el envío para seguir editando.
        NEW.enviado_en := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_b_transicion_presupuesto BEFORE UPDATE ON presupuesto_departamento
    FOR EACH ROW EXECUTE FUNCTION fn_transicion_presupuesto();


CREATE FUNCTION fn_avisar_presupuesto() RETURNS trigger AS $$
DECLARE
    v_colegio  integer;
    v_depto    text;
    v_anio     smallint;
    v_enlace   text := '/formulacion/' || NEW.departamento_id;
BEGIN
    IF NEW.estado = OLD.estado THEN
        RETURN NULL;
    END IF;

    SELECT d.colegio_id, d.nombre, ap.anio INTO v_colegio, v_depto, v_anio
      FROM departamento d, anio_presupuestario ap
     WHERE d.id = NEW.departamento_id AND ap.id = NEW.anio_id;

    IF NEW.estado = 'enviado' THEN
        PERFORM fn_notificar_rol(v_colegio, 'direccion', NULL,
            'Presupuesto ' || v_anio || ' de ' || v_depto || ' listo para revisar',
            NULL, v_enlace);

    ELSIF NEW.estado = 'devuelto' THEN
        PERFORM fn_notificar_rol(v_colegio, 'jefe_departamento', NEW.departamento_id,
            'Dirección devolvió el presupuesto ' || v_anio || ' de ' || v_depto,
            NEW.comentario_direccion, v_enlace);

    ELSIF NEW.estado = 'revision_contabilidad' AND OLD.estado = 'enviado' THEN
        PERFORM fn_notificar_rol(v_colegio, 'contabilidad', NULL,
            'Presupuesto ' || v_anio || ' de ' || v_depto || ' listo para revisar',
            'Dirección ya lo aprobó.', v_enlace);
        PERFORM fn_notificar_rol(v_colegio, 'jefe_departamento', NEW.departamento_id,
            'Dirección aprobó el presupuesto ' || v_anio || ' de ' || v_depto,
            'Ahora lo revisa contabilidad.', v_enlace);

    ELSIF NEW.estado = 'revision_contabilidad' THEN
        PERFORM fn_notificar_rol(v_colegio, 'contabilidad', NULL,
            v_depto || ' corrigió los reparos del presupuesto ' || v_anio,
            'Está listo para revisar de nuevo.', v_enlace);

    ELSIF NEW.estado = 'con_reparos' THEN
        PERFORM fn_notificar_rol(v_colegio, 'jefe_departamento', NEW.departamento_id,
            'Contabilidad envió reparos al presupuesto ' || v_anio || ' de ' || v_depto,
            NEW.comentario_contabilidad, v_enlace);

    ELSIF NEW.estado = 'aprobado' THEN
        PERFORM fn_notificar_rol(v_colegio, 'jefe_departamento', NEW.departamento_id,
            'Contabilidad aprobó el presupuesto ' || v_anio || ' de ' || v_depto,
            'Quedó fijo en ' || fn_pesos(NEW.monto_aprobado)
                || '. Durante ' || v_anio || ' pedirás desde aquí lo que necesites, con la fecha en que lo necesitas.',
            v_enlace);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_z_avisa_presupuesto AFTER UPDATE OF estado ON presupuesto_departamento
    FOR EACH ROW EXECUTE FUNCTION fn_avisar_presupuesto();


-- 10.6 Los ítems de un pedido solo cambian en borrador, una línea pedida
--      tiene que ser del presupuesto del pedido, y el total del pedido es
--      siempre la suma de sus ítems.
CREATE FUNCTION fn_guardia_item_orden() RETURNS trigger AS $$
DECLARE
    v_estado       estado_orden;
    v_presupuesto  integer;
BEGIN
    SELECT estado, presupuesto_id INTO v_estado, v_presupuesto
      FROM orden_compra WHERE id = COALESCE(NEW.orden_id, OLD.orden_id);

    -- v_estado null: borrado en cascada del pedido completo.
    IF v_estado IS NOT NULL AND v_estado <> 'borrador' THEN
        RAISE EXCEPTION 'Los ítems de un pedido solo se cambian mientras está en borrador'
            USING ERRCODE = 'check_violation';
    END IF;

    IF TG_OP <> 'DELETE' AND NEW.linea_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM linea_presupuesto l JOIN programa p ON p.id = l.programa_id
         WHERE l.id = NEW.linea_id AND p.presupuesto_id = v_presupuesto
    ) THEN
        RAISE EXCEPTION 'Ese ítem no es del presupuesto del pedido'
            USING ERRCODE = 'check_violation';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_b_item_orden_editable BEFORE INSERT OR UPDATE OR DELETE ON item_orden
    FOR EACH ROW EXECUTE FUNCTION fn_guardia_item_orden();


CREATE FUNCTION fn_recalcular_total_orden() RETURNS trigger AS $$
DECLARE
    v_orden integer := COALESCE(NEW.orden_id, OLD.orden_id);
BEGIN
    UPDATE orden_compra
       SET monto_presupuesto = COALESCE(
               (SELECT sum(subtotal) FROM item_orden WHERE orden_id = v_orden), 0),
           actualizado_en = now()
     WHERE id = v_orden;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_z_item_recalcula_total AFTER INSERT OR UPDATE OR DELETE ON item_orden
    FOR EACH ROW EXECUTE FUNCTION fn_recalcular_total_orden();


-- 10.7 La regla central de la ejecución. Cuando el jefe pide (borrador →
--      emitida), la base revisa la fecha y decide: si cabe en el
--      disponible del departamento, queda emitida y pasa al equipo de
--      compra; si no, queda pendiente_direccion y se crea la solicitud
--      a Dirección. La aplicación pide 'emitida' y lee con RETURNING
--      cómo quedó.
--
--      Comprado y recibido no se marcan a mano: los marcan el registro de
--      la compra y la confirmación de la recepción (10.9).
CREATE FUNCTION fn_transicion_orden() RETURNS trigger AS $$
DECLARE
    v_anio          smallint;
    v_etapa         etapa_anio;
    v_estado_pres   estado_presupuesto;
    v_anticipacion  smallint;
    v_minima        date;
    v_disponible    bigint;
    v_resolucion    estado_pendiente;
BEGIN
    IF NEW.estado = OLD.estado THEN
        IF OLD.estado <> 'borrador' AND NEW.necesaria_para IS DISTINCT FROM OLD.necesaria_para THEN
            RAISE EXCEPTION 'La fecha en que se necesita el pedido % se fija al pedirlo', NEW.folio
                USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
    END IF;

    IF NOT (
        (OLD.estado = 'borrador'            AND NEW.estado IN ('emitida', 'pendiente_direccion', 'anulada')) OR
        (OLD.estado = 'pendiente_direccion' AND NEW.estado IN ('emitida', 'denegada', 'anulada')) OR
        (OLD.estado = 'emitida'             AND NEW.estado IN ('comprada', 'anulada')) OR
        (OLD.estado = 'comprada'            AND NEW.estado = 'recibida')
    ) THEN
        RAISE EXCEPTION 'Ese cambio no corresponde: el pedido % está % y no puede quedar %',
            NEW.folio, fn_nombre_estado_orden(OLD.estado), fn_nombre_estado_orden(NEW.estado)
            USING ERRCODE = 'check_violation';
    END IF;

    IF OLD.estado = 'borrador' AND NEW.estado IN ('emitida', 'pendiente_direccion') THEN
        -- Bloquea el presupuesto del departamento: dos pedidos simultáneos
        -- no pueden gastarse el mismo disponible.
        SELECT ap.anio, ap.etapa, pd.estado, c.anticipacion_dias
          INTO v_anio, v_etapa, v_estado_pres, v_anticipacion
          FROM presupuesto_departamento pd
          JOIN anio_presupuestario ap ON ap.id = pd.anio_id
          JOIN colegio             c  ON c.id  = ap.colegio_id
         WHERE pd.id = NEW.presupuesto_id
           FOR UPDATE OF pd;

        IF v_etapa <> 'ejecucion' THEN
            RAISE EXCEPTION 'Solo se pide contra un presupuesto en ejecución: el de % todavía no empieza', v_anio
                USING ERRCODE = 'check_violation';
        END IF;
        IF v_estado_pres <> 'aprobado' THEN
            RAISE EXCEPTION 'El presupuesto del departamento todavía no está aprobado'
                USING ERRCODE = 'check_violation';
        END IF;
        IF NEW.monto_presupuesto = 0 THEN
            RAISE EXCEPTION 'El pedido % no tiene ítems', NEW.folio
                USING ERRCODE = 'check_violation';
        END IF;

        -- La fecha: con anticipación, y dentro del año del presupuesto.
        v_minima := (NEW.creado_en AT TIME ZONE 'America/Santiago')::date + v_anticipacion;
        IF NEW.necesaria_para < v_minima THEN
            RAISE EXCEPTION 'Hay que pedir con al menos % de anticipación: la fecha más próxima que puedes poner es el %',
                CASE WHEN v_anticipacion = 1 THEN '1 día' ELSE v_anticipacion || ' días' END,
                to_char(v_minima, 'DD-MM-YYYY')
                USING ERRCODE = 'check_violation';
        END IF;
        IF extract(year FROM NEW.necesaria_para) <> v_anio THEN
            RAISE EXCEPTION 'El pedido es del presupuesto %: la fecha en que se necesita tiene que ser de ese año', v_anio
                USING ERRCODE = 'check_violation';
        END IF;

        SELECT disponible INTO v_disponible
          FROM vw_saldo_departamento WHERE presupuesto_id = NEW.presupuesto_id;

        NEW.estado := CASE WHEN NEW.monto_presupuesto <= v_disponible
                           THEN 'emitida' ELSE 'pendiente_direccion' END;
        NEW.fecha_emision := now();

    ELSIF OLD.estado = 'pendiente_direccion' AND NEW.estado IN ('emitida', 'denegada') THEN
        -- Solo la resolución de Dirección mueve un pedido que la espera.
        SELECT estado INTO v_resolucion FROM pendiente_pedido WHERE orden_id = NEW.id;
        IF v_resolucion IS DISTINCT FROM
           (CASE NEW.estado WHEN 'emitida' THEN 'aprobado' ELSE 'denegado' END)::estado_pendiente THEN
            RAISE EXCEPTION 'El pedido % espera la resolución de Dirección', NEW.folio
                USING ERRCODE = 'check_violation';
        END IF;

        IF NEW.estado = 'emitida' THEN
            SELECT disponible INTO v_disponible
              FROM vw_saldo_departamento WHERE presupuesto_id = NEW.presupuesto_id;
            IF NEW.monto_presupuesto > v_disponible THEN
                RAISE EXCEPTION 'El pedido % todavía no cabe en el disponible del departamento', NEW.folio
                    USING ERRCODE = 'check_violation';
            END IF;
            NEW.fecha_emision := now();
        END IF;

    ELSIF NEW.estado = 'comprada' AND NOT EXISTS (SELECT 1 FROM compra WHERE orden_id = NEW.id) THEN
        RAISE EXCEPTION 'Para marcar comprado el pedido %, registra la compra con lo que se pagó', NEW.folio
            USING ERRCODE = 'check_violation';

    ELSIF NEW.estado = 'recibida' AND NOT EXISTS (SELECT 1 FROM recepcion WHERE orden_id = NEW.id) THEN
        RAISE EXCEPTION 'Para marcar recibido el pedido %, confirma la recepción', NEW.folio
            USING ERRCODE = 'check_violation';
    END IF;

    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_b_transicion_orden BEFORE UPDATE ON orden_compra
    FOR EACH ROW EXECUTE FUNCTION fn_transicion_orden();


-- Un pedido nace en borrador: los ítems se cargan después y recién ahí
-- se pide, que es cuando corren las reglas de la fecha y del saldo.
CREATE FUNCTION fn_orden_nace_en_borrador() RETURNS trigger AS $$
BEGIN
    IF NEW.estado <> 'borrador' THEN
        RAISE EXCEPTION 'Un pedido se crea en borrador; se pide después de cargar sus ítems'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_b_orden_nace_en_borrador BEFORE INSERT ON orden_compra
    FOR EACH ROW EXECUTE FUNCTION fn_orden_nace_en_borrador();


-- 10.8 Lo que pasa después de cada cambio de estado de un pedido: la
--      solicitud a Dirección cuando no cabe, y los avisos a quien tiene
--      que hacer algo.
CREATE FUNCTION fn_efectos_orden() RETURNS trigger AS $$
DECLARE
    v_colegio     integer;
    v_depto_id    integer;
    v_depto       text;
    v_disponible  bigint;
    v_detalle     text;
    v_fecha       text := to_char(NEW.necesaria_para, 'DD-MM-YYYY');
    v_enlace      text;
    v_explicacion text;
    v_extension   integer;
BEGIN
    IF NEW.estado = OLD.estado THEN
        RETURN NULL;
    END IF;

    SELECT d.colegio_id, d.id, d.nombre INTO v_colegio, v_depto_id, v_depto
      FROM presupuesto_departamento pd
      JOIN departamento d ON d.id = pd.departamento_id
     WHERE pd.id = NEW.presupuesto_id;

    v_enlace := '/ejecucion/' || v_depto_id;
    SELECT string_agg(descripcion || ' × ' || cantidad, ', ' ORDER BY id) INTO v_detalle
      FROM item_orden WHERE orden_id = NEW.id;

    IF NEW.estado = 'pendiente_direccion' THEN
        -- Los pedidos que esperan no tocan el saldo, así que el disponible
        -- sigue siendo el mismo que se revisó al pedir.
        SELECT disponible INTO v_disponible
          FROM vw_saldo_departamento WHERE presupuesto_id = NEW.presupuesto_id;

        INSERT INTO pendiente_pedido (orden_id, monto_excedido, disponible_al_emitir)
        VALUES (NEW.id, NEW.monto_presupuesto - v_disponible, v_disponible);

        PERFORM fn_notificar_rol(v_colegio, 'direccion', NULL,
            v_depto || ' pide extender su presupuesto en ' || fn_pesos(NEW.monto_presupuesto - v_disponible),
            'Pedido ' || NEW.folio || ': ' || v_detalle || ', para el ' || v_fecha || '.',
            '/solicitudes');

    ELSIF NEW.estado = 'emitida' THEN
        PERFORM fn_notificar_rol(v_colegio, 'equipo_compra', NULL,
            'Pedido ' || NEW.folio || ' de ' || v_depto || ' listo para comprar',
            v_detalle || '. Se necesita el ' || v_fecha || '.',
            '/compras');

        IF OLD.estado = 'pendiente_direccion' THEN
            SELECT m.monto INTO v_extension
              FROM modificacion_presupuestaria m
              JOIN pendiente_pedido p ON p.id = m.pendiente_id
             WHERE p.orden_id = NEW.id;
            PERFORM fn_notificar_rol(v_colegio, 'jefe_departamento', v_depto_id,
                'Dirección aprobó tu pedido ' || NEW.folio,
                CASE WHEN v_extension IS NULL THEN 'El pedido pasó a compra.'
                     ELSE 'Extendió tu presupuesto en ' || fn_pesos(v_extension) || ' y el pedido pasó a compra.' END,
                v_enlace);
        END IF;

    ELSIF NEW.estado = 'denegada' THEN
        SELECT explicacion INTO v_explicacion FROM pendiente_pedido WHERE orden_id = NEW.id;
        PERFORM fn_notificar_rol(v_colegio, 'jefe_departamento', v_depto_id,
            'Dirección denegó tu pedido ' || NEW.folio, v_explicacion, v_enlace);

    ELSIF NEW.estado = 'comprada' THEN
        PERFORM fn_notificar_rol(v_colegio, 'jefe_departamento', v_depto_id,
            'Se compró tu pedido ' || NEW.folio,
            v_detalle || '. Cuando llegue, confirma que lo recibiste.', v_enlace);

    ELSIF NEW.estado = 'anulada' AND OLD.estado = 'emitida' THEN
        PERFORM fn_notificar_rol(v_colegio, 'equipo_compra', NULL,
            v_depto || ' anuló el pedido ' || NEW.folio,
            v_detalle || '. Ya no hay que comprarlo.', '/compras');

    ELSIF NEW.estado = 'anulada' AND OLD.estado = 'pendiente_direccion' THEN
        UPDATE pendiente_pedido
           SET estado = 'retirado',
               resuelto_por = COALESCE(fn_usuario_actual(), NEW.emitida_por),
               resuelto_en = now()
         WHERE orden_id = NEW.id AND estado = 'pendiente';
        PERFORM fn_notificar_rol(v_colegio, 'direccion', NULL,
            v_depto || ' retiró su pedido ' || NEW.folio,
            'Ya no hay que resolver esa solicitud.', '/solicitudes');
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_z_efectos_orden AFTER UPDATE OF estado ON orden_compra
    FOR EACH ROW EXECUTE FUNCTION fn_efectos_orden();


-- 10.9 Compras y recepciones. Una compra se registra sobre un pedido por
--      comprar (o uno ya comprado, si llega en partes) y lo marca
--      comprado; una recepción, sobre uno comprado, y lo marca recibido.
CREATE FUNCTION fn_guardia_compra() RETURNS trigger AS $$
DECLARE
    v_estado estado_orden;
    v_folio  text;
BEGIN
    SELECT estado, folio INTO v_estado, v_folio FROM orden_compra WHERE id = NEW.orden_id;

    IF TG_TABLE_NAME = 'compra' AND v_estado NOT IN ('emitida', 'comprada', 'recibida') THEN
        RAISE EXCEPTION 'El pedido % está %: solo se registran compras de pedidos por comprar',
            v_folio, fn_nombre_estado_orden(v_estado)
            USING ERRCODE = 'check_violation';
    ELSIF TG_TABLE_NAME = 'recepcion' AND v_estado NOT IN ('comprada', 'recibida') THEN
        RAISE EXCEPTION 'El pedido % está %: solo se recibe lo que ya se compró',
            v_folio, fn_nombre_estado_orden(v_estado)
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_b_guardia_compra BEFORE INSERT OR UPDATE ON compra
    FOR EACH ROW EXECUTE FUNCTION fn_guardia_compra();
CREATE TRIGGER trg_b_guardia_recepcion BEFORE INSERT OR UPDATE ON recepcion
    FOR EACH ROW EXECUTE FUNCTION fn_guardia_compra();


CREATE FUNCTION fn_marcar_orden() RETURNS trigger AS $$
BEGIN
    IF TG_TABLE_NAME = 'compra' THEN
        UPDATE orden_compra SET estado = 'comprada' WHERE id = NEW.orden_id AND estado = 'emitida';
    ELSE
        UPDATE orden_compra SET estado = 'recibida' WHERE id = NEW.orden_id AND estado = 'comprada';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_z_compra_marca_orden AFTER INSERT ON compra
    FOR EACH ROW EXECUTE FUNCTION fn_marcar_orden();
CREATE TRIGGER trg_z_recepcion_marca_orden AFTER INSERT ON recepcion
    FOR EACH ROW EXECUTE FUNCTION fn_marcar_orden();


-- 10.10 Bitácora automática. Trabaja sobre jsonb para que la misma
--       función sirva para cualquier tabla, tenga o no columna estado.
--       Los meses de las líneas no van: se reescriben enteros cada vez
--       que el jefe guarda la grilla.
CREATE FUNCTION fn_bitacora() RETURNS trigger AS $$
DECLARE
    v_antes    jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
    v_despues  jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
    v_accion   accion_bitacora;
BEGIN
    v_accion := CASE
        WHEN TG_OP = 'INSERT' THEN 'crear'
        WHEN TG_OP = 'DELETE' THEN 'eliminar'
        WHEN v_antes ? 'estado'
             AND v_antes ->> 'estado' IS DISTINCT FROM v_despues ->> 'estado'
             THEN 'cambiar_estado'
        ELSE 'actualizar'
    END::accion_bitacora;

    INSERT INTO bitacora (usuario_id, entidad, entidad_id, accion, datos_antes, datos_despues)
    VALUES (
        fn_usuario_actual(),
        TG_TABLE_NAME,
        COALESCE(v_despues ->> 'id', v_antes ->> 'id')::bigint,
        v_accion,
        v_antes,
        v_despues
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_z_bitacora AFTER INSERT OR UPDATE OR DELETE ON presupuesto_departamento
    FOR EACH ROW EXECUTE FUNCTION fn_bitacora();
CREATE TRIGGER trg_z_bitacora AFTER INSERT OR UPDATE OR DELETE ON programa
    FOR EACH ROW EXECUTE FUNCTION fn_bitacora();
CREATE TRIGGER trg_z_bitacora AFTER INSERT OR UPDATE OR DELETE ON linea_presupuesto
    FOR EACH ROW EXECUTE FUNCTION fn_bitacora();
CREATE TRIGGER trg_z_bitacora AFTER INSERT OR UPDATE OR DELETE ON modificacion_presupuestaria
    FOR EACH ROW EXECUTE FUNCTION fn_bitacora();
CREATE TRIGGER trg_z_bitacora AFTER INSERT OR UPDATE OR DELETE ON orden_compra
    FOR EACH ROW EXECUTE FUNCTION fn_bitacora();
CREATE TRIGGER trg_z_bitacora AFTER INSERT OR UPDATE OR DELETE ON pendiente_pedido
    FOR EACH ROW EXECUTE FUNCTION fn_bitacora();
CREATE TRIGGER trg_z_bitacora AFTER INSERT OR UPDATE OR DELETE ON compra
    FOR EACH ROW EXECUTE FUNCTION fn_bitacora();
CREATE TRIGGER trg_z_bitacora AFTER INSERT OR UPDATE OR DELETE ON recepcion
    FOR EACH ROW EXECUTE FUNCTION fn_bitacora();


-- ---------------------------------------------------------------------
-- 11. Operaciones de Dirección
-- ---------------------------------------------------------------------

-- Resolver una solicitud para extender el presupuesto. Aprobar aumenta el
-- presupuesto del departamento en lo que falte en este momento (no en lo
-- que faltaba al pedir: entremedio pudo liberarse o gastarse plata) y el
-- pedido pasa a compra. Denegar exige explicación, que le llega al jefe.
CREATE FUNCTION fn_resolver_pendiente(
    p_pendiente_id  integer,
    p_aprobar       boolean,
    p_explicacion   text DEFAULT NULL
) RETURNS estado_orden AS $$
DECLARE
    v_pendiente   pendiente_pedido%ROWTYPE;
    v_orden       orden_compra%ROWTYPE;
    v_usuario     integer := fn_usuario_actual();
    v_disponible  bigint;
    v_faltante    bigint;
BEGIN
    IF v_usuario IS NULL THEN
        RAISE EXCEPTION 'Falta declarar quién resuelve (app.usuario_id)';
    END IF;

    SELECT * INTO v_pendiente FROM pendiente_pedido WHERE id = p_pendiente_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe la solicitud %', p_pendiente_id;
    END IF;
    IF v_pendiente.estado = 'retirado' THEN
        RAISE EXCEPTION 'El jefe de departamento retiró ese pedido: ya no hay nada que resolver'
            USING ERRCODE = 'check_violation';
    END IF;
    IF v_pendiente.estado <> 'pendiente' THEN
        RAISE EXCEPTION 'Esa solicitud ya fue resuelta'
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT * INTO v_orden FROM orden_compra WHERE id = v_pendiente.orden_id;
    PERFORM 1 FROM presupuesto_departamento WHERE id = v_orden.presupuesto_id FOR UPDATE;

    IF p_aprobar THEN
        UPDATE pendiente_pedido
           SET estado = 'aprobado', resuelto_por = v_usuario, resuelto_en = now(),
               explicacion = NULLIF(btrim(p_explicacion), '')
         WHERE id = p_pendiente_id;

        SELECT disponible INTO v_disponible
          FROM vw_saldo_departamento WHERE presupuesto_id = v_orden.presupuesto_id;
        v_faltante := v_orden.monto_presupuesto - v_disponible;

        IF v_faltante > 0 THEN
            INSERT INTO modificacion_presupuestaria
                (presupuesto_id, monto, motivo, pendiente_id, autorizado_por)
            VALUES
                (v_orden.presupuesto_id, v_faltante::integer,
                 'Extensión aprobada por Dirección: pedido ' || v_orden.folio,
                 p_pendiente_id, v_usuario);
        END IF;

        UPDATE orden_compra SET estado = 'emitida' WHERE id = v_orden.id;
        RETURN 'emitida';
    END IF;

    IF NULLIF(btrim(p_explicacion), '') IS NULL THEN
        RAISE EXCEPTION 'Para denegar hay que explicarle el motivo al jefe de departamento'
            USING ERRCODE = 'check_violation';
    END IF;

    UPDATE pendiente_pedido
       SET estado = 'denegado', resuelto_por = v_usuario, resuelto_en = now(),
           explicacion = btrim(p_explicacion)
     WHERE id = p_pendiente_id;

    UPDATE orden_compra SET estado = 'denegada' WHERE id = v_orden.id;
    RETURN 'denegada';
END;
$$ LANGUAGE plpgsql;

COMMIT;
