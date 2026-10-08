-- =====================================================================
--  GESEMCO · Datos de prueba
--
--  El Colegio Santa Úrsula el 8 de octubre de 2026: ejecutando el
--  presupuesto 2026 (formulado con sus meses en octubre de 2025, con los
--  pedidos de todo el año) y formulando el 2027.
--
--  Los precios de tiendas reales son los que esas tiendas publicaban el
--  24-09-2026. Los de la tienda "Precio de ejemplo" son ilustrativos.
--  Las personas, los correos (dominio .test), los montos, los
--  proveedores, las compras y las facturas son inventados. Nada de esto
--  va a producción.
--
--  Requiere haber corrido db/esquema_gesemco.sql sobre una base vacía.
--  Todo pasa por los triggers reales: si una regla se rompe, este
--  archivo falla.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Colegio, años, departamentos y personas
-- ---------------------------------------------------------------------

-- Los pedidos se hacen con una semana de anticipación (anticipacion_dias).
INSERT INTO colegio (nombre, rbd, comuna, anticipacion_dias)
VALUES ('Colegio Santa Úrsula', '00000-0', NULL, 7);   -- RBD y comuna: completar con los reales

-- Octubre para armar el presupuesto y noviembre para aprobarlo, el año anterior.
INSERT INTO anio_presupuestario (colegio_id, anio, etapa, fecha_apertura, formulacion_hasta, aprobacion_hasta) VALUES
    (1, 2026, 'ejecucion',   '2025-10-01', '2025-10-31', '2025-11-30'),   -- 1
    (1, 2027, 'formulacion', '2026-10-01', '2026-10-31', '2026-11-30');   -- 2

INSERT INTO departamento (colegio_id, nombre, centro_costo) VALUES
    (1, 'Formación',               'CC-FOR'),   --  1
    (1, 'Matemática',              'CC-MAT'),   --  2
    (1, 'Física',                  'CC-FIS'),   --  3
    (1, 'Historia',                'CC-HIS'),   --  4
    (1, 'Inglés',                  'CC-ING'),   --  5
    (1, 'Lenguaje',                'CC-LEN'),   --  6
    (1, 'Biblioteca',              'CC-BIB'),   --  7
    (1, 'Reproducción de imagen',  'CC-REP'),   --  8
    (1, 'Alemán',                  'CC-ALE'),   --  9
    (1, 'Arte',                    'CC-ART'),   -- 10
    (1, 'Ciencia',                 'CC-CIE'),   -- 11
    (1, 'Pastoral',                'CC-PAS'),   -- 12
    (1, 'Apoyo al aprendizaje',    'CC-APA');   -- 13

INSERT INTO usuario (colegio_id, nombre, email) VALUES
    (1, 'Marcela Ovalle',    'marcela.ovalle@gesemco.test'),        --  1 contabilidad
    (1, 'Andrés Bulnes',     'direccion@santaursula.test'),          --  2 dirección
    (1, 'Tomás Ríos',        'compras@santaursula.test'),            --  3 equipo de compra
    (1, 'Carolina Muñoz',    'carolina.munoz@santaursula.test'),     --  4 jefa Formación
    (1, 'Rodrigo Tapia',     'rodrigo.tapia@santaursula.test'),      --  5 jefe Matemática
    (1, 'Paula Sandoval',    'paula.sandoval@santaursula.test'),     --  6 jefa Física
    (1, 'Javier Contreras',  'javier.contreras@santaursula.test'),   --  7 jefe Historia
    (1, 'Daniela Fuentes',   'daniela.fuentes@santaursula.test'),    --  8 jefa Inglés
    (1, 'Felipe Araya',      'felipe.araya@santaursula.test'),       --  9 jefe Lenguaje
    (1, 'Verónica Soto',     'veronica.soto@santaursula.test'),      -- 10 jefa Biblioteca
    (1, 'Luis Pizarro',      'luis.pizarro@santaursula.test'),       -- 11 jefe Reproducción de imagen
    (1, 'Katrin Weber',      'katrin.weber@santaursula.test'),       -- 12 jefa Alemán
    (1, 'Camila Rojas',      'camila.rojas@santaursula.test'),       -- 13 jefa Arte
    (1, 'Sebastián Vidal',   'sebastian.vidal@santaursula.test'),    -- 14 jefe Ciencia
    (1, 'Isabel Carrasco',   'isabel.carrasco@santaursula.test'),    -- 15 jefa Pastoral
    (1, 'Gabriela Morales',  'gabriela.morales@santaursula.test');   -- 16 jefa Apoyo al aprendizaje

-- Los profesores no usan el sistema: lo que necesita cada departamento lo pide su jefe.
INSERT INTO rol_asignado (usuario_id, rol, departamento_id) VALUES
    ( 1, 'contabilidad',      NULL),
    ( 2, 'direccion',         NULL),
    ( 3, 'equipo_compra',     NULL),
    ( 4, 'jefe_departamento',  1), ( 5, 'jefe_departamento',  2),
    ( 6, 'jefe_departamento',  3), ( 7, 'jefe_departamento',  4),
    ( 8, 'jefe_departamento',  5), ( 9, 'jefe_departamento',  6),
    (10, 'jefe_departamento',  7), (11, 'jefe_departamento',  8),
    (12, 'jefe_departamento',  9), (13, 'jefe_departamento', 10),
    (14, 'jefe_departamento', 11), (15, 'jefe_departamento', 12),
    (16, 'jefe_departamento', 13);


-- ---------------------------------------------------------------------
-- Plan de cuentas y categorías (provisorios)
-- ---------------------------------------------------------------------

INSERT INTO cuenta_contable (codigo, nombre) VALUES
    ('5-1-01', 'Materiales de enseñanza'),                    -- 1
    ('5-1-02', 'Útiles y artículos de oficina'),              -- 2
    ('5-1-03', 'Libros, suscripciones y material de lectura'),-- 3
    ('5-1-04', 'Insumos de laboratorio'),                     -- 4
    ('5-1-05', 'Insumos de impresión y reproducción'),        -- 5
    ('5-1-06', 'Materiales de arte'),                         -- 6
    ('5-1-07', 'Material didáctico y de apoyo'),              -- 7
    ('5-2-01', 'Servicios, salidas y actividades'),           -- 8
    ('5-2-02', 'Equipamiento menor');                         -- 9

INSERT INTO categoria_articulo (nombre, cuenta_contable_id, orden) VALUES
    ('Útiles escolares',          1, 1),
    ('Papelería y oficina',       2, 2),
    ('Arte y manualidades',       6, 3),
    ('Laboratorio y ciencias',    4, 4),
    ('Libros y lectura',          3, 5),
    ('Impresión y reproducción',  5, 6),
    ('Material didáctico',        7, 7),
    ('Equipamiento',              9, 8);


-- ---------------------------------------------------------------------
-- Tiendas, artículos y precios
-- ---------------------------------------------------------------------

INSERT INTO tienda (nombre, url, plataforma, precios_con_iva) VALUES
    ('Dimeiggs',               'https://www.dimeiggs.cl',          'vtex',        true),
    ('Lápiz López',            'https://lapizlopez.cl',            'woocommerce', true),
    ('Librería Nacional',      'https://nacional.cl',              'shopify',     true),
    ('Distribuidor Dimeiggs',  'https://distribuidor.dimeiggs.cl', 'shopify',     NULL),
    ('LABdeCiencias',          'https://labdeciencias.com',        'woocommerce', true),
    ('Bioquímica.cl',          'https://bioquimica.cl',            'woocommerce', NULL),
    ('Tiendita.cl',            'https://www.tiendita.cl',          'woocommerce', NULL),
    ('Precio de ejemplo',      NULL,                               'manual',      true);

INSERT INTO articulo (nombre, unidad, categoria_id) VALUES
    -- Útiles escolares
    ('Cuaderno universitario 100 hojas 7 mm',     'unidad', 1),
    ('Cuaderno college 80 hojas',                 'unidad', 1),
    ('Forro cuaderno college',                    'unidad', 1),
    ('Forro cuaderno universitario',              'unidad', 1),
    ('Pegamento en barra 36 g',                   'unidad', 1),
    ('Lápiz grafito (caja 12)',                   'caja',   1),
    ('Goma de borrar',                            'unidad', 1),
    ('Tijera escolar punta roma',                 'unidad', 1),
    ('Regla 30 cm',                               'unidad', 1),
    ('Calculadora científica',                    'unidad', 1),
    -- Papelería y oficina
    ('Resma papel carta 75 g',                    'resma',  2),
    ('Resma papel oficio 75 g',                   'resma',  2),
    ('Plumón de pizarra (caja 4)',                'caja',   2),
    ('Accoclip plástico (caja 50)',               'caja',   2),
    ('Adhesivo multiuso transparente 100 g',      'unidad', 2),
    ('Cuchillo cartonero grande',                 'unidad', 2),
    -- Arte y manualidades
    ('Témpera frasco 250 ml',                     'frasco', 3),
    ('Témpera frasco 500 ml',                     'frasco', 3),
    ('Témpera estuche 12 colores',                'estuche',3),
    ('Témpera sólida 12 colores',                 'estuche',3),
    ('Acuarela 12 colores con pincel',            'estuche',3),
    ('Block de dibujo medium 99 1/8',             'block',  3),
    ('Silicona en barra (6 unidades)',            'paquete',3),
    ('Set de pinceles escolares',                 'set',    3),
    ('Cartulina de color (pliego)',               'pliego', 3),
    -- Laboratorio y ciencias
    ('Acetona anhidra pura',                      'envase', 4),
    ('Ácido clorhídrico',                         'envase', 4),
    ('Agar nutritivo',                            'envase', 4),
    ('Agitador magnético',                        'unidad', 4),
    ('Balanza mecánica triple brazo',             'unidad', 4),
    ('Tubos de ensayo (caja 12)',                 'caja',   4),
    ('Guantes de nitrilo (caja 100)',             'caja',   4),
    -- Libros y lectura
    ('Libro de lectura complementaria',           'unidad', 5),
    ('Diccionario inglés-español escolar',        'unidad', 5),
    ('Diccionario alemán-español escolar',        'unidad', 5),
    -- Impresión y reproducción
    ('Tóner Brother TN-1060',                     'unidad', 6),
    ('Tóner fotocopiadora (genérico)',            'unidad', 6),
    ('Papel fotocopia carta (caja 10 resmas)',    'caja',   6),
    -- Material didáctico
    ('Ábaco horizontal de madera 10 filas',       'unidad', 7),
    ('Juego terapéutico "Para no meter la pata"', 'unidad', 7),
    ('Material concreto base 10',                 'set',    7),
    -- Equipamiento
    ('Mapa mural de Chile',                       'unidad', 8),
    ('Parlante portátil',                         'unidad', 8);


-- Carga un producto de tienda asociado a un artículo, con su precio.
CREATE FUNCTION pg_temp.oferta(
    p_articulo text, p_tienda text, p_sku text, p_producto text,
    p_marca text, p_precio integer
) RETURNS void AS $$
DECLARE
    v_producto integer;
BEGIN
    INSERT INTO producto_tienda (tienda_id, sku, nombre, marca, articulo_id)
    SELECT t.id, p_sku, p_producto, p_marca, a.id
      FROM tienda t, articulo a
     WHERE t.nombre = p_tienda AND lower(a.nombre) = lower(p_articulo)
    RETURNING id INTO v_producto;

    IF v_producto IS NULL THEN
        RAISE EXCEPTION 'No encontré el artículo "%" o la tienda "%"', p_articulo, p_tienda;
    END IF;

    INSERT INTO precio_observado (producto_tienda_id, precio, observado_en)
    VALUES (v_producto, p_precio, '2026-09-24 12:00-03');
END;
$$ LANGUAGE plpgsql;

-- Precios reales publicados el 24-09-2026
SELECT pg_temp.oferta('Cuaderno universitario 100 hojas 7 mm', 'Lápiz López', 'cuaderno-universitario-7mm-100', 'Cuaderno universitario 7mm 100 hojas', NULL, 1890);
SELECT pg_temp.oferta('Cuaderno universitario 100 hojas 7 mm', 'Lápiz López', 'cuaderno-universitario-7mm-100-simpsons', 'Cuaderno universitario 7MM 100 hojas Simpsons Torre surtido', 'Torre', 2490);
SELECT pg_temp.oferta('Forro cuaderno college', 'Dimeiggs', 'forro-college-naranja-pvc-lavoro', 'Forro Cuaderno College Naranja Pvc Lavoro', 'Lavoro', 690);
SELECT pg_temp.oferta('Forro cuaderno college', 'Dimeiggs', 'forro-college-rojo-murano', 'Forro Cuaderno College Rojo Plastico Murano', 'Murano', 450);
SELECT pg_temp.oferta('Forro cuaderno college', 'Dimeiggs', 'forro-college-azul-murano', 'Forro Cuaderno College Azul Plastico Murano', 'Murano', 450);
SELECT pg_temp.oferta('Forro cuaderno college', 'Dimeiggs', 'forro-college-transparente-lavoro', 'Forro Cuaderno College Transparente Pvc Lavoro', 'Lavoro', 690);
SELECT pg_temp.oferta('Forro cuaderno universitario', 'Dimeiggs', 'forro-universitario-cafe-rhein', 'Forro Cuaderno Universitario Pvc Cafe Rhein', 'Rhein', 750);
SELECT pg_temp.oferta('Forro cuaderno universitario', 'Dimeiggs', 'forro-universitario-verde-murano', 'Forro Cuaderno Universitario Verde Plastico Murano', 'Murano', 550);
SELECT pg_temp.oferta('Forro cuaderno universitario', 'Dimeiggs', 'forro-universitario-azul-murano', 'Forro Cuaderno Universitario Azul Plastico Murano', 'Murano', 550);
SELECT pg_temp.oferta('Pegamento en barra 36 g', 'Distribuidor Dimeiggs', 'pegamento-barra-36-rhein', 'Pegamento En Barra 36 Grs Rhein', 'Rhein', 525);
SELECT pg_temp.oferta('Accoclip plástico (caja 50)', 'Distribuidor Dimeiggs', 'accoclip-plastico-50-fultons', 'Accoclip Plastico Caja 50 Unidades Colores Surtidos Fultons', 'Fultons', 846);
SELECT pg_temp.oferta('Adhesivo multiuso transparente 100 g', 'Distribuidor Dimeiggs', 'adhesivo-multifix-pritt-100', 'Adhesivo Multifix Transparente Pritt 100 Gr Henkel', 'Pritt', 2128);
SELECT pg_temp.oferta('Cuchillo cartonero grande', 'Dimeiggs', 'cuchillo-cartonero-grande-lavoro', 'Cuchillo Cartonero Grande Bloqueo Automatico Lavoro', 'Lavoro', 1890);
SELECT pg_temp.oferta('Cuchillo cartonero grande', 'Dimeiggs', 'cuchillo-cartonero-grande-murano', 'Cuchillo Cartonero Grande Plastico Metal Corriente Murano', 'Murano', 690);
SELECT pg_temp.oferta('Témpera frasco 250 ml', 'Librería Nacional', 'frasco-tempera-artel-250', 'Frasco Témpera Artel 250 ml', 'Artel', 1990);
SELECT pg_temp.oferta('Témpera frasco 500 ml', 'Librería Nacional', 'frasco-tempera-artel-500', 'Frasco Témpera Artel 500ml', 'Artel', 3990);
SELECT pg_temp.oferta('Témpera estuche 12 colores', 'Librería Nacional', 'estuche-tempera-12-artel', 'Estuche Tempera 12 Colores Artel', 'Artel', 1990);
SELECT pg_temp.oferta('Témpera sólida 12 colores', 'Librería Nacional', 'tempera-solida-12', 'Tempera Solida 12 colores', NULL, 6490);
SELECT pg_temp.oferta('Acuarela 12 colores con pincel', 'Distribuidor Dimeiggs', 'acuarela-solida-12-rhein', 'Acuarela Solida 12 Colores + Pincel Rhein', 'Rhein', 1355);
SELECT pg_temp.oferta('Acuarela 12 colores con pincel', 'Distribuidor Dimeiggs', 'acuarelas-set-12-murano', 'Acuarelas Set Con Pincel 12 Colores Murano', 'Murano', 1178);
SELECT pg_temp.oferta('Block de dibujo medium 99 1/8', 'Lápiz López', 'block-dibujo-medium-99-18', 'Block de dibujo medium 99 1/8 20 hojas', NULL, 2090);
SELECT pg_temp.oferta('Silicona en barra (6 unidades)', 'Distribuidor Dimeiggs', 'silicona-barra-6-artcraft', 'Adhesivo En Barra Silicona Transparente 6 Unidades Art&Craft', 'Art&Craft', 1590);
SELECT pg_temp.oferta('Acetona anhidra pura', 'LABdeCiencias', 'acetona-anhidra-pura', 'Acetona Anhidra Pura', NULL, 9360);
SELECT pg_temp.oferta('Ácido clorhídrico', 'LABdeCiencias', 'acido-clorhidrico', 'Acido Clorhidrico', NULL, 4950);
SELECT pg_temp.oferta('Agar nutritivo', 'Bioquímica.cl', 'agar-nutritivo', 'Agar Nutritivo', NULL, 11241);
SELECT pg_temp.oferta('Agitador magnético', 'Bioquímica.cl', 'agitador-magnetico-bs-2h', 'Agitador Magnetico BS-2H', NULL, 196350);
SELECT pg_temp.oferta('Balanza mecánica triple brazo', 'Bioquímica.cl', 'balanza-mecanica-triple-haz', 'Balanza mecánica triple haz', NULL, 103530);
SELECT pg_temp.oferta('Tóner Brother TN-1060', 'Dimeiggs', 'toner-tn1060-brother', 'Toner Tn1060 Negro P/1512 Brother', 'Brother', 41990);
SELECT pg_temp.oferta('Ábaco horizontal de madera 10 filas', 'Distribuidor Dimeiggs', 'abaco-horizontal-madera-10-nobel', 'Abaco Horizontal Madera 10 Filas 30 x 22 Cms Nobel Toys', 'Nobel Toys', 4840);
SELECT pg_temp.oferta('Juego terapéutico "Para no meter la pata"', 'Tiendita.cl', 'para-no-meter-la-pata', 'PARA NO METER LA PATA', NULL, 26768);

-- Precios ilustrativos, sin fuente real
SELECT pg_temp.oferta('Cuaderno college 80 hojas',              'Precio de ejemplo', 'EJ-001', 'Cuaderno college 80 hojas', NULL, 1290);
SELECT pg_temp.oferta('Lápiz grafito (caja 12)',                'Precio de ejemplo', 'EJ-002', 'Lápiz grafito caja 12', NULL, 2490);
SELECT pg_temp.oferta('Goma de borrar',                         'Precio de ejemplo', 'EJ-003', 'Goma de borrar', NULL, 350);
SELECT pg_temp.oferta('Tijera escolar punta roma',              'Precio de ejemplo', 'EJ-004', 'Tijera escolar punta roma', NULL, 990);
SELECT pg_temp.oferta('Regla 30 cm',                            'Precio de ejemplo', 'EJ-005', 'Regla 30 cm', NULL, 590);
SELECT pg_temp.oferta('Calculadora científica',                 'Precio de ejemplo', 'EJ-006', 'Calculadora científica', NULL, 24900);
SELECT pg_temp.oferta('Resma papel carta 75 g',                 'Precio de ejemplo', 'EJ-007', 'Resma papel carta 75 g 500 hojas', NULL, 4990);
SELECT pg_temp.oferta('Resma papel oficio 75 g',                'Precio de ejemplo', 'EJ-008', 'Resma papel oficio 75 g 500 hojas', NULL, 5990);
SELECT pg_temp.oferta('Plumón de pizarra (caja 4)',             'Precio de ejemplo', 'EJ-009', 'Plumón de pizarra caja 4', NULL, 3990);
SELECT pg_temp.oferta('Set de pinceles escolares',              'Precio de ejemplo', 'EJ-010', 'Set de pinceles escolares', NULL, 3490);
SELECT pg_temp.oferta('Cartulina de color (pliego)',            'Precio de ejemplo', 'EJ-011', 'Cartulina de color pliego', NULL, 350);
SELECT pg_temp.oferta('Tubos de ensayo (caja 12)',              'Precio de ejemplo', 'EJ-012', 'Tubos de ensayo caja 12', NULL, 5990);
SELECT pg_temp.oferta('Guantes de nitrilo (caja 100)',          'Precio de ejemplo', 'EJ-013', 'Guantes de nitrilo caja 100', NULL, 7990);
SELECT pg_temp.oferta('Libro de lectura complementaria',        'Precio de ejemplo', 'EJ-014', 'Libro de lectura complementaria', NULL, 12990);
SELECT pg_temp.oferta('Diccionario inglés-español escolar',     'Precio de ejemplo', 'EJ-015', 'Diccionario inglés-español escolar', NULL, 12990);
SELECT pg_temp.oferta('Diccionario alemán-español escolar',     'Precio de ejemplo', 'EJ-016', 'Diccionario alemán-español escolar', NULL, 15990);
SELECT pg_temp.oferta('Tóner fotocopiadora (genérico)',         'Precio de ejemplo', 'EJ-017', 'Tóner fotocopiadora genérico', NULL, 29990);
SELECT pg_temp.oferta('Papel fotocopia carta (caja 10 resmas)', 'Precio de ejemplo', 'EJ-018', 'Papel fotocopia carta caja 10 resmas', NULL, 45990);
SELECT pg_temp.oferta('Material concreto base 10',              'Precio de ejemplo', 'EJ-019', 'Material concreto base 10', NULL, 18990);
SELECT pg_temp.oferta('Mapa mural de Chile',                    'Precio de ejemplo', 'EJ-020', 'Mapa mural de Chile', NULL, 24990);
SELECT pg_temp.oferta('Parlante portátil',                      'Precio de ejemplo', 'EJ-021', 'Parlante portátil', NULL, 29990);

-- Un producto que el scraper trajo y nadie ha clasificado todavía.
INSERT INTO producto_tienda (tienda_id, sku, nombre, marca)
SELECT id, 'repuesto-cuchillo-cartonero-10-murano',
       'Repuesto Para Cuchillo Cartonero Grande 10 Unidades Murano', 'Murano'
  FROM tienda WHERE nombre = 'Dimeiggs';
INSERT INTO precio_observado (producto_tienda_id, precio, observado_en)
SELECT id, 990, '2026-09-24 12:00-03' FROM producto_tienda
 WHERE sku = 'repuesto-cuchillo-cartonero-10-murano';


-- ---------------------------------------------------------------------
-- Ayudas para cargar presupuestos y pedidos como lo haría la app
-- ---------------------------------------------------------------------

-- Una fecha y hora de Chile, sin pensar en el horario de verano.
CREATE FUNCTION pg_temp.cl(p_momento text) RETURNS timestamptz AS $$
    SELECT p_momento::timestamp AT TIME ZONE 'America/Santiago';
$$ LANGUAGE sql IMMUTABLE;

-- El presupuesto de un departamento en un año. Lo crea su jefe, que
-- queda como quien actúa hasta el próximo cambio.
CREATE FUNCTION pg_temp.presupuesto(p_depto text, p_anio integer) RETURNS integer AS $$
DECLARE
    v_jefe  integer;
    v_id    integer;
BEGIN
    SELECT r.usuario_id INTO v_jefe
      FROM rol_asignado r JOIN departamento d ON d.id = r.departamento_id
     WHERE r.rol = 'jefe_departamento' AND r.hasta IS NULL AND d.nombre = p_depto;
    PERFORM set_config('app.usuario_id', v_jefe::text, true);

    INSERT INTO presupuesto_departamento (departamento_id, anio_id)
    SELECT d.id, ap.id
      FROM departamento d, anio_presupuestario ap
     WHERE d.nombre = p_depto AND ap.anio = p_anio
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION pg_temp.programa(p_presupuesto integer, p_nombre text, p_descripcion text)
RETURNS integer AS $$
    INSERT INTO programa (presupuesto_id, nombre, descripcion, creado_por)
    VALUES (p_presupuesto, p_nombre, p_descripcion, fn_usuario_actual())
    RETURNING id;
$$ LANGUAGE sql;

-- Los meses de una línea: '{"4": 30, "6": 15}' son 30 en abril y 15 en junio.
CREATE FUNCTION pg_temp.meses(p_linea integer, p_meses jsonb) RETURNS integer AS $$
BEGIN
    IF p_meses IS NOT NULL THEN
        INSERT INTO linea_calendario (linea_id, mes, cantidad)
        SELECT p_linea, key::smallint, value::integer FROM jsonb_each_text(p_meses);
    END IF;
    RETURN p_linea;
END;
$$ LANGUAGE plpgsql;

-- Línea desde el catálogo, al precio de referencia (mediana de ofertas),
-- con sus meses.
CREATE FUNCTION pg_temp.linea(
    p_programa integer, p_articulo text, p_cantidad integer, p_meses jsonb DEFAULT NULL, p_origen text DEFAULT NULL
) RETURNS integer AS $$
DECLARE
    v_id integer;
BEGIN
    INSERT INTO linea_presupuesto (programa_id, articulo_id, descripcion, cantidad,
                                   precio_unitario, cuenta_contable_id, origen_precio)
    SELECT p_programa, c.articulo_id, c.nombre, p_cantidad, c.precio_referencia, c.cuenta_contable_id,
           COALESCE(p_origen,
               CASE WHEN c.ofertas = 1
                    THEN (SELECT pv.tienda FROM vw_precio_vigente pv WHERE pv.articulo_id = c.articulo_id)
                    ELSE 'Precio del medio entre ' || c.ofertas || ' ofertas' END
               || ' al ' || to_char(c.actualizado_en AT TIME ZONE 'America/Santiago', 'DD-MM-YYYY'))
      FROM vw_catalogo_articulo c
     WHERE lower(c.nombre) = lower(p_articulo)
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
        RAISE EXCEPTION 'No encontré el artículo "%" en el catálogo', p_articulo;
    END IF;
    RETURN pg_temp.meses(v_id, p_meses);
END;
$$ LANGUAGE plpgsql;

-- Línea libre, fuera de catálogo, con sus meses.
CREATE FUNCTION pg_temp.linea_libre(
    p_programa integer, p_descripcion text, p_cantidad integer, p_precio integer,
    p_cuenta text, p_origen text, p_meses jsonb DEFAULT NULL
) RETURNS integer AS $$
DECLARE
    v_id integer;
BEGIN
    INSERT INTO linea_presupuesto (programa_id, descripcion, cantidad, precio_unitario,
                                   cuenta_contable_id, origen_precio)
    SELECT p_programa, p_descripcion, p_cantidad, p_precio, cc.id, p_origen
      FROM cuenta_contable cc WHERE cc.codigo = p_cuenta
    RETURNING id INTO v_id;
    RETURN pg_temp.meses(v_id, p_meses);
END;
$$ LANGUAGE plpgsql;

-- El camino completo de un presupuesto: el jefe lo envía, Dirección lo
-- aprueba y, si se pide, contabilidad también.
CREATE FUNCTION pg_temp.aprobar(p_presupuesto integer, p_tambien_contabilidad boolean) RETURNS void AS $$
BEGIN
    UPDATE presupuesto_departamento SET estado = 'enviado' WHERE id = p_presupuesto;
    PERFORM set_config('app.usuario_id', '2', true);   -- Andrés Bulnes, Dirección
    UPDATE presupuesto_departamento SET estado = 'revision_contabilidad' WHERE id = p_presupuesto;
    IF p_tambien_contabilidad THEN
        PERFORM set_config('app.usuario_id', '1', true);   -- Marcela Ovalle, contabilidad
        UPDATE presupuesto_departamento SET estado = 'aprobado' WHERE id = p_presupuesto;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Un pedido del jefe contra el presupuesto en ejecución, como lo hace la
-- app: se crea en borrador con la fecha en que se necesita, se carga el
-- ítem y se pide. La base decide si pasa a compra o espera a Dirección.
-- p_pedido_en es cuándo se pidió: la anticipación se cuenta desde ahí.
--   {"linea": 12, "cantidad": 30}                         una línea por id
--   {"linea": "Témpera frasco 250 ml", "cantidad": 30}    o por nombre (con "programa" si se repite)
--   {"articulo": "Mapa mural de Chile", "cantidad": 6}    del catálogo, fuera del presupuesto
--   {"descripcion": "…", "cantidad": 1, "precio": 9990, "cuenta": "5-1-06"}   a mano, fuera del presupuesto
CREATE FUNCTION pg_temp.pedido(
    p_depto text, p_pedido_en timestamptz, p_necesaria date, p_item jsonb, p_observacion text
) RETURNS integer AS $$
DECLARE
    v_pres   integer;
    v_jefe   integer;
    v_orden  integer;
BEGIN
    SELECT pd.id, r.usuario_id INTO v_pres, v_jefe
      FROM presupuesto_departamento pd
      JOIN departamento d         ON d.id = pd.departamento_id
      JOIN anio_presupuestario ap ON ap.id = pd.anio_id AND ap.etapa = 'ejecucion'
      JOIN rol_asignado r         ON r.departamento_id = d.id AND r.rol = 'jefe_departamento' AND r.hasta IS NULL
     WHERE d.nombre = p_depto;
    IF v_pres IS NULL THEN
        RAISE EXCEPTION 'No encontré el presupuesto en ejecución de %', p_depto;
    END IF;

    PERFORM set_config('app.usuario_id', v_jefe::text, true);

    INSERT INTO orden_compra (folio, presupuesto_id, emitida_por, necesaria_para, observacion, creado_en)
    VALUES (fn_folio('OC', v_pres), v_pres, v_jefe, p_necesaria, p_observacion, p_pedido_en)
    RETURNING id INTO v_orden;

    IF p_item ? 'linea' THEN
        INSERT INTO item_orden (orden_id, linea_id, articulo_id, descripcion, cantidad,
                                precio_presupuesto, cuenta_contable_id)
        SELECT v_orden, l.id, l.articulo_id, l.descripcion, (p_item ->> 'cantidad')::integer,
               l.precio_unitario, l.cuenta_contable_id
          FROM linea_presupuesto l
          JOIN programa p ON p.id = l.programa_id
         WHERE p.presupuesto_id = v_pres
           AND CASE WHEN jsonb_typeof(p_item -> 'linea') = 'number'
                    THEN l.id = (p_item ->> 'linea')::integer
                    ELSE lower(l.descripcion) = lower(p_item ->> 'linea')
                         AND (NOT p_item ? 'programa' OR p.nombre = p_item ->> 'programa') END
         ORDER BY l.id
         LIMIT 1;
    ELSIF p_item ? 'articulo' THEN
        INSERT INTO item_orden (orden_id, articulo_id, descripcion, cantidad,
                                precio_presupuesto, cuenta_contable_id)
        SELECT v_orden, c.articulo_id, c.nombre, (p_item ->> 'cantidad')::integer,
               c.precio_referencia, c.cuenta_contable_id
          FROM vw_catalogo_articulo c
         WHERE lower(c.nombre) = lower(p_item ->> 'articulo');
    ELSE
        INSERT INTO item_orden (orden_id, descripcion, cantidad, precio_presupuesto, cuenta_contable_id)
        VALUES (v_orden, p_item ->> 'descripcion', (p_item ->> 'cantidad')::integer,
                (p_item ->> 'precio')::integer,
                (SELECT id FROM cuenta_contable WHERE codigo = p_item ->> 'cuenta'));
    END IF;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No encontré el ítem % para el pedido de %', p_item, p_depto;
    END IF;

    UPDATE orden_compra SET estado = 'emitida' WHERE id = v_orden;
    RETURN v_orden;
END;
$$ LANGUAGE plpgsql;

-- El equipo de compra registra lo que pagó: el pedido queda comprado.
CREATE FUNCTION pg_temp.comprar(p_orden integer, p_fecha date, p_monto integer, p_proveedor text, p_documento text)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.usuario_id', '3', true);   -- Tomás Ríos, equipo de compra
    INSERT INTO compra (orden_id, proveedor, tipo_documento, numero_documento, fecha_compra,
                        monto_total, registrada_por, creado_en)
    VALUES (p_orden, p_proveedor,
            CASE WHEN p_documento LIKE 'B-%' THEN 'boleta' ELSE 'factura' END::tipo_documento,
            p_documento, p_fecha, p_monto, 3, pg_temp.cl(p_fecha || ' 16:00'));
END;
$$ LANGUAGE plpgsql;

-- El jefe confirma que llegó: el pedido queda recibido.
CREATE FUNCTION pg_temp.recibir(p_orden integer, p_fecha date) RETURNS void AS $$
DECLARE
    v_jefe integer;
BEGIN
    SELECT emitida_por INTO v_jefe FROM orden_compra WHERE id = p_orden;
    PERFORM set_config('app.usuario_id', v_jefe::text, true);
    INSERT INTO recepcion (orden_id, recibido_por, fecha_recepcion) VALUES (p_orden, v_jefe, p_fecha);
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------
-- 2026 · en ejecución
--
-- Se formuló en octubre de 2025, con los meses de cada ítem, y se aprobó
-- en noviembre. Los precios de las líneas del catálogo son los de hoy,
-- marcados como precio de referencia 2025.
-- ---------------------------------------------------------------------

DO $$
DECLARE
    v_pres  integer;
    v_prog  integer;
    v_ref   text := 'Precio de referencia 2025';
BEGIN
    -- Formación
    v_pres := pg_temp.presupuesto('Formación', 2026);
    v_prog := pg_temp.programa(v_pres, 'Jornadas de convivencia', 'Una jornada por curso, de abril a octubre.');
    PERFORM pg_temp.linea_libre(v_prog, 'Arriendo de casa de retiro (por jornada)', 6, 180000, '5-2-01', 'Cotización 2025', '{"4": 2, "6": 2, "9": 1, "10": 1}');
    PERFORM pg_temp.linea_libre(v_prog, 'Colaciones para la jornada', 6, 45000, '5-2-01', 'Estimación de la jefa', '{"4": 2, "6": 2, "9": 1, "10": 1}');
    v_prog := pg_temp.programa(v_pres, 'Material de orientación', 'Para las clases de orientación de 5° básico a IV medio.');
    PERFORM pg_temp.linea(v_prog, 'Block de dibujo medium 99 1/8', 40, '{"3": 40}', v_ref);
    PERFORM pg_temp.linea(v_prog, 'Plumón de pizarra (caja 4)', 10, '{"3": 10}', v_ref);
    PERFORM pg_temp.linea(v_prog, 'Cartulina de color (pliego)', 100, '{"3": 60, "8": 40}', v_ref);
    v_prog := pg_temp.programa(v_pres, 'Semana de la familia', 'Actividades con las familias en mayo.');
    PERFORM pg_temp.linea_libre(v_prog, 'Amplificación y sonido', 1, 150000, '5-2-01', 'Cotización 2025', '{"5": 1}');
    PERFORM pg_temp.linea(v_prog, 'Parlante portátil', 1, '{"5": 1}', v_ref);
    PERFORM pg_temp.aprobar(v_pres, true);

    -- Matemática
    v_pres := pg_temp.presupuesto('Matemática', 2026);
    v_prog := pg_temp.programa(v_pres, 'Material para las clases', 'Calculadoras y material de pizarra para 7° básico a IV medio.');
    PERFORM pg_temp.linea(v_prog, 'Calculadora científica', 30, '{"3": 30}', v_ref);
    PERFORM pg_temp.linea(v_prog, 'Plumón de pizarra (caja 4)', 40, '{"3": 20, "8": 10, "10": 10}', v_ref);
    PERFORM pg_temp.linea(v_prog, 'Resma papel carta 75 g', 40, '{"3": 20, "7": 20}', v_ref);
    v_prog := pg_temp.programa(v_pres, 'Material concreto 1° ciclo', 'Material manipulable para 1° a 4° básico.');
    PERFORM pg_temp.linea(v_prog, 'Material concreto base 10', 20, '{"3": 20}', v_ref);
    PERFORM pg_temp.linea(v_prog, 'Ábaco horizontal de madera 10 filas', 20, '{"3": 20}', v_ref);
    v_prog := pg_temp.programa(v_pres, 'Olimpiada de matemática', 'Preparación y participación en la olimpiada regional y nacional.');
    PERFORM pg_temp.linea_libre(v_prog, 'Inscripción Olimpiada Nacional de Matemática', 1, 120000, '5-2-01', 'Valor de la inscripción 2025', '{"5": 1}');
    PERFORM pg_temp.linea_libre(v_prog, 'Traslado y colación de la delegación', 1, 280000, '5-2-01', 'Estimación del jefe', '{"9": 1}');
    PERFORM pg_temp.linea(v_prog, 'Calculadora científica', 10, '{"8": 10}', v_ref);
    PERFORM pg_temp.aprobar(v_pres, true);

    -- Física
    v_pres := pg_temp.presupuesto('Física', 2026);
    v_prog := pg_temp.programa(v_pres, 'Laboratorio de física', 'Material para las prácticas de 1° a IV medio.');
    PERFORM pg_temp.linea(v_prog, 'Balanza mecánica triple brazo', 6, '{"3": 6}', v_ref);
    PERFORM pg_temp.linea_libre(v_prog, 'Kit de óptica (lentes y espejos)', 4, 89000, '5-1-04', 'Cotización 2025', '{"4": 4}');
    PERFORM pg_temp.linea_libre(v_prog, 'Kit de circuitos eléctricos', 6, 64900, '5-1-04', 'Cotización 2025', '{"8": 6}');
    v_prog := pg_temp.programa(v_pres, 'Feria científica', 'Muestra de los proyectos de los alumnos, a fines de octubre.');
    PERFORM pg_temp.linea(v_prog, 'Cartulina de color (pliego)', 80, '{"10": 80}', v_ref);
    PERFORM pg_temp.linea_libre(v_prog, 'Paneles para stands (arriendo)', 10, 18000, '5-2-01', 'Estimación de la jefa', '{"10": 10}');
    PERFORM pg_temp.linea(v_prog, 'Silicona en barra (6 unidades)', 20, '{"10": 20}', v_ref);
    v_prog := pg_temp.programa(v_pres, 'Material para las clases', 'Plumones y calculadoras para las salas de física.');
    PERFORM pg_temp.linea(v_prog, 'Plumón de pizarra (caja 4)', 12, '{"3": 6, "8": 6}', v_ref);
    PERFORM pg_temp.linea(v_prog, 'Calculadora científica', 6, '{"3": 6}', v_ref);
    PERFORM pg_temp.aprobar(v_pres, true);

    -- Historia
    v_pres := pg_temp.presupuesto('Historia', 2026);
    v_prog := pg_temp.programa(v_pres, 'Salida pedagógica', 'Visita al Museo Histórico Nacional con los segundos medios.');
    PERFORM pg_temp.linea_libre(v_prog, 'Arriendo de buses', 2, 550000, '5-2-01', 'Cotización 2025', '{"6": 2}');
    v_prog := pg_temp.programa(v_pres, 'Material para las clases', 'Material de apoyo para 7° básico a II medio.');
    PERFORM pg_temp.linea(v_prog, 'Resma papel carta 75 g', 6, '{"3": 3, "8": 3}', v_ref);
    PERFORM pg_temp.linea(v_prog, 'Plumón de pizarra (caja 4)', 8, '{"3": 8}', v_ref);
    PERFORM pg_temp.aprobar(v_pres, true);

    -- Inglés
    v_pres := pg_temp.presupuesto('Inglés', 2026);
    v_prog := pg_temp.programa(v_pres, 'Material para las clases', 'Diccionarios, cuadernos y parlantes para las salas de inglés.');
    PERFORM pg_temp.linea(v_prog, 'Diccionario inglés-español escolar', 30, '{"3": 30}', v_ref);
    PERFORM pg_temp.linea(v_prog, 'Cuaderno universitario 100 hojas 7 mm', 60, '{"3": 60}', v_ref);
    PERFORM pg_temp.linea(v_prog, 'Parlante portátil', 4, '{"3": 4}', v_ref);
    v_prog := pg_temp.programa(v_pres, 'English Week', 'Semana del inglés en agosto, con concursos y una obra de teatro.');
    PERFORM pg_temp.linea_libre(v_prog, 'Premios de los concursos', 1, 120000, '5-1-07', 'Estimación de la jefa', '{"8": 1}');
    PERFORM pg_temp.linea(v_prog, 'Cartulina de color (pliego)', 60, '{"8": 60}', v_ref);
    PERFORM pg_temp.linea_libre(v_prog, 'Vestuario para la obra', 1, 90000, '5-1-07', 'Estimación de la jefa', '{"8": 1}');
    v_prog := pg_temp.programa(v_pres, 'Debate interescolar', 'Torneo de debate en inglés, en noviembre.');
    PERFORM pg_temp.linea_libre(v_prog, 'Inscripción torneo de debate', 1, 60000, '5-2-01', 'Valor 2025', '{"11": 1}');
    PERFORM pg_temp.linea_libre(v_prog, 'Traslado del equipo', 1, 80000, '5-2-01', 'Estimación de la jefa', '{"11": 1}');
    PERFORM pg_temp.aprobar(v_pres, true);

    -- Lenguaje
    v_pres := pg_temp.presupuesto('Lenguaje', 2026);
    v_prog := pg_temp.programa(v_pres, 'Plan lector de aula', 'Libros para leer en clases, de 5° básico a II medio.');
    PERFORM pg_temp.linea(v_prog, 'Libro de lectura complementaria', 60, '{"3": 30, "8": 30}', v_ref);
    v_prog := pg_temp.programa(v_pres, 'Concurso de cuento', 'Concurso de cuento del colegio, en septiembre, y su antología.');
    PERFORM pg_temp.linea_libre(v_prog, 'Premios del concurso', 1, 150000, '5-1-07', 'Estimación del jefe', '{"9": 1}');
    PERFORM pg_temp.linea_libre(v_prog, 'Impresión de la antología', 100, 2500, '5-1-05', 'Cotización 2025', '{"11": 100}');
    v_prog := pg_temp.programa(v_pres, 'Material para las clases', 'Papel y plumones para las salas de lenguaje.');
    PERFORM pg_temp.linea(v_prog, 'Resma papel carta 75 g', 30, '{"3": 15, "7": 15}', v_ref);
    PERFORM pg_temp.linea(v_prog, 'Plumón de pizarra (caja 4)', 15, '{"3": 15}', v_ref);
    PERFORM pg_temp.aprobar(v_pres, true);

    -- Biblioteca
    v_pres := pg_temp.presupuesto('Biblioteca', 2026);
    v_prog := pg_temp.programa(v_pres, 'Plan lector 2026', 'Títulos del plan lector para todo el colegio.');
    PERFORM pg_temp.linea_libre(v_prog, 'Libros del plan lector 2026 (lote)', 1, 2600000, '5-1-03', 'Cotización de la editorial', '{"3": 1}');
    v_prog := pg_temp.programa(v_pres, 'Sala de estudio', 'Diccionarios para la sala de estudio.');
    PERFORM pg_temp.linea(v_prog, 'Diccionario inglés-español escolar', 6, '{"4": 6}', v_ref);
    PERFORM pg_temp.linea(v_prog, 'Diccionario alemán-español escolar', 4, '{"4": 4}', v_ref);
    v_prog := pg_temp.programa(v_pres, 'Día del libro', 'Feria del libro en abril, con un autor invitado.');
    PERFORM pg_temp.linea_libre(v_prog, 'Visita de autor invitado', 1, 180000, '5-2-01', 'Cotización del autor', '{"4": 1}');
    PERFORM pg_temp.aprobar(v_pres, true);

    -- Reproducción de imagen
    v_pres := pg_temp.presupuesto('Reproducción de imagen', 2026);
    v_prog := pg_temp.programa(v_pres, 'Operación de fotocopiado', 'Papel y tóner para las guías y evaluaciones de todo el colegio.');
    PERFORM pg_temp.linea(v_prog, 'Papel fotocopia carta (caja 10 resmas)', 100,
        '{"3": 20, "4": 10, "5": 10, "6": 10, "7": 5, "8": 15, "9": 10, "10": 10, "11": 10}', v_ref);
    PERFORM pg_temp.linea(v_prog, 'Tóner fotocopiadora (genérico)', 24, '{"3": 4, "5": 4, "7": 4, "8": 4, "10": 8}', v_ref);
    PERFORM pg_temp.linea(v_prog, 'Tóner Brother TN-1060', 8, '{"3": 2, "6": 2, "8": 2, "10": 2}', v_ref);
    v_prog := pg_temp.programa(v_pres, 'Mantención de equipos', 'Mantención de las fotocopiadoras cada trimestre.');
    PERFORM pg_temp.linea_libre(v_prog, 'Mantención de fotocopiadoras', 4, 120000, '5-2-01', 'Contrato 2025', '{"3": 1, "6": 1, "9": 1, "12": 1}');
    PERFORM pg_temp.aprobar(v_pres, true);

    -- Alemán
    v_pres := pg_temp.presupuesto('Alemán', 2026);
    v_prog := pg_temp.programa(v_pres, 'Material para las clases', 'Diccionarios y cuadernos para 7° básico.');
    PERFORM pg_temp.linea(v_prog, 'Diccionario alemán-español escolar', 20, '{"3": 20}', v_ref);
    PERFORM pg_temp.linea(v_prog, 'Cuaderno college 80 hojas', 60, '{"3": 60}', v_ref);
    v_prog := pg_temp.programa(v_pres, 'Intercambio con Alemania', 'Recepción de los alumnos del colegio de intercambio, en agosto.');
    PERFORM pg_temp.linea_libre(v_prog, 'Actividades con los alumnos de intercambio', 1, 450000, '5-2-01', 'Estimación de la jefa', '{"8": 1}');
    PERFORM pg_temp.linea_libre(v_prog, 'Regalos de bienvenida', 25, 8000, '5-1-07', 'Estimación de la jefa', '{"8": 25}');
    v_prog := pg_temp.programa(v_pres, 'Semana alemana', 'Feria con comida y música en octubre.');
    PERFORM pg_temp.linea(v_prog, 'Cartulina de color (pliego)', 40, '{"10": 40}', v_ref);
    PERFORM pg_temp.linea_libre(v_prog, 'Insumos para la feria', 1, 150000, '5-2-01', 'Estimación de la jefa', '{"10": 1}');
    PERFORM pg_temp.aprobar(v_pres, true);

    -- Arte
    v_pres := pg_temp.presupuesto('Arte', 2026);
    v_prog := pg_temp.programa(v_pres, 'Material para las clases', 'Témperas, blocks, pinceles y cartulinas para 1° básico a II medio.');
    PERFORM pg_temp.linea(v_prog, 'Témpera frasco 250 ml', 120, '{"3": 40, "5": 30, "8": 20, "10": 30}', v_ref);
    PERFORM pg_temp.linea(v_prog, 'Block de dibujo medium 99 1/8', 150, '{"3": 100, "8": 50}', v_ref);
    PERFORM pg_temp.linea(v_prog, 'Set de pinceles escolares', 40, '{"3": 40}', v_ref);
    PERFORM pg_temp.linea(v_prog, 'Cartulina de color (pliego)', 200, '{"4": 100, "9": 100}', v_ref);
    v_prog := pg_temp.programa(v_pres, 'Muestra de invierno', 'Exposición de trabajos en julio.');
    PERFORM pg_temp.linea(v_prog, 'Témpera frasco 500 ml', 20, '{"6": 20}', v_ref);
    PERFORM pg_temp.linea_libre(v_prog, 'Paneles y montaje de la muestra', 1, 160000, '5-2-01', 'Cotización 2025', '{"7": 1}');
    v_prog := pg_temp.programa(v_pres, 'Día del arte', 'Jornada abierta a las familias, en septiembre.');
    PERFORM pg_temp.linea_libre(v_prog, 'Arriendo de toldos', 2, 85000, '5-2-01', 'Cotización 2025', '{"9": 2}');
    PERFORM pg_temp.linea(v_prog, 'Témpera frasco 500 ml', 12, '{"9": 12}', v_ref);
    v_prog := pg_temp.programa(v_pres, 'Muestra de arte de fin de año', 'Trabajos de 5° básico a IV medio que se exponen en noviembre.');
    PERFORM pg_temp.linea_libre(v_prog, 'Montaje de la muestra', 1, 180000, '5-2-01', 'Estimación de la jefa', '{"11": 1}');
    PERFORM pg_temp.linea(v_prog, 'Silicona en barra (6 unidades)', 20, '{"11": 20}', v_ref);
    PERFORM pg_temp.aprobar(v_pres, true);

    -- Ciencia
    v_pres := pg_temp.presupuesto('Ciencia', 2026);
    v_prog := pg_temp.programa(v_pres, 'Renovación del laboratorio', 'Microscopios nuevos para el laboratorio de biología.');
    PERFORM pg_temp.linea_libre(v_prog, 'Microscopios escolares (lote de 10)', 1, 2900000, '5-2-02', 'Cotización del proveedor', '{"4": 1}');
    v_prog := pg_temp.programa(v_pres, 'Laboratorio 1° y 2° medio', 'Reactivos e insumos para las prácticas.');
    PERFORM pg_temp.linea(v_prog, 'Acetona anhidra pura', 4, '{"3": 2, "8": 2}', v_ref);
    PERFORM pg_temp.linea(v_prog, 'Ácido clorhídrico', 4, '{"3": 2, "8": 2}', v_ref);
    PERFORM pg_temp.linea(v_prog, 'Guantes de nitrilo (caja 100)', 10, '{"3": 5, "8": 5}', v_ref);
    PERFORM pg_temp.linea(v_prog, 'Tubos de ensayo (caja 12)', 10, '{"3": 10}', v_ref);
    PERFORM pg_temp.linea(v_prog, 'Agar nutritivo', 4, '{"5": 4}', v_ref);
    PERFORM pg_temp.aprobar(v_pres, true);

    -- Pastoral
    v_pres := pg_temp.presupuesto('Pastoral', 2026);
    v_prog := pg_temp.programa(v_pres, 'Retiros espirituales', 'Retiro de III medio en mayo y de IV medio en agosto.');
    PERFORM pg_temp.linea_libre(v_prog, 'Arriendo de casa de retiro', 2, 220000, '5-2-01', 'Cotización 2025', '{"5": 1, "8": 1}');
    PERFORM pg_temp.linea_libre(v_prog, 'Alimentación del retiro', 2, 95000, '5-2-01', 'Estimación de la jefa', '{"5": 1, "8": 1}');
    v_prog := pg_temp.programa(v_pres, 'Misa de fin de año', 'Celebración de cierre del año escolar, en noviembre.');
    PERFORM pg_temp.linea_libre(v_prog, 'Flores y ornamentación', 1, 60000, '5-2-01', 'Estimación de la jefa', '{"11": 1}');
    PERFORM pg_temp.linea(v_prog, 'Cartulina de color (pliego)', 50, '{"11": 50}', v_ref);
    PERFORM pg_temp.linea_libre(v_prog, 'Impresión de cantorales', 200, 350, '5-1-05', 'Cotización 2025', '{"11": 200}');
    PERFORM pg_temp.aprobar(v_pres, true);

    -- Apoyo al aprendizaje
    v_pres := pg_temp.presupuesto('Apoyo al aprendizaje', 2026);
    v_prog := pg_temp.programa(v_pres, 'Material didáctico', 'Material para el trabajo con alumnos con necesidades educativas especiales.');
    PERFORM pg_temp.linea(v_prog, 'Juego terapéutico "Para no meter la pata"', 6, '{"3": 6}', v_ref);
    PERFORM pg_temp.linea(v_prog, 'Material concreto base 10', 10, '{"3": 10}', v_ref);
    PERFORM pg_temp.linea(v_prog, 'Ábaco horizontal de madera 10 filas', 10, '{"3": 10}', v_ref);
    v_prog := pg_temp.programa(v_pres, 'Evaluaciones psicopedagógicas', 'Pruebas para evaluar a los alumnos que deriva cada profesor jefe.');
    PERFORM pg_temp.linea_libre(v_prog, 'Batería de pruebas estandarizadas (licencias)', 1, 450000, '5-1-07', 'Cotización 2025', '{"3": 1}');
    PERFORM pg_temp.linea_libre(v_prog, 'Protocolos de aplicación', 200, 1200, '5-1-05', 'Cotización 2025', '{"3": 100, "8": 100}');
    v_prog := pg_temp.programa(v_pres, 'Talleres para apoderados', 'Tres talleres en el año, con una relatora externa.');
    PERFORM pg_temp.linea_libre(v_prog, 'Relatora externa', 3, 120000, '5-2-01', 'Cotización 2025', '{"5": 1, "8": 1, "10": 1}');
    PERFORM pg_temp.aprobar(v_pres, true);
END $$;

-- Las fechas reales de la formulación 2026: se armó en octubre de 2025
-- y se aprobó en noviembre.
UPDATE presupuesto_departamento pd
   SET creado_en                = pg_temp.cl('2025-10-01 09:00') + make_interval(days => pd.departamento_id),
       enviado_en               = pg_temp.cl('2025-10-17 17:00') + make_interval(days => pd.departamento_id),
       resuelto_direccion_en    = pg_temp.cl('2025-11-03 12:00') + make_interval(days => pd.departamento_id),
       resuelto_contabilidad_en = pg_temp.cl('2025-11-17 16:00') + make_interval(days => pd.departamento_id % 10)
  FROM anio_presupuestario ap
 WHERE ap.id = pd.anio_id AND ap.anio = 2026;


-- ---------------------------------------------------------------------
-- 2026 · los pedidos del año, hasta el 8 de octubre
--
-- La mayoría sigue lo planificado: cada ítem se pidió un par de semanas
-- antes de su mes, se compró y llegó. Encima van las historias que hay
-- que ver en la app: lo que se pidió fuera del presupuesto, lo que no
-- cupo y resolvió Dirección, lo comprado que espera la confirmación del
-- jefe y lo que está por comprar en las próximas semanas.
-- ---------------------------------------------------------------------

CREATE TEMP TABLE plan_pedido (
    n            serial PRIMARY KEY,
    depto        text        NOT NULL,
    linea_id     integer,
    mes          smallint,
    pedido_en    timestamptz NOT NULL,
    necesaria    date        NOT NULL,
    item         jsonb       NOT NULL,
    observacion  text,
    anulado      date,
    comprado     date,
    pagado       integer,
    proveedor    text,
    documento    text,
    recibido     date,
    orden_id     integer
);

-- Lo planificado hasta septiembre: un pedido por ítem y mes. Lo pagado
-- se mueve unos puntos alrededor de lo presupuestado.
INSERT INTO plan_pedido (depto, linea_id, mes, pedido_en, necesaria, item, comprado, pagado, proveedor, recibido)
SELECT d.nombre, l.id, lc.mes,
       pg_temp.cl(format('2026-%s-01 09:00', lc.mes)) - make_interval(days => 10 + l.id % 8, hours => -(l.id % 5)),
       make_date(2026, lc.mes, 3 + (l.id + lc.mes) % 10),
       jsonb_build_object('linea', l.id, 'cantidad', lc.cantidad),
       make_date(2026, lc.mes, 3 + (l.id + lc.mes) % 10) - (2 + l.id % 3),
       (round(lc.cantidad::numeric * l.precio_unitario
              * CASE (l.id * 7 + lc.mes) % 9 WHEN 2 THEN 1.03 WHEN 3 THEN 0.98 WHEN 5 THEN 1.05
                                              WHEN 7 THEN 0.97 WHEN 8 THEN 1.02 ELSE 1 END
              / 10) * 10)::integer,
       CASE cc.codigo
           WHEN '5-1-03' THEN 'Editorial de ejemplo S.A.'
           WHEN '5-1-04' THEN 'Laboratorio de ejemplo SpA'
           WHEN '5-1-05' THEN 'Imprenta de ejemplo Ltda.'
           WHEN '5-1-07' THEN 'Didácticos de ejemplo SpA'
           WHEN '5-2-01' THEN 'Servicios de ejemplo Ltda.'
           WHEN '5-2-02' THEN 'Equipamiento de ejemplo S.A.'
           ELSE 'Librería de ejemplo Ltda.' END,
       make_date(2026, lc.mes, 3 + (l.id + lc.mes) % 10) - (l.id % 2)
  FROM linea_calendario lc
  JOIN linea_presupuesto        l  ON l.id  = lc.linea_id
  JOIN programa                 p  ON p.id  = l.programa_id
  JOIN presupuesto_departamento pd ON pd.id = p.presupuesto_id
  JOIN departamento             d  ON d.id  = pd.departamento_id
  JOIN anio_presupuestario      ap ON ap.id = pd.anio_id AND ap.anio = 2026
  LEFT JOIN cuenta_contable     cc ON cc.id = l.cuenta_contable_id
 WHERE lc.mes <= 9;

-- Matemática no pidió los plumones de agosto: los juntó con los de octubre (más abajo).
DELETE FROM plan_pedido pp
 USING linea_presupuesto l
 WHERE l.id = pp.linea_id AND pp.depto = 'Matemática' AND pp.mes = 8
   AND l.descripcion = 'Plumón de pizarra (caja 4)';

-- Arte pidió tarde las cartulinas de septiembre: se compraron y la jefa
-- todavía no confirma que llegaron.
UPDATE plan_pedido pp
   SET pedido_en = pg_temp.cl('2026-09-21 11:00'), necesaria = '2026-10-02',
       comprado = '2026-10-01', recibido = NULL
  FROM linea_presupuesto l
 WHERE l.id = pp.linea_id AND pp.depto = 'Arte' AND pp.mes = 9
   AND l.descripcion = 'Cartulina de color (pliego)';

-- Los premios del concurso de cuento se compraron y nadie confirmó la recepción.
UPDATE plan_pedido pp
   SET recibido = NULL
  FROM linea_presupuesto l
 WHERE l.id = pp.linea_id AND pp.depto = 'Lenguaje' AND l.descripcion = 'Premios del concurso';

INSERT INTO plan_pedido (depto, pedido_en, necesaria, item, observacion, anulado, comprado, pagado, proveedor, recibido) VALUES
    -- Algo que no estaba en el presupuesto: cupo, se compró y llegó.
    ('Arte', pg_temp.cl('2026-05-11 10:30'), '2026-05-25',
     '{"descripcion": "Arcilla para modelar 1 kg", "cantidad": 20, "precio": 2490, "cuenta": "5-1-06"}',
     'Para la unidad de escultura de 7° básico.', NULL, '2026-05-20', 49800, 'Librería de ejemplo Ltda.', '2026-05-25'),
    -- Pedido dos veces por error: la jefa lo anuló antes de que se comprara.
    ('Apoyo al aprendizaje', pg_temp.cl('2026-06-01 09:15'), '2026-06-15',
     '{"linea": "Juego terapéutico \"Para no meter la pata\"", "cantidad": 2}',
     'Para el grupo nuevo de 3° básico.', '2026-06-03', NULL, NULL, NULL, NULL),
    -- No cupieron: los resuelve Dirección más abajo.
    ('Biblioteca', pg_temp.cl('2026-08-05 10:00'), '2026-08-24',
     '{"articulo": "Libro de lectura complementaria", "cantidad": 30}',
     'Títulos nuevos que pidió Lenguaje.', NULL, NULL, NULL, NULL, NULL),
    ('Historia', pg_temp.cl('2026-09-01 10:00'), '2026-09-14',
     '{"articulo": "Mapa mural de Chile", "cantidad": 6}',
     'Los mapas de las salas de 7° y 8° están rotos.', NULL, NULL, NULL, NULL, NULL),
    -- Por comprar en las próximas semanas.
    ('Reproducción de imagen', pg_temp.cl('2026-09-28 10:00'), '2026-10-09',
     '{"linea": "Tóner fotocopiadora (genérico)", "cantidad": 8}',
     'Para las pruebas de fin de semestre.', NULL, NULL, NULL, NULL, NULL),
    ('Reproducción de imagen', pg_temp.cl('2026-09-28 10:05'), '2026-10-09',
     '{"linea": "Papel fotocopia carta (caja 10 resmas)", "cantidad": 10}',
     NULL, NULL, NULL, NULL, NULL, NULL),
    ('Matemática', pg_temp.cl('2026-09-30 09:00'), '2026-10-13',
     '{"linea": "Plumón de pizarra (caja 4)", "cantidad": 20}',
     'Junté los de agosto con los de octubre.', NULL, NULL, NULL, NULL, NULL),
    ('Arte', pg_temp.cl('2026-10-01 12:00'), '2026-10-20',
     '{"linea": "Témpera frasco 250 ml", "cantidad": 30}',
     NULL, NULL, NULL, NULL, NULL, NULL),
    ('Formación', pg_temp.cl('2026-10-01 15:00'), '2026-10-22',
     '{"linea": "Arriendo de casa de retiro (por jornada)", "cantidad": 1}',
     'Jornada de los segundos medios.', NULL, NULL, NULL, NULL, NULL),
    ('Formación', pg_temp.cl('2026-10-01 15:05'), '2026-10-22',
     '{"linea": "Colaciones para la jornada", "cantidad": 1}',
     NULL, NULL, NULL, NULL, NULL, NULL),
    ('Física', pg_temp.cl('2026-10-02 11:00'), '2026-10-27',
     '{"linea": "Paneles para stands (arriendo)", "cantidad": 10}',
     'Feria científica del 29 de octubre.', NULL, NULL, NULL, NULL, NULL),
    ('Física', pg_temp.cl('2026-10-02 11:05'), '2026-10-27',
     '{"linea": "Cartulina de color (pliego)", "cantidad": 80}',
     NULL, NULL, NULL, NULL, NULL, NULL),
    -- No cabe: espera a Dirección.
    ('Ciencia', pg_temp.cl('2026-10-02 16:00'), '2026-10-23',
     '{"articulo": "Agitador magnético", "cantidad": 2}',
     'Para las prácticas de química de 2° medio.', NULL, NULL, NULL, NULL, NULL),
    ('Alemán', pg_temp.cl('2026-10-05 10:00'), '2026-10-26',
     '{"linea": "Insumos para la feria", "cantidad": 1}',
     'Semana alemana, del 26 al 30 de octubre.', NULL, NULL, NULL, NULL, NULL),
    ('Alemán', pg_temp.cl('2026-10-05 10:05'), '2026-10-26',
     '{"linea": "Cartulina de color (pliego)", "cantidad": 40}',
     NULL, NULL, NULL, NULL, NULL, NULL),
    ('Apoyo al aprendizaje', pg_temp.cl('2026-10-05 12:00'), '2026-10-21',
     '{"linea": "Relatora externa", "cantidad": 1}',
     'Tercer taller para apoderados.', NULL, NULL, NULL, NULL, NULL),
    ('Pastoral', pg_temp.cl('2026-10-06 09:30'), '2026-11-20',
     '{"linea": "Impresión de cantorales", "cantidad": 200}',
     'Para la misa de fin de año.', NULL, NULL, NULL, NULL, NULL),
    ('Inglés', pg_temp.cl('2026-10-07 10:00'), '2026-11-03',
     '{"linea": "Inscripción torneo de debate", "cantidad": 1}',
     'Torneo del 6 de noviembre.', NULL, NULL, NULL, NULL, NULL);

-- Facturas y boletas numeradas en el orden en que se compró.
UPDATE plan_pedido pp
   SET documento = CASE WHEN pp.pagado < 30000 THEN 'B-' || (4100 + x.k) ELSE 'F-' || (20100 + x.k) END
  FROM (SELECT n, row_number() OVER (ORDER BY comprado, n) AS k FROM plan_pedido WHERE comprado IS NOT NULL) x
 WHERE x.n = pp.n;

-- Todo en orden cronológico: así los folios quedan correlativos y cada
-- pedido ve el disponible que había ese día.
DO $$
DECLARE
    r        record;
    v_orden  integer;
BEGIN
    FOR r IN SELECT * FROM plan_pedido ORDER BY pedido_en, n LOOP
        v_orden := pg_temp.pedido(r.depto, r.pedido_en, r.necesaria, r.item, r.observacion);
        UPDATE plan_pedido SET orden_id = v_orden WHERE n = r.n;

        IF r.anulado IS NOT NULL THEN
            UPDATE orden_compra SET estado = 'anulada' WHERE id = v_orden;
        END IF;
        IF r.comprado IS NOT NULL THEN
            PERFORM pg_temp.comprar(v_orden, r.comprado, r.pagado, r.proveedor, r.documento);
        END IF;
        IF r.recibido IS NOT NULL THEN
            PERFORM pg_temp.recibir(v_orden, r.recibido);
        END IF;
    END LOOP;
END $$;

-- Dirección resuelve lo que no cupo.
DO $$
DECLARE
    v_orden  integer;
BEGIN
    PERFORM set_config('app.usuario_id', '2', true);   -- Andrés Bulnes, Dirección

    -- Biblioteca: denegado.
    SELECT orden_id INTO v_orden FROM plan_pedido WHERE depto = 'Biblioteca' AND item ? 'articulo';
    PERFORM fn_resolver_pendiente((SELECT id FROM pendiente_pedido WHERE orden_id = v_orden), false,
        'Esta compra entra en el presupuesto 2027 de Biblioteca. Inclúyela en el plan lector de marzo.');
    UPDATE pendiente_pedido SET resuelto_en = pg_temp.cl('2026-08-07 12:30') WHERE orden_id = v_orden;

    -- Historia: Dirección extiende el presupuesto; los mapas se compran y llegan.
    SELECT orden_id INTO v_orden FROM plan_pedido WHERE depto = 'Historia' AND item ? 'articulo';
    PERFORM fn_resolver_pendiente((SELECT id FROM pendiente_pedido WHERE orden_id = v_orden), true,
        'Aprobado: los mapas de las salas están deteriorados.');
    UPDATE pendiente_pedido SET resuelto_en = pg_temp.cl('2026-09-03 11:00') WHERE orden_id = v_orden;
    PERFORM pg_temp.comprar(v_orden, '2026-09-08', 152000, 'Librería de ejemplo Ltda.', 'F-20999');
    PERFORM pg_temp.recibir(v_orden, '2026-09-14');
END $$;

-- Las fechas reales de cada paso: la base les puso la hora de la carga.
UPDATE pendiente_pedido p SET creado_en = o.creado_en FROM orden_compra o WHERE o.id = p.orden_id;
UPDATE modificacion_presupuestaria m SET creado_en = p.resuelto_en FROM pendiente_pedido p WHERE p.id = m.pendiente_id;
UPDATE orden_compra o
   SET fecha_emision = COALESCE(
           (SELECT p.resuelto_en FROM pendiente_pedido p WHERE p.orden_id = o.id AND p.estado = 'aprobado'),
           o.creado_en)
 WHERE o.fecha_emision IS NOT NULL;

-- De los avisos de 2026 quedan los que todavía piden hacer algo (comprar,
-- confirmar una recepción, resolver una solicitud) y las respuestas de
-- Dirección, con la fecha del hecho que los generó. Los de la
-- formulación 2026 y los de lo que ya pasó no le sirven a nadie.
DELETE FROM notificacion n
 WHERE NOT EXISTS (
     SELECT 1 FROM orden_compra o
      WHERE (n.titulo || ' ' || COALESCE(n.mensaje, '')) ~ (o.folio || '([^0-9]|$)')
        AND (   (n.titulo LIKE '%listo para comprar'   AND o.estado = 'emitida')
             OR (n.titulo LIKE 'Se compró tu pedido%'  AND o.estado = 'comprada')
             OR (n.titulo LIKE '%pide extender%'       AND o.estado = 'pendiente_direccion')
             OR  n.titulo LIKE 'Dirección aprobó tu pedido%'
             OR  n.titulo LIKE 'Dirección denegó tu pedido%'));

UPDATE notificacion n
   SET creada_en = CASE
           WHEN n.titulo LIKE 'Se compró%' THEN (SELECT max(c.creado_en) FROM compra c WHERE c.orden_id = o.id)
           WHEN n.titulo LIKE 'Dirección%' THEN (SELECT p.resuelto_en FROM pendiente_pedido p WHERE p.orden_id = o.id)
           ELSE o.fecha_emision END
  FROM orden_compra o
 WHERE (n.titulo || ' ' || COALESCE(n.mensaje, '')) ~ (o.folio || '([^0-9]|$)');

DROP TABLE plan_pedido;


-- ---------------------------------------------------------------------
-- 2027 · en formulación
--
--   Arte                     en preparación, con todos sus meses (el
--                            ejemplo de las presentaciones: $497.380)
--   Inglés                   en preparación, con un ítem sin meses
--   Matemática               en revisión de Dirección
--   Ciencia                  devuelto por Dirección
--   Historia                 con reparos de contabilidad
--   Reproducción de imagen   en revisión de contabilidad
--   Biblioteca y Alemán      aprobados
--   Formación                recién empezando, con un programa vacío
-- ---------------------------------------------------------------------

DO $$
DECLARE
    v_pres   integer;
    v_prog   integer;
BEGIN
    -- Arte: en preparación. Es el ejemplo de las presentaciones: abril
    -- $59.700, junio $29.850, septiembre $217.880, octubre $9.950 y
    -- noviembre $180.000.
    v_pres := pg_temp.presupuesto('Arte', 2027);
    v_prog := pg_temp.programa(v_pres, 'Muestra de arte de fin de año', 'Trabajos de los alumnos, en noviembre.');
    PERFORM pg_temp.linea(v_prog, 'Témpera frasco 250 ml', 50, '{"4": 30, "6": 15, "10": 5}');
    PERFORM pg_temp.linea_libre(v_prog, 'Montaje de la muestra', 1, 180000, '5-2-01', 'Estimación de la jefa', '{"11": 1}');
    v_prog := pg_temp.programa(v_pres, 'Día del arte', 'Jornada abierta a las familias, en septiembre.');
    PERFORM pg_temp.linea(v_prog, 'Témpera frasco 500 ml', 12, '{"9": 12}');
    PERFORM pg_temp.linea_libre(v_prog, 'Arriendo de toldos', 2, 85000, '5-2-01', 'Cotización de 2026', '{"9": 2}');

    -- Inglés: en preparación; a los cuadernos todavía les faltan los meses.
    v_pres := pg_temp.presupuesto('Inglés', 2027);
    v_prog := pg_temp.programa(v_pres, 'Material para las clases', 'Diccionarios y cuadernos para 7° y 8° básico.');
    PERFORM pg_temp.linea(v_prog, 'Diccionario inglés-español escolar', 15, '{"3": 15}');
    PERFORM pg_temp.linea(v_prog, 'Cuaderno universitario 100 hojas 7 mm', 40);
    v_prog := pg_temp.programa(v_pres, 'Debate interescolar', 'Torneo de debate en inglés, en noviembre.');
    PERFORM pg_temp.linea_libre(v_prog, 'Inscripción torneo de debate', 1, 60000, '5-2-01', 'Valor de 2026', '{"11": 1}');

    -- Matemática: enviado, esperando a Dirección.
    v_pres := pg_temp.presupuesto('Matemática', 2027);
    v_prog := pg_temp.programa(v_pres, 'Material concreto 1° ciclo', 'Material manipulable para 1° a 4° básico.');
    PERFORM pg_temp.linea(v_prog, 'Material concreto base 10', 8, '{"3": 8}');
    PERFORM pg_temp.linea(v_prog, 'Ábaco horizontal de madera 10 filas', 10, '{"3": 10}');
    v_prog := pg_temp.programa(v_pres, 'Olimpiada de matemática', 'Preparación y participación en la olimpiada regional y nacional.');
    PERFORM pg_temp.linea(v_prog, 'Calculadora científica', 10, '{"8": 10}');
    PERFORM pg_temp.linea(v_prog, 'Resma papel carta 75 g', 10, '{"5": 5, "8": 5}');
    PERFORM pg_temp.linea(v_prog, 'Plumón de pizarra (caja 4)', 12, '{"3": 6, "8": 6}');
    PERFORM pg_temp.linea_libre(v_prog, 'Inscripción Olimpiada Nacional de Matemática', 1, 120000,
        '5-2-01', 'Valor de la inscripción 2026', '{"5": 1}');
    UPDATE presupuesto_departamento SET estado = 'enviado' WHERE id = v_pres;

    -- Ciencia: enviado y devuelto por Dirección.
    v_pres := pg_temp.presupuesto('Ciencia', 2027);
    v_prog := pg_temp.programa(v_pres, 'Laboratorio 1° y 2° medio', 'Reactivos e insumos para las prácticas del año.');
    PERFORM pg_temp.linea(v_prog, 'Acetona anhidra pura', 6, '{"3": 3, "8": 3}');
    PERFORM pg_temp.linea(v_prog, 'Ácido clorhídrico', 6, '{"3": 3, "8": 3}');
    PERFORM pg_temp.linea(v_prog, 'Guantes de nitrilo (caja 100)', 10, '{"3": 5, "8": 5}');
    PERFORM pg_temp.linea(v_prog, 'Agitador magnético', 2, '{"4": 2}');
    PERFORM pg_temp.linea(v_prog, 'Agar nutritivo', 4, '{"5": 4}');
    PERFORM pg_temp.linea(v_prog, 'Tubos de ensayo (caja 12)', 20, '{"3": 20}');
    UPDATE presupuesto_departamento SET estado = 'enviado' WHERE id = v_pres;
    PERFORM set_config('app.usuario_id', '2', true);
    UPDATE presupuesto_departamento
       SET estado = 'devuelto',
           comentario_direccion = 'Como lo conversamos: dejen un solo agitador magnético y revisen la cantidad de guantes.'
     WHERE id = v_pres;

    -- Historia: Dirección lo aprobó y contabilidad envió reparos.
    v_pres := pg_temp.presupuesto('Historia', 2027);
    v_prog := pg_temp.programa(v_pres, 'Material para las clases', 'Mapas para las salas de 7° y 8° básico.');
    PERFORM pg_temp.linea(v_prog, 'Mapa mural de Chile', 6, '{"3": 6}');
    v_prog := pg_temp.programa(v_pres, 'Salida pedagógica', 'Visita al Museo Histórico Nacional con los segundos medios.');
    PERFORM pg_temp.linea_libre(v_prog, 'Arriendo de buses', 2, 550000, '5-2-01', 'Estimación del jefe', '{"6": 2}');
    PERFORM pg_temp.aprobar(v_pres, false);
    PERFORM set_config('app.usuario_id', '1', true);
    UPDATE presupuesto_departamento
       SET estado = 'con_reparos',
           comentario_contabilidad = 'El arriendo de buses está sobre la cotización vigente del proveedor: $950.000 por los dos. Ajústalo a ese monto.'
     WHERE id = v_pres;

    -- Reproducción de imagen: aprobado por Dirección, en revisión de contabilidad.
    v_pres := pg_temp.presupuesto('Reproducción de imagen', 2027);
    v_prog := pg_temp.programa(v_pres, 'Operación de fotocopiado', 'Papel y tóner para las guías y evaluaciones de todo el colegio.');
    PERFORM pg_temp.linea(v_prog, 'Papel fotocopia carta (caja 10 resmas)', 40, '{"3": 12, "6": 12, "9": 16}');
    PERFORM pg_temp.linea(v_prog, 'Tóner fotocopiadora (genérico)', 12, '{"3": 4, "6": 4, "9": 4}');
    PERFORM pg_temp.linea(v_prog, 'Tóner Brother TN-1060', 4, '{"3": 1, "6": 1, "9": 2}');
    v_prog := pg_temp.programa(v_pres, 'Mantención de equipos', 'Mantención de las fotocopiadoras cada trimestre.');
    PERFORM pg_temp.linea_libre(v_prog, 'Mantención de fotocopiadoras', 4, 125000, '5-2-01', 'Contrato 2026 reajustado',
        '{"3": 1, "6": 1, "9": 1, "12": 1}');
    PERFORM pg_temp.aprobar(v_pres, false);

    -- Biblioteca: aprobado por Dirección y por contabilidad.
    v_pres := pg_temp.presupuesto('Biblioteca', 2027);
    v_prog := pg_temp.programa(v_pres, 'Plan lector 2027', 'Títulos del plan lector y diccionarios para la sala de estudio.');
    PERFORM pg_temp.linea(v_prog, 'Libro de lectura complementaria', 60, '{"3": 40, "8": 20}');
    PERFORM pg_temp.linea(v_prog, 'Diccionario inglés-español escolar', 10, '{"3": 10}');
    PERFORM pg_temp.linea(v_prog, 'Diccionario alemán-español escolar', 6, '{"3": 6}');
    v_prog := pg_temp.programa(v_pres, 'Club de lectura', 'Encuentro con un autor invitado.');
    PERFORM pg_temp.linea_libre(v_prog, 'Visita de autor invitado', 1, 180000, '5-2-01', 'Cotización del autor', '{"6": 1}');
    PERFORM pg_temp.aprobar(v_pres, true);

    -- Alemán: aprobado por Dirección y por contabilidad.
    v_pres := pg_temp.presupuesto('Alemán', 2027);
    v_prog := pg_temp.programa(v_pres, 'Material para las clases', 'Diccionarios y cuadernos para 7° básico.');
    PERFORM pg_temp.linea(v_prog, 'Diccionario alemán-español escolar', 12, '{"3": 12}');
    PERFORM pg_temp.linea(v_prog, 'Cuaderno college 80 hojas', 30, '{"3": 30}');
    v_prog := pg_temp.programa(v_pres, 'Semana alemana', 'Feria con comida y música en octubre.');
    PERFORM pg_temp.linea(v_prog, 'Cartulina de color (pliego)', 40, '{"10": 40}');
    PERFORM pg_temp.linea_libre(v_prog, 'Insumos para la feria', 1, 150000, '5-2-01', 'Estimación de la jefa', '{"10": 1}');
    PERFORM pg_temp.aprobar(v_pres, true);

    -- Formación: recién empezando, con un programa sin ítems.
    v_pres := pg_temp.presupuesto('Formación', 2027);
    PERFORM pg_temp.programa(v_pres, 'Jornadas de convivencia', 'Una jornada por curso, de abril a octubre.');
END $$;

COMMIT;
