-- =====================================================================
--  GESEMCO · Datos de prueba
--
--  El Colegio Santa Úrsula en septiembre de 2026: ejecutando el
--  presupuesto 2026 y formulando el 2027.
--
--  Los precios de tiendas reales son los que esas tiendas publicaban el
--  24-09-2026. Los de la tienda "Precio de ejemplo" son ilustrativos.
--  Las personas, los correos (dominio .test), los montos, las compras y
--  las facturas son inventados. Nada de esto va a producción.
--
--  Requiere haber corrido db/esquema_gesemco.sql sobre una base vacía.
--  Todo pasa por los triggers reales: si una regla se rompe, este
--  archivo falla.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Colegio, años, departamentos y personas
-- ---------------------------------------------------------------------

INSERT INTO colegio (nombre, rbd, comuna)
VALUES ('Colegio Santa Úrsula', '00000-0', NULL);   -- RBD y comuna: completar con los reales

INSERT INTO anio_presupuestario (colegio_id, anio, etapa, fecha_apertura) VALUES
    (1, 2026, 'ejecucion',   '2025-10-01'),   -- 1
    (1, 2027, 'formulacion', '2026-09-01');   -- 2

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
    (1, 'Gabriela Morales',  'gabriela.morales@santaursula.test'),   -- 16 jefa Apoyo al aprendizaje
    (1, 'Ignacio Vera',      'ignacio.vera@santaursula.test'),       -- 17 profesor
    (1, 'Francisca Leiva',   'francisca.leiva@santaursula.test'),    -- 18 profesora
    (1, 'Martín Salinas',    'martin.salinas@santaursula.test'),     -- 19 profesor
    (1, 'Josefa Riquelme',   'josefa.riquelme@santaursula.test');    -- 20 profesora

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
    (16, 'jefe_departamento', 13),
    -- Un profesor puede estar en varios departamentos, y un jefe
    -- también puede hacer clases en otro.
    (17, 'profesor',  2), (17, 'profesor',  3),
    (18, 'profesor', 11),
    (19, 'profesor',  4),
    (20, 'profesor', 10), (20, 'profesor',  1),
    ( 5, 'profesor',  3);


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
-- Ayudas para cargar presupuestos y órdenes como lo haría la app
-- ---------------------------------------------------------------------

CREATE FUNCTION pg_temp.presupuesto(p_depto text, p_anio integer) RETURNS integer AS $$
    INSERT INTO presupuesto_departamento (departamento_id, anio_id)
    SELECT d.id, ap.id
      FROM departamento d, anio_presupuestario ap
     WHERE d.nombre = p_depto AND ap.anio = p_anio
    RETURNING id;
$$ LANGUAGE sql;

CREATE FUNCTION pg_temp.programa(p_presupuesto integer, p_nombre text, p_descripcion text) RETURNS integer AS $$
    INSERT INTO programa (presupuesto_id, nombre, descripcion, creado_por)
    VALUES (p_presupuesto, p_nombre, p_descripcion, fn_usuario_actual())
    RETURNING id;
$$ LANGUAGE sql;

-- Línea desde el catálogo, al precio de referencia (mediana de ofertas).
CREATE FUNCTION pg_temp.linea(p_programa integer, p_articulo text, p_cantidad integer) RETURNS integer AS $$
DECLARE
    v_id integer;
BEGIN
    INSERT INTO linea_presupuesto (programa_id, articulo_id, descripcion, cantidad,
                                   precio_unitario, cuenta_contable_id, origen_precio)
    SELECT p_programa, c.articulo_id, c.nombre, p_cantidad, c.precio_referencia, c.cuenta_contable_id,
           CASE WHEN c.ofertas = 1
                THEN (SELECT pv.tienda FROM vw_precio_vigente pv WHERE pv.articulo_id = c.articulo_id)
                ELSE 'Precio del medio entre ' || c.ofertas || ' ofertas' END
           || ' al ' || to_char(c.actualizado_en AT TIME ZONE 'America/Santiago', 'DD-MM-YYYY')
      FROM vw_catalogo_articulo c
     WHERE lower(c.nombre) = lower(p_articulo)
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
        RAISE EXCEPTION 'No encontré el artículo "%" en el catálogo', p_articulo;
    END IF;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Línea libre, fuera de catálogo.
CREATE FUNCTION pg_temp.linea_libre(
    p_programa integer, p_descripcion text, p_cantidad integer, p_precio integer,
    p_cuenta text, p_origen text
) RETURNS integer AS $$
    INSERT INTO linea_presupuesto (programa_id, descripcion, cantidad, precio_unitario,
                                   cuenta_contable_id, origen_precio)
    SELECT p_programa, p_descripcion, p_cantidad, p_precio, cc.id, p_origen
      FROM cuenta_contable cc WHERE cc.codigo = p_cuenta
    RETURNING id;
$$ LANGUAGE sql;

-- Reparte una línea en meses: '{"3": 4, "4": 4}'.
CREATE FUNCTION pg_temp.meses(p_linea integer, p_reparto jsonb) RETURNS void AS $$
    INSERT INTO linea_calendario (linea_id, mes, cantidad)
    SELECT p_linea, key::smallint, value::integer
      FROM jsonb_each_text(p_reparto);
$$ LANGUAGE sql;

-- Orden de compra: se crea en borrador, se cargan los ítems y se emite.
-- Devuelve el id; el estado final lo decide la base.
CREATE FUNCTION pg_temp.orden(p_depto text, p_anio integer, p_items jsonb, p_observacion text)
RETURNS integer AS $$
DECLARE
    v_presupuesto  integer;
    v_emisor       integer;
    v_orden        integer;
    v_item         jsonb;
BEGIN
    SELECT pd.id, r.usuario_id INTO v_presupuesto, v_emisor
      FROM presupuesto_departamento pd
      JOIN departamento d         ON d.id = pd.departamento_id
      JOIN anio_presupuestario ap ON ap.id = pd.anio_id
      JOIN rol_asignado r         ON r.departamento_id = d.id AND r.rol = 'jefe_departamento'
     WHERE d.nombre = p_depto AND ap.anio = p_anio;

    PERFORM set_config('app.usuario_id', v_emisor::text, true);

    INSERT INTO orden_compra (folio, presupuesto_id, emitida_por, observacion)
    VALUES (fn_folio('OC', v_presupuesto), v_presupuesto, v_emisor, p_observacion)
    RETURNING id INTO v_orden;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        IF v_item ? 'articulo' THEN
            INSERT INTO item_orden (orden_id, articulo_id, descripcion, cantidad,
                                    precio_presupuesto, cuenta_contable_id)
            SELECT v_orden, c.articulo_id, c.nombre, (v_item ->> 'cantidad')::integer,
                   c.precio_referencia, c.cuenta_contable_id
              FROM vw_catalogo_articulo c
             WHERE lower(c.nombre) = lower(v_item ->> 'articulo');
            IF NOT FOUND THEN
                RAISE EXCEPTION 'No encontré el artículo "%"', v_item ->> 'articulo';
            END IF;
        ELSE
            INSERT INTO item_orden (orden_id, descripcion, cantidad, precio_presupuesto)
            VALUES (v_orden, v_item ->> 'descripcion', (v_item ->> 'cantidad')::integer,
                    (v_item ->> 'precio')::integer);
        END IF;
    END LOOP;

    UPDATE orden_compra SET estado = 'emitida' WHERE id = v_orden;
    RETURN v_orden;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION pg_temp.comprar(p_orden integer, p_monto integer, p_documento text, p_fecha date)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.usuario_id', '3', true);   -- Tomás Ríos, equipo de compra
    INSERT INTO compra (orden_id, proveedor, tipo_documento, numero_documento,
                        fecha_compra, monto_total, registrada_por)
    VALUES (p_orden, 'Proveedor de ejemplo S.A.', 'factura', p_documento, p_fecha, p_monto, 3);
    UPDATE orden_compra SET estado = 'comprada' WHERE id = p_orden;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------
-- 2026 · en ejecución
--
-- El 2026 no se formuló en el sistema: cada departamento carga su monto
-- aprobado como una sola línea y Dirección lo aprueba. Desde ahí se
-- ejecuta contra el total del departamento, que es como se controla.
-- ---------------------------------------------------------------------

DO $$
DECLARE
    r              record;
    v_presupuesto  integer;
    v_programa     integer;
BEGIN
    FOR r IN
        SELECT * FROM (VALUES
            ('Formación',               1800000), ('Matemática',   2400000),
            ('Física',                  1900000), ('Historia',     1200000),
            ('Inglés',                  1500000), ('Lenguaje',     1600000),
            ('Biblioteca',              2800000), ('Reproducción de imagen', 6500000),
            ('Alemán',                  1700000), ('Arte',         2200000),
            ('Ciencia',                 3100000), ('Pastoral',      900000),
            ('Apoyo al aprendizaje',    2000000)
        ) AS x(departamento, monto)
    LOOP
        PERFORM set_config('app.usuario_id', '1', true);   -- contabilidad carga
        v_presupuesto := pg_temp.presupuesto(r.departamento, 2026);
        v_programa := pg_temp.programa(v_presupuesto, 'Presupuesto 2026 (carga inicial)',
            'Monto aprobado en la planilla 2026, cargado de una vez para ejecutar contra él.');
        PERFORM pg_temp.linea_libre(v_programa, 'Monto aprobado 2026', 1, r.monto, '5-1-01', 'Planilla 2026');

        UPDATE presupuesto_departamento SET estado = 'enviado' WHERE id = v_presupuesto;
        PERFORM set_config('app.usuario_id', '2', true);   -- Dirección aprueba
        UPDATE presupuesto_departamento SET estado = 'aprobado' WHERE id = v_presupuesto;
    END LOOP;
END $$;

-- Los avisos de la carga inicial no le sirven a nadie.
DELETE FROM notificacion;


DO $$
DECLARE
    v_orden integer;
BEGIN
    -- Reproducción de imagen: una orden recibida y otra esperando la compra.
    v_orden := pg_temp.orden('Reproducción de imagen', 2026,
        '[{"articulo": "Papel fotocopia carta (caja 10 resmas)", "cantidad": 60}]',
        'Papel del primer semestre.');
    PERFORM pg_temp.comprar(v_orden, 2690000, 'F-10233', '2026-03-09');
    PERFORM set_config('app.usuario_id', '11', true);
    INSERT INTO recepcion (orden_id, recibido_por, fecha_recepcion) VALUES (v_orden, 11, '2026-03-12');
    UPDATE orden_compra SET estado = 'recibida' WHERE id = v_orden;

    PERFORM pg_temp.orden('Reproducción de imagen', 2026,
        '[{"articulo": "Tóner fotocopiadora (genérico)", "cantidad": 20}]',
        'Tóner para el segundo semestre.');

    -- Matemática: calculadoras compradas, plumones por comprar.
    v_orden := pg_temp.orden('Matemática', 2026,
        '[{"articulo": "Calculadora científica", "cantidad": 30}]',
        'Reemplazo de calculadoras de 1° y 2° medio.');
    PERFORM pg_temp.comprar(v_orden, 719700, 'F-10310', '2026-04-02');

    PERFORM pg_temp.orden('Matemática', 2026,
        '[{"articulo": "Plumón de pizarra (caja 4)", "cantidad": 20}]', NULL);

    -- Arte: material de la muestra, comprado y recibido.
    v_orden := pg_temp.orden('Arte', 2026,
        '[{"articulo": "Témpera frasco 250 ml", "cantidad": 80},
          {"articulo": "Block de dibujo medium 99 1/8", "cantidad": 100}]',
        'Material para la muestra de invierno.');
    PERFORM pg_temp.comprar(v_orden, 351000, 'F-10402', '2026-05-18');
    PERFORM set_config('app.usuario_id', '13', true);
    INSERT INTO recepcion (orden_id, recibido_por, fecha_recepcion) VALUES (v_orden, 13, '2026-05-22');
    UPDATE orden_compra SET estado = 'recibida' WHERE id = v_orden;

    -- Ciencia: el equipamiento se llevó casi todo; el agitador no cabe
    -- y queda pendiente de Dirección.
    v_orden := pg_temp.orden('Ciencia', 2026,
        '[{"descripcion": "Microscopios escolares (lote de 10)", "cantidad": 1, "precio": 2900000}]',
        'Renovación de microscopios del laboratorio.');
    PERFORM pg_temp.comprar(v_orden, 2950000, 'F-10377', '2026-04-20');

    PERFORM pg_temp.orden('Ciencia', 2026,
        '[{"articulo": "Agitador magnético", "cantidad": 2}]',
        'Para las prácticas de química de 2° medio.');

    -- Biblioteca: el plan lector se compró; los libros extra no caben y
    -- Dirección los deniega.
    v_orden := pg_temp.orden('Biblioteca', 2026,
        '[{"descripcion": "Libros del plan lector 2026 (lote)", "cantidad": 1, "precio": 2600000}]',
        NULL);
    PERFORM pg_temp.comprar(v_orden, 2580000, 'F-10198', '2026-03-02');

    v_orden := pg_temp.orden('Biblioteca', 2026,
        '[{"articulo": "Libro de lectura complementaria", "cantidad": 30}]',
        'Títulos nuevos pedidos por Lenguaje.');
    PERFORM set_config('app.usuario_id', '2', true);
    PERFORM fn_resolver_pendiente(
        (SELECT id FROM pendiente_pedido WHERE orden_id = v_orden), false,
        'Esta compra entra en el presupuesto 2027 de Biblioteca. Inclúyela en el plan lector de marzo.');

    -- Historia: la salida pedagógica se llevó casi todo; los mapas no
    -- caben y Dirección aprueba el aumento.
    v_orden := pg_temp.orden('Historia', 2026,
        '[{"descripcion": "Salida pedagógica al Museo Histórico Nacional (buses)", "cantidad": 1, "precio": 1100000}]',
        NULL);
    PERFORM pg_temp.comprar(v_orden, 1100000, 'F-10255', '2026-06-05');

    v_orden := pg_temp.orden('Historia', 2026,
        '[{"articulo": "Mapa mural de Chile", "cantidad": 6}]',
        'Los mapas de las salas de 7° y 8° están rotos.');
    PERFORM set_config('app.usuario_id', '2', true);
    PERFORM fn_resolver_pendiente(
        (SELECT id FROM pendiente_pedido WHERE orden_id = v_orden), true,
        'Aprobado: los mapas actuales están deteriorados.');
END $$;

-- Fechas de emisión realistas: la base les puso la hora de la carga.
UPDATE orden_compra o
   SET fecha_emision = f.emision
  FROM (VALUES
      ('OC-2026-0001', TIMESTAMPTZ '2026-03-03 10:00-03'),   -- papel, Reproducción
      ('OC-2026-0002', TIMESTAMPTZ '2026-08-24 10:00-04'),   -- tóner, Reproducción
      ('OC-2026-0003', TIMESTAMPTZ '2026-03-25 10:00-03'),   -- calculadoras, Matemática
      ('OC-2026-0004', TIMESTAMPTZ '2026-09-15 10:00-03'),   -- plumones, Matemática
      ('OC-2026-0005', TIMESTAMPTZ '2026-05-11 10:00-04'),   -- muestra, Arte
      ('OC-2026-0006', TIMESTAMPTZ '2026-04-06 10:00-04'),   -- microscopios, Ciencia
      ('OC-2026-0007', TIMESTAMPTZ '2026-09-10 10:00-03'),   -- agitador, Ciencia (pendiente)
      ('OC-2026-0008', TIMESTAMPTZ '2026-02-23 10:00-03'),   -- plan lector, Biblioteca
      ('OC-2026-0009', TIMESTAMPTZ '2026-08-05 10:00-04'),   -- libros, Biblioteca (denegada)
      ('OC-2026-0010', TIMESTAMPTZ '2026-05-28 10:00-04'),   -- salida, Historia
      ('OC-2026-0011', TIMESTAMPTZ '2026-09-01 10:00-03')    -- mapas, Historia (aprobada por Dirección)
  ) AS f(folio, emision)
 WHERE o.folio = f.folio;

UPDATE pendiente_pedido p
   SET creado_en = o.fecha_emision
  FROM orden_compra o
 WHERE o.id = p.orden_id;


-- ---------------------------------------------------------------------
-- 2027 · en formulación
-- ---------------------------------------------------------------------

DO $$
DECLARE
    v_pres   integer;
    v_prog   integer;
    v_linea  integer;
BEGIN
    -- Matemática: enviado, esperando a Dirección.
    PERFORM set_config('app.usuario_id', '5', true);
    v_pres := pg_temp.presupuesto('Matemática', 2027);
    v_prog := pg_temp.programa(v_pres, 'Olimpiada de matemática',
        'Preparación y participación en la olimpiada regional y nacional.');
    PERFORM pg_temp.linea(v_prog, 'Calculadora científica', 10);
    PERFORM pg_temp.linea(v_prog, 'Resma papel carta 75 g', 10);
    PERFORM pg_temp.linea(v_prog, 'Plumón de pizarra (caja 4)', 12);
    PERFORM pg_temp.linea_libre(v_prog, 'Inscripción Olimpiada Nacional de Matemática', 1, 120000,
        '5-2-01', 'Valor de la inscripción 2026');
    v_prog := pg_temp.programa(v_pres, 'Material concreto 1° ciclo',
        'Material manipulable para 1° a 4° básico.');
    PERFORM pg_temp.linea(v_prog, 'Material concreto base 10', 8);
    PERFORM pg_temp.linea(v_prog, 'Ábaco horizontal de madera 10 filas', 10);
    UPDATE presupuesto_departamento SET estado = 'enviado' WHERE id = v_pres;

    -- Arte: todavía en borrador.
    PERFORM set_config('app.usuario_id', '13', true);
    v_pres := pg_temp.presupuesto('Arte', 2027);
    v_prog := pg_temp.programa(v_pres, 'Muestra de arte de fin de año',
        'Exposición de trabajos de 5° básico a IV medio en noviembre.');
    PERFORM pg_temp.linea(v_prog, 'Témpera frasco 250 ml', 60);
    PERFORM pg_temp.linea(v_prog, 'Témpera estuche 12 colores', 40);
    PERFORM pg_temp.linea(v_prog, 'Block de dibujo medium 99 1/8', 80);
    PERFORM pg_temp.linea(v_prog, 'Set de pinceles escolares', 30);
    PERFORM pg_temp.linea_libre(v_prog, 'Montaje y marcos para la muestra', 1, 250000,
        '5-2-01', 'Estimación del jefe');

    -- Ciencia: enviado y devuelto por Dirección.
    PERFORM set_config('app.usuario_id', '14', true);
    v_pres := pg_temp.presupuesto('Ciencia', 2027);
    v_prog := pg_temp.programa(v_pres, 'Laboratorio 1° y 2° medio',
        'Reactivos e insumos para las prácticas del año.');
    PERFORM pg_temp.linea(v_prog, 'Acetona anhidra pura', 6);
    PERFORM pg_temp.linea(v_prog, 'Ácido clorhídrico', 6);
    PERFORM pg_temp.linea(v_prog, 'Agar nutritivo', 4);
    PERFORM pg_temp.linea(v_prog, 'Guantes de nitrilo (caja 100)', 10);
    PERFORM pg_temp.linea(v_prog, 'Tubos de ensayo (caja 12)', 20);
    PERFORM pg_temp.linea(v_prog, 'Agitador magnético', 2);
    UPDATE presupuesto_departamento SET estado = 'enviado' WHERE id = v_pres;
    PERFORM set_config('app.usuario_id', '2', true);
    UPDATE presupuesto_departamento
       SET estado = 'devuelto',
           comentario_direccion = 'Como lo conversamos: dejen un solo agitador magnético y revisen la cantidad de guantes.'
     WHERE id = v_pres;

    -- Reproducción de imagen: aprobado, con los meses casi completos.
    PERFORM set_config('app.usuario_id', '11', true);
    v_pres := pg_temp.presupuesto('Reproducción de imagen', 2027);
    v_prog := pg_temp.programa(v_pres, 'Operación anual de fotocopiado',
        'Papel y tóner para las guías y evaluaciones de todo el colegio.');
    v_linea := pg_temp.linea(v_prog, 'Papel fotocopia carta (caja 10 resmas)', 40);
    PERFORM pg_temp.meses(v_linea, '{"3":4,"4":4,"5":4,"6":4,"7":4,"8":4,"9":4,"10":4,"11":4,"12":4}');
    v_linea := pg_temp.linea(v_prog, 'Tóner fotocopiadora (genérico)', 12);
    PERFORM pg_temp.meses(v_linea, '{"3":2,"4":1,"5":1,"6":1,"7":1,"8":1,"9":1}');
    v_linea := pg_temp.linea(v_prog, 'Tóner Brother TN-1060', 4);
    PERFORM pg_temp.meses(v_linea, '{"3":1,"6":1,"9":1,"11":1}');
    UPDATE presupuesto_departamento SET estado = 'enviado' WHERE id = v_pres;
    PERFORM set_config('app.usuario_id', '2', true);
    UPDATE presupuesto_departamento SET estado = 'aprobado' WHERE id = v_pres;

    -- Biblioteca: aprobado, sin meses asignados todavía.
    PERFORM set_config('app.usuario_id', '10', true);
    v_pres := pg_temp.presupuesto('Biblioteca', 2027);
    v_prog := pg_temp.programa(v_pres, 'Plan lector 2027',
        'Títulos del plan lector y diccionarios para la sala de estudio.');
    PERFORM pg_temp.linea(v_prog, 'Libro de lectura complementaria', 60);
    PERFORM pg_temp.linea(v_prog, 'Diccionario inglés-español escolar', 10);
    PERFORM pg_temp.linea(v_prog, 'Diccionario alemán-español escolar', 6);
    v_prog := pg_temp.programa(v_pres, 'Club de lectura', 'Encuentros mensuales con autores invitados.');
    PERFORM pg_temp.linea_libre(v_prog, 'Visita de autor invitado', 1, 180000, '5-2-01', 'Cotización del autor');
    UPDATE presupuesto_departamento SET estado = 'enviado' WHERE id = v_pres;
    PERFORM set_config('app.usuario_id', '2', true);
    UPDATE presupuesto_departamento SET estado = 'aprobado' WHERE id = v_pres;

    -- Formación: recién empezando, con un programa sin líneas.
    PERFORM set_config('app.usuario_id', '4', true);
    v_pres := pg_temp.presupuesto('Formación', 2027);
    PERFORM pg_temp.programa(v_pres, 'Jornadas de convivencia',
        'Dos jornadas por curso durante el año.');
END $$;

COMMIT;
