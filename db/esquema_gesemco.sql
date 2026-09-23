-- =====================================================================
--  GESEMCO · Sistema de gestión presupuestaria escolar
--  Esquema relacional · PostgreSQL 12 o superior
--  v0.1 · 22 de septiembre de 2026
--
--  Alcance: un colegio, presupuesto a nivel de asignatura, año
--  presupuestario como partición lógica.
--
--  Convenciones:
--    · Montos en pesos chilenos, enteros sin decimales. Nunca float.
--      SUM() de integer devuelve bigint, así que los agregados no
--      se desbordan.
--    · Nada se borra: baja lógica con la columna activo / activa.
--    · colegio_id viaja en toda tabla raíz aunque hoy valga siempre 1.
--      Es lo que convierte el salto a doce colegios en una semana
--      de trabajo y no en una migración.
--
--  Orden de ejecución: este archivo completo, de una vez.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Tipos enumerados
-- ---------------------------------------------------------------------

CREATE TYPE nivel_ensenanza  AS ENUM ('prebasica', 'basica', 'media');

CREATE TYPE estado_anio      AS ENUM ('abierto', 'cerrado');

CREATE TYPE rol_sistema      AS ENUM ('profesor', 'jefe_departamento',
                                      'contabilidad', 'direccion',
                                      'administrador');

CREATE TYPE ambito_tipo      AS ENUM ('asignatura', 'departamento', 'colegio');

CREATE TYPE estado_orden     AS ENUM ('borrador', 'enviada', 'excepcion',
                                      'aprobada', 'rechazada',
                                      'recepcionada', 'pagada', 'anulada');

CREATE TYPE estado_excepcion AS ENUM ('pendiente', 'aprobada', 'rechazada');

CREATE TYPE tipo_adjunto     AS ENUM ('cotizacion', 'orden_firmada',
                                      'boleta', 'factura', 'otro');

CREATE TYPE accion_bitacora  AS ENUM ('crear', 'actualizar',
                                      'cambiar_estado', 'baja_logica');


-- ---------------------------------------------------------------------
-- 1. Estructura del colegio
-- ---------------------------------------------------------------------

CREATE TABLE colegio (
    id          serial       PRIMARY KEY,
    nombre      text         NOT NULL,
    rbd         text         NOT NULL UNIQUE,
    direccion   text,
    comuna      text,
    activo      boolean      NOT NULL DEFAULT true,
    creado_en   timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE colegio IS
    'Establecimiento educacional administrado por GESEMCO. RBD = rol base de datos del Mineduc.';


CREATE TABLE anio_presupuestario (
    id              serial       PRIMARY KEY,
    colegio_id      integer      NOT NULL REFERENCES colegio (id),
    anio            smallint     NOT NULL,
    estado          estado_anio  NOT NULL DEFAULT 'abierto',
    fecha_apertura  date         NOT NULL DEFAULT CURRENT_DATE,
    fecha_cierre    date,

    CONSTRAINT uq_anio_colegio   UNIQUE (colegio_id, anio),
    CONSTRAINT ck_anio_rango     CHECK (anio BETWEEN 2020 AND 2100),
    -- Regla 05: un año cerrado tiene fecha de cierre, y viceversa.
    CONSTRAINT ck_anio_cierre    CHECK ((estado = 'cerrado') = (fecha_cierre IS NOT NULL))
);


CREATE TABLE usuario (
    id          serial       PRIMARY KEY,
    colegio_id  integer      NOT NULL REFERENCES colegio (id),
    nombre      text         NOT NULL,
    email       text         NOT NULL,
    rut         text,
    activo      boolean      NOT NULL DEFAULT true,
    creado_en   timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT uq_usuario_rut CHECK (rut IS NULL OR rut ~ '^[0-9]{7,8}-[0-9kK]$')
);

-- El correo identifica al usuario sin importar mayúsculas.
CREATE UNIQUE INDEX uq_usuario_email ON usuario (lower(email));
CREATE UNIQUE INDEX uq_usuario_rut_unico ON usuario (rut) WHERE rut IS NOT NULL;


CREATE TABLE departamento (
    id               serial           PRIMARY KEY,
    colegio_id       integer          NOT NULL REFERENCES colegio (id),
    nombre           text             NOT NULL,
    nivel            nivel_ensenanza  NOT NULL,
    jefe_usuario_id  integer          REFERENCES usuario (id),
    activo           boolean          NOT NULL DEFAULT true,

    -- Un solo departamento por nivel de enseñanza en cada colegio.
    CONSTRAINT uq_departamento_nivel UNIQUE (colegio_id, nivel)
);

COMMENT ON TABLE departamento IS
    'Prebásica, básica y media. Aprueba y supervisa el gasto de sus asignaturas, pero no administra una bolsa propia.';


CREATE TABLE asignatura (
    id               serial   PRIMARY KEY,
    departamento_id  integer  NOT NULL REFERENCES departamento (id),
    nombre           text     NOT NULL,
    codigo           text     NOT NULL UNIQUE,
    activa           boolean  NOT NULL DEFAULT true
);

COMMENT ON TABLE asignatura IS
    'Regla 02: pertenece a exactamente un departamento y hereda de él el nivel de enseñanza. "Matemática básica" y "Matemática media" son dos filas distintas, cada una con su propio saldo.';
COMMENT ON COLUMN asignatura.codigo IS
    'Convención sugerida: RBD-NIVEL-RAMO, por ejemplo SA-MED-MAT.';


-- ---------------------------------------------------------------------
-- 2. Personas y permisos
-- ---------------------------------------------------------------------

CREATE TABLE rol_asignado (
    id            serial        PRIMARY KEY,
    usuario_id    integer       NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
    rol           rol_sistema   NOT NULL,
    ambito_tipo   ambito_tipo   NOT NULL,
    ambito_id     integer       NOT NULL,
    desde         date          NOT NULL DEFAULT CURRENT_DATE,
    hasta         date,

    CONSTRAINT uq_rol_ambito  UNIQUE (usuario_id, rol, ambito_tipo, ambito_id),
    CONSTRAINT ck_vigencia    CHECK (hasta IS NULL OR hasta >= desde)
);

COMMENT ON TABLE rol_asignado IS
    'Par rol + ámbito: jefe del departamento 2, contador del colegio 1. Permite que un jefe de departamento también haga clases. ambito_id es polimórfico y por eso no lleva clave foránea: se valida en la aplicación.';


CREATE TABLE profesor_asignatura (
    id             serial   PRIMARY KEY,
    usuario_id     integer  NOT NULL REFERENCES usuario (id),
    asignatura_id  integer  NOT NULL REFERENCES asignatura (id),
    anio_id        integer  NOT NULL REFERENCES anio_presupuestario (id),

    CONSTRAINT uq_profesor_asignatura UNIQUE (usuario_id, asignatura_id, anio_id)
);

COMMENT ON TABLE profesor_asignatura IS
    'Tabla puente. Un profesor dicta varias asignaturas y una asignatura tiene varios profesores, y eso cambia cada año.';


-- ---------------------------------------------------------------------
-- 3. Catálogos
-- ---------------------------------------------------------------------

CREATE TABLE proveedor (
    id            serial   PRIMARY KEY,
    rut           text     NOT NULL UNIQUE,
    razon_social  text     NOT NULL,
    giro          text,
    email         text,
    telefono      text,
    activo        boolean  NOT NULL DEFAULT true
);


CREATE TABLE categoria_gasto (
    id               serial   PRIMARY KEY,
    nombre           text     NOT NULL UNIQUE,
    cuenta_contable  text,
    activa           boolean  NOT NULL DEFAULT true
);

COMMENT ON COLUMN categoria_gasto.cuenta_contable IS
    'Puente con el plan de cuentas que GESEMCO ya usa. Se completa cuando se confirme cuál es.';


-- ---------------------------------------------------------------------
-- 4. Presupuesto
-- ---------------------------------------------------------------------

CREATE TABLE presupuesto (
    id              serial       PRIMARY KEY,
    asignatura_id   integer      NOT NULL REFERENCES asignatura (id),
    anio_id         integer      NOT NULL REFERENCES anio_presupuestario (id),
    monto_asignado  integer      NOT NULL CHECK (monto_asignado >= 0),
    monto_vigente   integer      NOT NULL CHECK (monto_vigente  >= 0),
    asignado_por    integer      NOT NULL REFERENCES usuario (id),
    creado_en       timestamptz  NOT NULL DEFAULT now(),

    -- Regla 01: un presupuesto por asignatura y por año.
    CONSTRAINT uq_presupuesto UNIQUE (asignatura_id, anio_id)
);

COMMENT ON COLUMN presupuesto.monto_asignado IS 'Monto original de la asignación anual. No cambia.';
COMMENT ON COLUMN presupuesto.monto_vigente  IS 'Monto actual = asignado ± movimientos aprobados. Es el que usa el cálculo de saldo.';


CREATE TABLE movimiento_presupuesto (
    id                      serial       PRIMARY KEY,
    presupuesto_origen_id   integer      REFERENCES presupuesto (id),
    presupuesto_destino_id  integer      REFERENCES presupuesto (id),
    monto                   integer      NOT NULL CHECK (monto > 0),
    motivo                  text         NOT NULL,
    autorizado_por          integer      NOT NULL REFERENCES usuario (id),
    creado_en               timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT ck_movimiento_lados CHECK (
        presupuesto_origen_id IS NOT NULL OR presupuesto_destino_id IS NOT NULL
    ),
    CONSTRAINT ck_movimiento_distintos CHECK (
        presupuesto_origen_id IS DISTINCT FROM presupuesto_destino_id
    )
);

COMMENT ON TABLE movimiento_presupuesto IS
    'Origen nulo = ampliación desde contabilidad. Destino nulo = recorte. Ambos presentes = reasignación entre asignaturas. Es el historial que explica por qué el vigente no es el original. Entra en Fase 2.';


-- ---------------------------------------------------------------------
-- 5. Órdenes de compra
-- ---------------------------------------------------------------------

CREATE TABLE orden_compra (
    id                     serial        PRIMARY KEY,
    folio                  text          NOT NULL UNIQUE,
    asignatura_id          integer       NOT NULL REFERENCES asignatura (id),
    anio_id                integer       NOT NULL REFERENCES anio_presupuestario (id),
    solicitante_id         integer       NOT NULL REFERENCES usuario (id),
    proveedor_id           integer       REFERENCES proveedor (id),
    fecha_solicitud        date          NOT NULL DEFAULT CURRENT_DATE,
    monto_total            integer       NOT NULL DEFAULT 0 CHECK (monto_total >= 0),
    estado                 estado_orden  NOT NULL DEFAULT 'borrador',
    justificacion          text,
    aprobador_id           integer       REFERENCES usuario (id),
    fecha_aprobacion       timestamptz,
    comentario_aprobacion  text,
    creado_en              timestamptz   NOT NULL DEFAULT now(),
    actualizado_en         timestamptz   NOT NULL DEFAULT now(),

    -- Un rechazo siempre lleva motivo escrito.
    CONSTRAINT ck_rechazo_con_motivo CHECK (
        estado <> 'rechazada' OR comentario_aprobacion IS NOT NULL
    ),
    -- Una orden aprobada o posterior tiene quién la aprobó.
    CONSTRAINT ck_aprobacion_con_aprobador CHECK (
        estado NOT IN ('aprobada', 'recepcionada', 'pagada') OR aprobador_id IS NOT NULL
    )
);

-- Regla 03: la orden solo se imputa a una asignatura que tenga presupuesto
-- en ese año. La clave foránea compuesta lo garantiza sin escribir código.
ALTER TABLE orden_compra
    ADD CONSTRAINT fk_orden_presupuesto
    FOREIGN KEY (asignatura_id, anio_id)
    REFERENCES presupuesto (asignatura_id, anio_id);


CREATE TABLE item_orden (
    id                  serial   PRIMARY KEY,
    orden_id            integer  NOT NULL REFERENCES orden_compra (id) ON DELETE CASCADE,
    categoria_gasto_id  integer  NOT NULL REFERENCES categoria_gasto (id),
    descripcion         text     NOT NULL,
    cantidad            integer  NOT NULL CHECK (cantidad > 0),
    precio_unitario     integer  NOT NULL CHECK (precio_unitario >= 0),
    -- Regla 04: el subtotal es calculado, nunca ingresado a mano.
    subtotal            integer  GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);


CREATE TABLE solicitud_excepcion (
    id                serial            PRIMARY KEY,
    orden_id          integer           NOT NULL UNIQUE
                                        REFERENCES orden_compra (id) ON DELETE CASCADE,
    monto_excedido    integer           NOT NULL CHECK (monto_excedido > 0),
    motivo            text              NOT NULL,
    estado            estado_excepcion  NOT NULL DEFAULT 'pendiente',
    resuelto_por      integer           REFERENCES usuario (id),
    fecha_resolucion  timestamptz,
    comentario        text,
    creado_en         timestamptz       NOT NULL DEFAULT now(),

    -- Regla 06: pendiente equivale a sin resolver.
    CONSTRAINT ck_resolucion CHECK (
        (estado = 'pendiente') = (resuelto_por IS NULL AND fecha_resolucion IS NULL)
    )
);

COMMENT ON COLUMN solicitud_excepcion.monto_excedido IS
    'Cuánto excedía el disponible al momento de enviarla. Se congela: si después entra plata, el registro sigue contando la historia real.';


CREATE TABLE adjunto (
    id          serial        PRIMARY KEY,
    orden_id    integer       NOT NULL REFERENCES orden_compra (id) ON DELETE CASCADE,
    tipo        tipo_adjunto  NOT NULL,
    nombre      text          NOT NULL,
    url         text          NOT NULL,
    subido_por  integer       NOT NULL REFERENCES usuario (id),
    subido_en   timestamptz   NOT NULL DEFAULT now()
);


CREATE TABLE recepcion (
    id               serial       PRIMARY KEY,
    orden_id         integer      NOT NULL UNIQUE
                                  REFERENCES orden_compra (id) ON DELETE CASCADE,
    monto_real       integer      NOT NULL CHECK (monto_real >= 0),
    fecha_recepcion  date         NOT NULL DEFAULT CURRENT_DATE,
    recibido_por     integer      NOT NULL REFERENCES usuario (id),
    observaciones    text
);

COMMENT ON TABLE recepcion IS
    'Si la cotización decía 180.000 y la factura llegó en 165.000, la diferencia vuelve al disponible de la asignatura en vez de quedar reservada todo el año.';


-- ---------------------------------------------------------------------
-- 6. Trazabilidad
-- ---------------------------------------------------------------------

CREATE TABLE bitacora (
    id             bigserial        PRIMARY KEY,
    usuario_id     integer          REFERENCES usuario (id),
    entidad        text             NOT NULL,
    entidad_id     integer          NOT NULL,
    accion         accion_bitacora  NOT NULL,
    datos_antes    jsonb,
    datos_despues  jsonb,
    ocurrido_en    timestamptz      NOT NULL DEFAULT now()
);

-- Regla 09: la bitácora es solo inserción, ni siquiera para el administrador.
REVOKE UPDATE, DELETE ON bitacora FROM PUBLIC;


-- Tabla auxiliar, no es una entidad del modelo: genera el folio correlativo
-- sin la condición de carrera de un COUNT(*) + 1.
CREATE TABLE folio_contador (
    anio_id  integer  PRIMARY KEY REFERENCES anio_presupuestario (id),
    ultimo   integer  NOT NULL DEFAULT 0
);


-- ---------------------------------------------------------------------
-- 7. Índices
-- ---------------------------------------------------------------------

CREATE INDEX ix_asignatura_departamento ON asignatura (departamento_id);
CREATE INDEX ix_departamento_colegio    ON departamento (colegio_id);
CREATE INDEX ix_rol_usuario             ON rol_asignado (usuario_id);
CREATE INDEX ix_presupuesto_anio        ON presupuesto (anio_id);
CREATE INDEX ix_orden_asig_anio         ON orden_compra (asignatura_id, anio_id);
CREATE INDEX ix_orden_estado            ON orden_compra (estado);
CREATE INDEX ix_orden_solicitante       ON orden_compra (solicitante_id);
CREATE INDEX ix_item_orden              ON item_orden (orden_id);
CREATE INDEX ix_adjunto_orden           ON adjunto (orden_id);
CREATE INDEX ix_bitacora_entidad        ON bitacora (entidad, entidad_id);


-- ---------------------------------------------------------------------
-- 8. Vistas de saldo
--
--    Decisión de arquitectura: el saldo se calcula, no se guarda.
--    Un campo saldo almacenado se desincroniza tarde o temprano y
--    después nadie sabe cuál número es el bueno. Si el rendimiento
--    llega a molestar, esto pasa a vista materializada, nunca a columna.
-- ---------------------------------------------------------------------

CREATE VIEW vw_saldo_asignatura AS
SELECT
    p.id                                         AS presupuesto_id,
    a.id                                         AS asignatura_id,
    a.nombre                                     AS asignatura,
    d.id                                         AS departamento_id,
    d.nombre                                     AS departamento,
    d.nivel,
    ap.id                                        AS anio_id,
    ap.anio,
    p.monto_vigente                              AS asignado,

    -- Comprometido: enviada o aprobada, todavía sin recepcionar.
    COALESCE(SUM(oc.monto_total)
             FILTER (WHERE oc.estado IN ('enviada', 'aprobada')), 0)       AS comprometido,

    -- Ejecutado: ya recepcionada o pagada, al monto real si existe.
    COALESCE(SUM(COALESCE(r.monto_real, oc.monto_total))
             FILTER (WHERE oc.estado IN ('recepcionada', 'pagada')), 0)    AS ejecutado,

    -- Disponible = Asignado - Comprometido - Ejecutado
    p.monto_vigente
      - COALESCE(SUM(oc.monto_total)
                 FILTER (WHERE oc.estado IN ('enviada', 'aprobada')), 0)
      - COALESCE(SUM(COALESCE(r.monto_real, oc.monto_total))
                 FILTER (WHERE oc.estado IN ('recepcionada', 'pagada')), 0) AS disponible

FROM presupuesto p
JOIN asignatura          a  ON a.id  = p.asignatura_id
JOIN departamento        d  ON d.id  = a.departamento_id
JOIN anio_presupuestario ap ON ap.id = p.anio_id
LEFT JOIN orden_compra   oc ON oc.asignatura_id = p.asignatura_id
                           AND oc.anio_id       = p.anio_id
LEFT JOIN recepcion      r  ON r.orden_id = oc.id
GROUP BY p.id, a.id, d.id, ap.id;

COMMENT ON VIEW vw_saldo_asignatura IS
    'Las órdenes en estado excepcion, rechazada, anulada y borrador no tocan el saldo.';


CREATE VIEW vw_saldo_departamento AS
SELECT
    departamento_id,
    departamento,
    nivel,
    anio_id,
    anio,
    SUM(asignado)     AS asignado,
    SUM(comprometido) AS comprometido,
    SUM(ejecutado)    AS ejecutado,
    SUM(disponible)   AS disponible
FROM vw_saldo_asignatura
GROUP BY departamento_id, departamento, nivel, anio_id, anio;


-- El consolidado que hoy contabilidad rearma a mano en una planilla.
CREATE VIEW vw_consolidado_colegio AS
SELECT
    c.id                AS colegio_id,
    c.nombre            AS colegio,
    v.anio,
    SUM(v.asignado)     AS asignado,
    SUM(v.comprometido) AS comprometido,
    SUM(v.ejecutado)    AS ejecutado,
    SUM(v.disponible)   AS disponible,
    ROUND(100.0 * (SUM(v.comprometido) + SUM(v.ejecutado))
          / NULLIF(SUM(v.asignado), 0), 1) AS pct_usado
FROM vw_saldo_asignatura v
JOIN departamento d ON d.id = v.departamento_id
JOIN colegio      c ON c.id = d.colegio_id
GROUP BY c.id, v.anio;


-- ---------------------------------------------------------------------
-- 9. Triggers
-- ---------------------------------------------------------------------

-- 9.1 Regla 04 · El total de la orden es la suma de sus ítems.
CREATE OR REPLACE FUNCTION fn_recalcular_total_orden() RETURNS trigger AS $$
DECLARE
    v_orden integer := COALESCE(NEW.orden_id, OLD.orden_id);
BEGIN
    UPDATE orden_compra
       SET monto_total = COALESCE(
               (SELECT SUM(subtotal) FROM item_orden WHERE orden_id = v_orden), 0),
           actualizado_en = now()
     WHERE id = v_orden;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_item_recalcula_total
    AFTER INSERT OR UPDATE OR DELETE ON item_orden
    FOR EACH ROW EXECUTE FUNCTION fn_recalcular_total_orden();


-- 9.2 Regla 05 · Un año cerrado es inmutable.
CREATE OR REPLACE FUNCTION fn_bloquear_anio_cerrado() RETURNS trigger AS $$
DECLARE
    v_anio_id integer := COALESCE(NEW.anio_id, OLD.anio_id);
    v_estado  estado_anio;
BEGIN
    SELECT estado INTO v_estado FROM anio_presupuestario WHERE id = v_anio_id;
    IF v_estado = 'cerrado' THEN
        RAISE EXCEPTION 'El año presupuestario % está cerrado y no admite cambios', v_anio_id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orden_anio_cerrado
    BEFORE INSERT OR UPDATE OR DELETE ON orden_compra
    FOR EACH ROW EXECUTE FUNCTION fn_bloquear_anio_cerrado();

CREATE TRIGGER trg_presupuesto_anio_cerrado
    BEFORE INSERT OR UPDATE OR DELETE ON presupuesto
    FOR EACH ROW EXECUTE FUNCTION fn_bloquear_anio_cerrado();


-- 9.3 La regla de negocio central: una orden se envía si cabe en el
--     disponible de su asignatura. Si no cabe, no se rechaza: se manda
--     como excepción para que la resuelva Dirección.
--
--     Nota de orden de ejecución: PostgreSQL dispara los triggers BEFORE
--     por orden alfabético del nombre, así que trg_orden_anio_cerrado
--     corre antes que trg_orden_valida_saldo. Es lo que queremos.
CREATE OR REPLACE FUNCTION fn_validar_saldo_orden() RETURNS trigger AS $$
DECLARE
    v_disponible bigint;
BEGIN
    -- Solo al momento de enviar, no en cada actualización posterior
    -- (si no, el recálculo del total se auto-bloquearía).
    IF NEW.estado = 'enviada'
       AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'enviada') THEN

        SELECT disponible INTO v_disponible
          FROM vw_saldo_asignatura
         WHERE asignatura_id = NEW.asignatura_id
           AND anio_id       = NEW.anio_id;

        IF v_disponible IS NULL THEN
            RAISE EXCEPTION 'La asignatura % no tiene presupuesto asignado en el año %',
                NEW.asignatura_id, NEW.anio_id
                USING ERRCODE = 'foreign_key_violation';
        END IF;

        IF NEW.monto_total > v_disponible THEN
            RAISE EXCEPTION 'La orden % excede el disponible de su asignatura en %',
                NEW.folio, NEW.monto_total - v_disponible
                USING ERRCODE = 'check_violation',
                      HINT = 'Envíala con estado = excepcion y crea la solicitud_excepcion correspondiente.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orden_valida_saldo
    BEFORE INSERT OR UPDATE ON orden_compra
    FOR EACH ROW EXECUTE FUNCTION fn_validar_saldo_orden();


-- 9.4 Regla 09 · Bitácora automática.
--     La aplicación declara quién actúa con:
--         SET LOCAL app.usuario_id = '7';
--     Trabaja sobre jsonb en vez de OLD.estado / NEW.estado a propósito:
--     así la misma función sirve para cualquier tabla, tenga o no una
--     columna estado. PL/pgSQL resuelve los campos de un record en
--     tiempo de ejecución aunque la rama del CASE no se evalúe.
CREATE OR REPLACE FUNCTION fn_bitacora() RETURNS trigger AS $$
DECLARE
    v_antes    jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
    v_despues  jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
    v_accion   accion_bitacora;
BEGIN
    v_accion := CASE
        WHEN TG_OP = 'INSERT' THEN 'crear'
        WHEN TG_OP = 'DELETE' THEN 'baja_logica'
        WHEN jsonb_exists(v_antes, 'estado')
             AND v_antes ->> 'estado' IS DISTINCT FROM v_despues ->> 'estado'
             THEN 'cambiar_estado'
        ELSE 'actualizar'
    END::accion_bitacora;

    INSERT INTO bitacora (usuario_id, entidad, entidad_id, accion,
                          datos_antes, datos_despues)
    VALUES (
        NULLIF(current_setting('app.usuario_id', true), '')::integer,
        TG_TABLE_NAME,
        COALESCE(v_despues ->> 'id', v_antes ->> 'id')::integer,
        v_accion,
        v_antes,
        v_despues
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bitacora_orden
    AFTER INSERT OR UPDATE OR DELETE ON orden_compra
    FOR EACH ROW EXECUTE FUNCTION fn_bitacora();

CREATE TRIGGER trg_bitacora_presupuesto
    AFTER INSERT OR UPDATE OR DELETE ON presupuesto
    FOR EACH ROW EXECUTE FUNCTION fn_bitacora();

CREATE TRIGGER trg_bitacora_excepcion
    AFTER INSERT OR UPDATE OR DELETE ON solicitud_excepcion
    FOR EACH ROW EXECUTE FUNCTION fn_bitacora();


-- 9.5 Folio correlativo por año, a prueba de concurrencia.
CREATE OR REPLACE FUNCTION fn_siguiente_folio(p_anio_id integer) RETURNS text AS $$
DECLARE
    v_anio smallint;
    v_n    integer;
BEGIN
    SELECT anio INTO v_anio FROM anio_presupuestario WHERE id = p_anio_id;
    IF v_anio IS NULL THEN
        RAISE EXCEPTION 'No existe el año presupuestario %', p_anio_id;
    END IF;

    INSERT INTO folio_contador (anio_id, ultimo)
    VALUES (p_anio_id, 1)
    ON CONFLICT (anio_id) DO UPDATE
        SET ultimo = folio_contador.ultimo + 1
    RETURNING ultimo INTO v_n;

    RETURN 'OC-' || v_anio || '-' || lpad(v_n::text, 4, '0');
END;
$$ LANGUAGE plpgsql;


COMMIT;


-- =====================================================================
--  DATOS DE PRUEBA
--  Estructura de un colegio piloto con sus presupuestos 2026.
--  Bórralo antes de pasar a producción.
-- =====================================================================

BEGIN;

INSERT INTO colegio (nombre, rbd, comuna)
VALUES ('Colegio San Alberto', '12345-6', 'Puente Alto');

INSERT INTO anio_presupuestario (colegio_id, anio, fecha_apertura)
VALUES (1, 2026, '2026-01-05');

INSERT INTO usuario (colegio_id, nombre, email) VALUES
    (1, 'Marcela Ovalle',        'marcela.ovalle@gesemco.cl'),        -- 1 contabilidad
    (1, 'Andrés Bulnes',         'direccion@sanalberto.cl'),          -- 2 dirección
    (1, 'Carolina Muñoz Peña',   'carolina.munoz@sanalberto.cl'),     -- 3 jefa prebásica
    (1, 'Rodrigo Tapia Fuentes', 'rodrigo.tapia@sanalberto.cl'),      -- 4 jefe básica
    (1, 'Paula Sandoval Rivas',  'paula.sandoval@sanalberto.cl'),     -- 5 jefa media
    (1, 'Ignacio Vera',          'ignacio.vera@sanalberto.cl'),       -- 6 profesor media
    (1, 'Francisca Leiva',       'francisca.leiva@sanalberto.cl');    -- 7 profesora media

INSERT INTO departamento (colegio_id, nombre, nivel, jefe_usuario_id) VALUES
    (1, 'Prebásica', 'prebasica', 3),
    (1, 'Básica',    'basica',    4),
    (1, 'Media',     'media',     5);

INSERT INTO asignatura (departamento_id, nombre, codigo) VALUES
    (1, 'Lenguaje Verbal',                'SA-PRE-LEN'),
    (1, 'Pensamiento Matemático',         'SA-PRE-MAT'),
    (1, 'Exploración del Entorno',        'SA-PRE-ENT'),
    (1, 'Artes Visuales Prebásica',       'SA-PRE-ART'),
    (2, 'Matemática Básica',              'SA-BAS-MAT'),
    (2, 'Lenguaje y Comunicación Básica', 'SA-BAS-LEN'),
    (2, 'Ciencias Naturales Básica',      'SA-BAS-CIE'),
    (2, 'Historia y Geografía Básica',    'SA-BAS-HIS'),
    (2, 'Educación Física Básica',        'SA-BAS-EFI'),
    (2, 'Artes y Música Básica',          'SA-BAS-ART'),
    (3, 'Matemática Media',               'SA-MED-MAT'),
    (3, 'Lenguaje Media',                 'SA-MED-LEN'),
    (3, 'Biología',                       'SA-MED-BIO'),
    (3, 'Química',                        'SA-MED-QUI'),
    (3, 'Física',                         'SA-MED-FIS'),
    (3, 'Historia Media',                 'SA-MED-HIS'),
    (3, 'Inglés Media',                   'SA-MED-ING'),
    (3, 'Educación Física Media',         'SA-MED-EFI');

INSERT INTO rol_asignado (usuario_id, rol, ambito_tipo, ambito_id) VALUES
    (1, 'contabilidad',      'colegio',      1),
    (2, 'direccion',         'colegio',      1),
    (3, 'jefe_departamento', 'departamento', 1),
    (4, 'jefe_departamento', 'departamento', 2),
    (5, 'jefe_departamento', 'departamento', 3),
    (6, 'profesor',          'asignatura',  11),
    (6, 'profesor',          'asignatura',  15),
    (7, 'profesor',          'asignatura',  13),
    (7, 'profesor',          'asignatura',  14);

INSERT INTO profesor_asignatura (usuario_id, asignatura_id, anio_id) VALUES
    (6, 11, 1), (6, 15, 1), (7, 13, 1), (7, 14, 1);

INSERT INTO categoria_gasto (nombre, cuenta_contable) VALUES
    ('Materiales didácticos',    '5-1-01'),
    ('Equipamiento',             '5-1-02'),
    ('Servicios y mantención',   '5-2-01'),
    ('Libros y licencias',       '5-1-03'),
    ('Insumos de laboratorio',   '5-1-04');

INSERT INTO proveedor (rut, razon_social) VALUES
    ('96670840-9',  'Dimerc S.A.'),
    ('77123456-7',  'Distribuidora Científica Andina Ltda.'),
    ('79876543-2',  'Editorial Santillana Chile'),
    ('76543210-1',  'PC Factory Empresas');

-- Presupuesto 2026 por asignatura, asignado por contabilidad.
INSERT INTO presupuesto (asignatura_id, anio_id, monto_asignado, monto_vigente, asignado_por)
VALUES
    ( 1, 1, 2400000, 2400000, 1), ( 2, 1, 2100000, 2100000, 1),
    ( 3, 1, 1800000, 1800000, 1), ( 4, 1, 1450000, 1450000, 1),
    ( 5, 1, 4200000, 4200000, 1), ( 6, 1, 3800000, 3800000, 1),
    ( 7, 1, 3200000, 3200000, 1), ( 8, 1, 2300000, 2300000, 1),
    ( 9, 1, 2750000, 2750000, 1), (10, 1, 1900000, 1900000, 1),
    (11, 1, 4600000, 4600000, 1), (12, 1, 3400000, 3400000, 1),
    (13, 1, 3900000, 3900000, 1), (14, 1, 3600000, 3600000, 1),
    (15, 1, 2900000, 2900000, 1), (16, 1, 2100000, 2100000, 1),
    (17, 1, 2400000, 2400000, 1), (18, 1, 2500000, 2500000, 1);

COMMIT;


-- ---------------------------------------------------------------------
--  Ciclo de vida de una orden, paso a paso.
--  Este es el orden correcto: se crea en borrador, se le cargan los
--  ítems (el trigger calcula el total) y recién ahí se envía, que es
--  cuando corre la validación de saldo.
-- ---------------------------------------------------------------------

BEGIN;

-- 1. Borrador
INSERT INTO orden_compra (folio, asignatura_id, anio_id, solicitante_id,
                          proveedor_id, fecha_solicitud, justificacion)
VALUES (fn_siguiente_folio(1), 11, 1, 6, 1, '2026-03-12',
        'Reemplazo de calculadoras para 1° y 2° medio; las actuales tienen seis años.');

-- 2. Ítems: el trigger recalcula monto_total de la cabecera
INSERT INTO item_orden (orden_id, categoria_gasto_id, descripcion, cantidad, precio_unitario)
VALUES (1, 1, 'Calculadora científica Casio FX-570', 30, 24900);

-- 3. Envío a aprobación: aquí corre fn_validar_saldo_orden
UPDATE orden_compra SET estado = 'enviada' WHERE id = 1;

-- 4. El jefe de departamento aprueba
UPDATE orden_compra
   SET estado = 'aprobada', aprobador_id = 5, fecha_aprobacion = now()
 WHERE id = 1;

-- 5. Recepción con el monto real de la factura: la diferencia vuelve al saldo
INSERT INTO recepcion (orden_id, monto_real, fecha_recepcion, recibido_por)
VALUES (1, 723000, '2026-03-28', 6);
UPDATE orden_compra SET estado = 'recepcionada' WHERE id = 1;

-- 6. Contabilidad registra el pago
UPDATE orden_compra SET estado = 'pagada' WHERE id = 1;

COMMIT;


-- ---------------------------------------------------------------------
--  Consultas de verificación
-- ---------------------------------------------------------------------

-- Saldo de cada asignatura del departamento de Media
-- SELECT asignatura, asignado, comprometido, ejecutado, disponible
--   FROM vw_saldo_asignatura
--  WHERE nivel = 'media' AND anio = 2026
--  ORDER BY disponible;

-- Consolidado por departamento
-- SELECT * FROM vw_saldo_departamento WHERE anio = 2026;

-- El número que hoy contabilidad arma a mano
-- SELECT * FROM vw_consolidado_colegio WHERE anio = 2026;

-- Órdenes esperando aprobación de un departamento
-- SELECT oc.folio, a.nombre AS asignatura, u.nombre AS solicitante, oc.monto_total
--   FROM orden_compra oc
--   JOIN asignatura   a ON a.id = oc.asignatura_id
--   JOIN usuario      u ON u.id = oc.solicitante_id
--  WHERE oc.estado = 'enviada' AND a.departamento_id = 3
--  ORDER BY oc.fecha_solicitud;

-- Excepciones pendientes de Dirección
-- SELECT oc.folio, a.nombre AS asignatura, oc.monto_total, se.monto_excedido, se.motivo
--   FROM solicitud_excepcion se
--   JOIN orden_compra oc ON oc.id = se.orden_id
--   JOIN asignatura   a  ON a.id = oc.asignatura_id
--  WHERE se.estado = 'pendiente';

-- Comprobar que el saldo bloquea: esta orden debería fallar con
-- "excede el disponible de su asignatura"
-- INSERT INTO orden_compra (folio, asignatura_id, anio_id, solicitante_id, proveedor_id)
-- VALUES (fn_siguiente_folio(1), 15, 1, 6, 2);
-- INSERT INTO item_orden (orden_id, categoria_gasto_id, descripcion, cantidad, precio_unitario)
-- VALUES (2, 2, 'Osciloscopio digital', 1, 9000000);
-- UPDATE orden_compra SET estado = 'enviada' WHERE id = 2;
