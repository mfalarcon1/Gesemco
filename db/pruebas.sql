-- =====================================================================
--  GESEMCO · Pruebas de las reglas de negocio
--
--  Corre sobre los datos de prueba y deshace todo al final (ROLLBACK),
--  así que se puede correr cuantas veces se quiera.
--
--      npm run db:test
--
--  Cada regla que pasa imprime "ok"; la primera que falla detiene todo
--  con el motivo. Los pedidos de prueba se hacen "el 8 de octubre de
--  2026" (creado_en fijo): así la regla de la anticipación da lo mismo
--  sin importar el día en que se corran.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Ayudas
-- ---------------------------------------------------------------------

-- Ejecuta p_sql y exige que falle con un mensaje que contenga p_contiene.
CREATE FUNCTION pg_temp.debe_fallar(p_sql text, p_contiene text) RETURNS void AS $$
BEGIN
    BEGIN
        EXECUTE p_sql;
    EXCEPTION WHEN OTHERS THEN
        IF position(p_contiene IN SQLERRM) = 0 THEN
            RAISE EXCEPTION 'Falló, pero con otro motivo. Esperaba "%" y llegó "%"', p_contiene, SQLERRM;
        END IF;
        RETURN;
    END;
    RAISE EXCEPTION 'Debía fallar y no falló: %', p_sql;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION pg_temp.ok(p_regla text) RETURNS void AS $$
BEGIN
    RAISE NOTICE 'ok  %', p_regla;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION pg_temp.cl(p_momento text) RETURNS timestamptz AS $$
    SELECT p_momento::timestamp AT TIME ZONE 'America/Santiago';
$$ LANGUAGE sql IMMUTABLE;

CREATE FUNCTION pg_temp.pres(p_depto text, p_anio integer) RETURNS integer AS $$
    SELECT pd.id
      FROM presupuesto_departamento pd
      JOIN departamento d ON d.id = pd.departamento_id
      JOIN anio_presupuestario ap ON ap.id = pd.anio_id
     WHERE d.nombre = p_depto AND ap.anio = p_anio;
$$ LANGUAGE sql;

CREATE FUNCTION pg_temp.linea(p_depto text, p_anio integer, p_descripcion text) RETURNS integer AS $$
    SELECT l.id
      FROM linea_presupuesto l JOIN programa p ON p.id = l.programa_id
     WHERE p.presupuesto_id = pg_temp.pres(p_depto, p_anio) AND l.descripcion = p_descripcion
     ORDER BY l.id
     LIMIT 1;
$$ LANGUAGE sql;

CREATE FUNCTION pg_temp.disponible(p_depto text) RETURNS bigint AS $$
    SELECT disponible FROM vw_saldo_departamento WHERE departamento = p_depto AND anio = 2026;
$$ LANGUAGE sql;

CREATE FUNCTION pg_temp.folio(p_orden integer) RETURNS text AS $$
    SELECT folio FROM orden_compra WHERE id = p_orden;
$$ LANGUAGE sql;

-- Pedido en borrador con un ítem a mano, a nombre del jefe del
-- departamento, hecho el 8 de octubre de 2026; devuelve su id.
CREATE FUNCTION pg_temp.borrador(
    p_depto text, p_monto integer, p_necesaria date DEFAULT '2026-10-20', p_anio integer DEFAULT 2026
) RETURNS integer AS $$
DECLARE
    v_pres   integer := pg_temp.pres(p_depto, p_anio);
    v_jefe   integer;
    v_orden  integer;
BEGIN
    SELECT r.usuario_id INTO v_jefe
      FROM rol_asignado r JOIN departamento d ON d.id = r.departamento_id
     WHERE r.rol = 'jefe_departamento' AND d.nombre = p_depto;
    PERFORM set_config('app.usuario_id', v_jefe::text, true);

    INSERT INTO orden_compra (folio, presupuesto_id, emitida_por, necesaria_para, creado_en)
    VALUES (fn_folio('OC', v_pres), v_pres, v_jefe, p_necesaria, pg_temp.cl('2026-10-08 10:00'))
    RETURNING id INTO v_orden;
    INSERT INTO item_orden (orden_id, descripcion, cantidad, precio_presupuesto)
    VALUES (v_orden, 'Ítem de prueba', 1, p_monto);
    RETURN v_orden;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------
-- Personas y permisos
-- ---------------------------------------------------------------------

DO $$
BEGIN
    PERFORM pg_temp.debe_fallar(
        $q$INSERT INTO rol_asignado (usuario_id, rol, departamento_id) VALUES (3, 'jefe_departamento', 2)$q$,
        'uq_un_jefe_vigente');
    PERFORM pg_temp.ok('un solo jefe vigente por departamento');

    PERFORM pg_temp.debe_fallar(
        $q$INSERT INTO rol_asignado (usuario_id, rol) VALUES (3, 'jefe_departamento')$q$,
        'ck_rol_ambito');
    PERFORM pg_temp.debe_fallar(
        $q$INSERT INTO rol_asignado (usuario_id, rol, departamento_id) VALUES (3, 'direccion', 2)$q$,
        'ck_rol_ambito');
    PERFORM pg_temp.ok('el jefe va con su departamento; los demás roles, sin');

    PERFORM pg_temp.debe_fallar(
        $q$INSERT INTO rol_asignado (usuario_id, rol, departamento_id) VALUES (3, 'profesor', 2)$q$,
        'invalid input value');
    PERFORM pg_temp.ok('los profesores no usan el sistema: no hay rol de profesor');
END $$;


-- ---------------------------------------------------------------------
-- Etapa 1 · Formulación, con los meses de cada ítem
-- ---------------------------------------------------------------------

DO $$
DECLARE
    v_arte      integer := pg_temp.pres('Arte', 2027);
    v_tempera   integer := pg_temp.linea('Arte', 2027, 'Témpera frasco 250 ml');
    v_montaje   integer := pg_temp.linea('Arte', 2027, 'Montaje de la muestra');
    v_cuaderno  integer := pg_temp.linea('Inglés', 2027, 'Cuaderno universitario 100 hojas 7 mm');
BEGIN
    PERFORM set_config('app.usuario_id', '13', true);

    -- Lo planificado mes a mes: el ejemplo de Arte de las presentaciones.
    ASSERT (SELECT array_agg(planificado ORDER BY mes) FROM vw_mes_departamento WHERE presupuesto_id = v_arte)
         = ARRAY[0, 0, 0, 59700, 0, 29850, 0, 0, 217880, 9950, 180000, 0]::numeric[],
        'los meses de Arte 2027 deben ser los de las presentaciones';
    ASSERT (SELECT sum(planificado) FROM vw_mes_departamento WHERE presupuesto_id = v_arte)
         = (SELECT formulado FROM vw_presupuesto_departamento WHERE presupuesto_id = v_arte);
    PERFORM pg_temp.ok('los meses de cada ítem suman, mes a mes, el total del presupuesto');

    PERFORM pg_temp.debe_fallar(
        format($q$INSERT INTO linea_calendario (linea_id, mes, cantidad) VALUES (%s, 3, 1)$q$, v_tempera),
        'no caben 1 más');
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE linea_calendario SET cantidad = 31 WHERE linea_id = %s AND mes = 6$q$, v_tempera),
        'no caben 31 más');
    PERFORM pg_temp.debe_fallar(
        format($q$INSERT INTO linea_calendario (linea_id, mes, cantidad) VALUES (%s, 13, 1)$q$, v_cuaderno),
        'linea_calendario_mes_check');
    PERFORM pg_temp.ok('los meses de un ítem no suman más que el ítem, y van de enero a diciembre');

    -- Si todo el ítem va en un mes, la nueva cantidad también va en ese mes.
    UPDATE linea_presupuesto SET cantidad = 2 WHERE id = v_montaje;
    ASSERT (SELECT cantidad FROM linea_calendario WHERE linea_id = v_montaje AND mes = 11) = 2;
    UPDATE linea_presupuesto SET cantidad = 1 WHERE id = v_montaje;
    ASSERT (SELECT cantidad FROM linea_calendario WHERE linea_id = v_montaje AND mes = 11) = 1;
    PERFORM pg_temp.ok('si un ítem va en un solo mes, su nueva cantidad también');

    -- Repartido en varios meses: si sube, lo nuevo queda sin mes; si baja
    -- de lo repartido, hay que repartirlo de nuevo.
    UPDATE linea_presupuesto SET cantidad = 60 WHERE id = v_tempera;
    ASSERT (SELECT cantidad_sin_mes FROM vw_calendarizacion_linea WHERE linea_id = v_tempera) = 10;
    UPDATE linea_presupuesto SET cantidad = 40 WHERE id = v_tempera;
    ASSERT NOT EXISTS (SELECT 1 FROM linea_calendario WHERE linea_id = v_tempera);
    ASSERT (SELECT lineas_sin_mes FROM vw_presupuesto_departamento WHERE presupuesto_id = v_arte) = 1;
    PERFORM pg_temp.ok('un ítem repartido que sube deja lo nuevo sin mes, y si baja de lo repartido se reparte de nuevo');

    -- Sin meses no se envía, y el mensaje dice a qué ítems les faltan.
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE presupuesto_departamento SET estado = 'enviado' WHERE id = %s$q$, v_arte),
        'Faltan meses en "Témpera frasco 250 ml"');
    INSERT INTO linea_calendario (linea_id, mes, cantidad) VALUES (v_tempera, 4, 25), (v_tempera, 6, 10), (v_tempera, 10, 5);
    UPDATE presupuesto_departamento SET estado = 'enviado' WHERE id = v_arte;
    PERFORM pg_temp.ok('no se envía con ítems sin meses; con todos sus meses, sí');

    PERFORM pg_temp.debe_fallar(
        format($q$DELETE FROM linea_calendario WHERE linea_id = %s$q$, v_tempera),
        'en revisión de Dirección');
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE linea_calendario SET cantidad = 1 WHERE linea_id = %s AND mes = 4$q$, v_tempera),
        'en revisión de Dirección');
    PERFORM pg_temp.ok('mientras lo revisan, los meses tampoco se cambian');
END $$;


DO $$
DECLARE
    v_pres  integer;
    v_prog  integer;
BEGIN
    -- Con varios ítems sin meses, el mensaje nombra tres y cuenta el resto.
    PERFORM set_config('app.usuario_id', '6', true);
    INSERT INTO presupuesto_departamento (departamento_id, anio_id)
    SELECT d.id, ap.id FROM departamento d, anio_presupuestario ap WHERE d.nombre = 'Física' AND ap.anio = 2027
    RETURNING id INTO v_pres;
    INSERT INTO programa (presupuesto_id, nombre) VALUES (v_pres, 'Laboratorio') RETURNING id INTO v_prog;
    INSERT INTO linea_presupuesto (programa_id, descripcion, cantidad, precio_unitario)
    VALUES (v_prog, 'Lupas', 10, 1500), (v_prog, 'Imanes', 10, 900), (v_prog, 'Resortes', 20, 500),
           (v_prog, 'Poleas', 4, 7000), (v_prog, 'Cronómetros', 6, 5000);
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE presupuesto_departamento SET estado = 'enviado' WHERE id = %s$q$, v_pres),
        'Faltan meses en "Lupas", "Imanes", "Resortes" y 2 ítems más');
    PERFORM pg_temp.ok('con varios ítems sin meses, el mensaje nombra tres y cuenta el resto');
END $$;


DO $$
DECLARE
    v_mat     integer := pg_temp.pres('Matemática', 2027);
    v_prog    integer;
    v_premios integer;
BEGIN
    SELECT id INTO v_prog FROM programa WHERE presupuesto_id = v_mat AND nombre = 'Olimpiada de matemática';
    PERFORM set_config('app.usuario_id', '5', true);

    -- Enviado: congelado mientras lo revisa Dirección.
    PERFORM pg_temp.debe_fallar(
        format($q$INSERT INTO linea_presupuesto (programa_id, descripcion, cantidad, precio_unitario)
                  VALUES (%s, 'Algo más', 1, 1000)$q$, v_prog),
        'en revisión de Dirección');
    PERFORM pg_temp.debe_fallar(
        format($q$DELETE FROM programa WHERE id = %s$q$, v_prog),
        'en revisión de Dirección');
    PERFORM pg_temp.ok('un presupuesto enviado no se edita');

    -- El jefe puede retirar el envío, editar (con los meses de lo nuevo) y volver a enviar.
    UPDATE presupuesto_departamento SET estado = 'borrador' WHERE id = v_mat;
    INSERT INTO linea_presupuesto (programa_id, descripcion, cantidad, precio_unitario)
    VALUES (v_prog, 'Premios olimpiada', 3, 15000) RETURNING id INTO v_premios;
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE presupuesto_departamento SET estado = 'enviado' WHERE id = %s$q$, v_mat),
        'Faltan meses en "Premios olimpiada"');
    INSERT INTO linea_calendario (linea_id, mes, cantidad) VALUES (v_premios, 9, 3);
    UPDATE presupuesto_departamento SET estado = 'enviado' WHERE id = v_mat;
    ASSERT (SELECT enviado_en FROM presupuesto_departamento WHERE id = v_mat) IS NOT NULL;
    PERFORM pg_temp.ok('retirar el envío, editar con sus meses y reenviar');

    -- Devolver exige comentario.
    PERFORM set_config('app.usuario_id', '2', true);
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE presupuesto_departamento SET estado = 'devuelto', comentario_direccion = '  ' WHERE id = %s$q$, v_mat),
        'ck_devuelto_con_comentario');
    PERFORM pg_temp.ok('Dirección no devuelve sin comentario');

    -- No se salta a nadie.
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE presupuesto_departamento SET estado = 'aprobado' WHERE id = %s$q$, pg_temp.pres('Inglés', 2027)),
        'está en preparación y no puede quedar aprobado');
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE presupuesto_departamento SET estado = 'aprobado' WHERE id = %s$q$, v_mat),
        'está en revisión de Dirección y no puede quedar aprobado');
    PERFORM pg_temp.ok('nada se aprueba sin pasar por Dirección y por contabilidad');

    -- No se envía vacío.
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE presupuesto_departamento SET estado = 'enviado' WHERE id = %s$q$, pg_temp.pres('Formación', 2027)),
        'sin ítems');
    PERFORM pg_temp.ok('no se envía un presupuesto sin ítems');

    -- Dirección aprueba: pasa a contabilidad, todavía sin monto congelado.
    UPDATE presupuesto_departamento SET estado = 'revision_contabilidad' WHERE id = v_mat;
    ASSERT (SELECT monto_aprobado FROM presupuesto_departamento WHERE id = v_mat) IS NULL,
        'el monto se congela recién cuando aprueba contabilidad';
    ASSERT (SELECT resuelto_direccion_por FROM presupuesto_departamento WHERE id = v_mat) = 2,
        'queda registrado quién aprobó en Dirección';
    ASSERT EXISTS (SELECT 1 FROM notificacion WHERE usuario_id = 1 AND titulo LIKE '%Matemática listo para revisar');
    ASSERT EXISTS (SELECT 1 FROM notificacion WHERE usuario_id = 5 AND titulo LIKE 'Dirección aprobó%Matemática');
    PERFORM pg_temp.ok('Dirección aprueba y el presupuesto pasa a contabilidad, con aviso a contabilidad y al jefe');

    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE linea_presupuesto SET cantidad = 99 WHERE programa_id = %s$q$, v_prog),
        'en revisión de contabilidad');
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE presupuesto_departamento SET estado = 'borrador' WHERE id = %s$q$, v_mat),
        'está en revisión de contabilidad y no puede quedar en preparación');
    PERFORM pg_temp.ok('mientras lo revisa contabilidad no se edita ni se retira');
END $$;


DO $$
DECLARE
    v_mat    integer := pg_temp.pres('Matemática', 2027);
    v_prog   integer;
    v_monto  bigint;
BEGIN
    SELECT id INTO v_prog FROM programa WHERE presupuesto_id = v_mat AND nombre = 'Olimpiada de matemática';
    PERFORM set_config('app.usuario_id', '1', true);

    -- Los reparos exigen decir qué corregir, y le llegan al jefe.
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE presupuesto_departamento SET estado = 'con_reparos' WHERE id = %s$q$, v_mat),
        'ck_reparos_con_comentario');
    UPDATE presupuesto_departamento
       SET estado = 'con_reparos', comentario_contabilidad = 'Los premios van por otra cuenta: sácalos del presupuesto.'
     WHERE id = v_mat;
    ASSERT EXISTS (SELECT 1 FROM notificacion
                    WHERE usuario_id = 5 AND mensaje = 'Los premios van por otra cuenta: sácalos del presupuesto.');
    PERFORM pg_temp.ok('contabilidad envía reparos con un comentario que le llega al jefe');

    -- Con reparos, el jefe corrige y lo reenvía directo a contabilidad.
    PERFORM set_config('app.usuario_id', '5', true);
    DELETE FROM linea_presupuesto WHERE programa_id = v_prog AND descripcion = 'Premios olimpiada';
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE presupuesto_departamento SET estado = 'enviado' WHERE id = %s$q$, v_mat),
        'con reparos de contabilidad y no puede quedar en revisión de Dirección');
    UPDATE presupuesto_departamento SET estado = 'revision_contabilidad' WHERE id = v_mat;
    ASSERT (SELECT resuelto_direccion_por FROM presupuesto_departamento WHERE id = v_mat) = 2,
        'la aprobación de Dirección se mantiene';
    ASSERT (SELECT en_contabilidad_desde FROM vw_presupuesto_departamento WHERE presupuesto_id = v_mat)
           = (SELECT enviado_en FROM presupuesto_departamento WHERE id = v_mat);
    ASSERT EXISTS (SELECT 1 FROM notificacion WHERE usuario_id = 1 AND titulo LIKE 'Matemática corrigió los reparos%');
    PERFORM pg_temp.ok('con reparos el jefe corrige y lo reenvía directo a contabilidad, sin pasar por Dirección');

    -- Contabilidad aprueba: se congela la suma de las líneas.
    PERFORM set_config('app.usuario_id', '1', true);
    SELECT formulado INTO v_monto FROM vw_presupuesto_departamento WHERE presupuesto_id = v_mat;
    UPDATE presupuesto_departamento SET estado = 'aprobado' WHERE id = v_mat;
    ASSERT (SELECT monto_aprobado FROM presupuesto_departamento WHERE id = v_mat) = v_monto,
        'el monto aprobado debe ser la suma de las líneas';
    ASSERT (SELECT resuelto_contabilidad_por FROM presupuesto_departamento WHERE id = v_mat) = 1,
        'queda registrado quién aprobó en contabilidad';
    ASSERT (SELECT vigente FROM vw_presupuesto_departamento WHERE presupuesto_id = v_mat) = v_monto;
    ASSERT EXISTS (SELECT 1 FROM notificacion WHERE usuario_id = 5 AND titulo LIKE 'Contabilidad aprobó%Matemática');
    PERFORM pg_temp.ok('contabilidad aprueba: congela el monto, registra quién y avisa al jefe');

    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE linea_presupuesto SET cantidad = 99 WHERE programa_id = %s$q$, v_prog),
        'aprobado');
    PERFORM pg_temp.debe_fallar(
        format($q$DELETE FROM linea_calendario WHERE linea_id IN (SELECT id FROM linea_presupuesto WHERE programa_id = %s)$q$, v_prog),
        'aprobado');
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE presupuesto_departamento SET monto_aprobado = 1 WHERE id = %s$q$, v_mat),
        'modificación presupuestaria');
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE presupuesto_departamento SET estado = 'con_reparos', comentario_contabilidad = 'Tarde' WHERE id = %s$q$, v_mat),
        'está aprobado y no puede quedar con reparos');
    PERFORM pg_temp.ok('un presupuesto aprobado queda congelado, con sus meses');
END $$;


DO $$
DECLARE
    v_his   integer := pg_temp.pres('Historia', 2027);
    v_prog  integer;
BEGIN
    -- Historia tiene reparos: lo que agregue también necesita sus meses, y vacío no se reenvía.
    PERFORM set_config('app.usuario_id', '7', true);
    SELECT id INTO v_prog FROM programa WHERE presupuesto_id = v_his AND nombre = 'Salida pedagógica';
    INSERT INTO linea_presupuesto (programa_id, descripcion, cantidad, precio_unitario)
    VALUES (v_prog, 'Seguro de la salida', 1, 40000);
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE presupuesto_departamento SET estado = 'revision_contabilidad' WHERE id = %s$q$, v_his),
        'Faltan meses en "Seguro de la salida"');
    DELETE FROM programa WHERE presupuesto_id = v_his;
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE presupuesto_departamento SET estado = 'revision_contabilidad' WHERE id = %s$q$, v_his),
        'sin ítems');
    PERFORM pg_temp.ok('al reenviar a contabilidad también se exigen los meses, y vacío no se reenvía');
END $$;


-- ---------------------------------------------------------------------
-- Etapa 2 · Pedidos (año 2026)
-- ---------------------------------------------------------------------

DO $$
DECLARE
    v_antes      bigint := pg_temp.disponible('Física');
    v_desviacion bigint;
    v_orden      integer;
    v_otra       integer;
    v_estado     estado_orden;
BEGIN
    SELECT desviacion INTO v_desviacion FROM vw_saldo_departamento WHERE departamento = 'Física' AND anio = 2026;

    -- Cabe: pasa a compra, descuenta a precio presupuesto y avisa con la fecha.
    v_orden := pg_temp.borrador('Física', 20000);
    UPDATE orden_compra SET estado = 'emitida' WHERE id = v_orden RETURNING estado INTO v_estado;
    ASSERT v_estado = 'emitida', 'un pedido que cabe queda emitido';
    ASSERT pg_temp.disponible('Física') = v_antes - 20000;
    ASSERT (SELECT fecha_emision FROM orden_compra WHERE id = v_orden) IS NOT NULL;
    ASSERT EXISTS (SELECT 1 FROM notificacion
                    WHERE usuario_id = 3 AND titulo = 'Pedido ' || pg_temp.folio(v_orden) || ' de Física listo para comprar'
                      AND mensaje = 'Ítem de prueba × 1. Se necesita el 20-10-2026.');
    PERFORM pg_temp.ok('un pedido que cabe pasa a compra, descuenta y avisa al equipo de compra con la fecha');

    -- La anticipación se cuenta desde el día en que se pide.
    v_otra := pg_temp.borrador('Física', 1000, '2026-10-14');
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE orden_compra SET estado = 'emitida' WHERE id = %s$q$, v_otra),
        'al menos 7 días de anticipación: la fecha más próxima que puedes poner es el 15-10-2026');
    v_otra := pg_temp.borrador('Física', 1000, '2026-10-15');
    UPDATE orden_compra SET estado = 'emitida' WHERE id = v_otra RETURNING estado INTO v_estado;
    ASSERT v_estado = 'emitida', 'justo una semana después vale';
    PERFORM pg_temp.ok('hay que pedir con una semana de anticipación');

    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE orden_compra SET estado = 'emitida' WHERE id = %s$q$, pg_temp.borrador('Física', 1000, '2027-01-11')),
        'tiene que ser de ese año');
    PERFORM pg_temp.ok('la fecha en que se necesita es del año del presupuesto');

    -- Lo pedido no se cambia.
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE item_orden SET cantidad = 2 WHERE orden_id = %s$q$, v_orden),
        'solo se cambian mientras está en borrador');
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE orden_compra SET necesaria_para = '2026-12-01' WHERE id = %s$q$, v_orden),
        'se fija al pedirlo');
    PERFORM pg_temp.ok('lo pedido no se cambia: ni sus ítems ni su fecha');

    -- Comprado no se marca a mano: lo marca el registro de la compra.
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE orden_compra SET estado = 'comprada' WHERE id = %s$q$, v_orden),
        'registra la compra');
    PERFORM set_config('app.usuario_id', '3', true);
    INSERT INTO compra (orden_id, proveedor, monto_total, registrada_por)
    VALUES (v_orden, 'Proveedor de prueba', 21500, 3);
    ASSERT (SELECT estado FROM orden_compra WHERE id = v_orden) = 'comprada';
    ASSERT pg_temp.disponible('Física') = v_antes - 20000 - 1000, 'la compra real no mueve el saldo';
    ASSERT (SELECT desviacion FROM vw_saldo_departamento WHERE departamento = 'Física' AND anio = 2026) = v_desviacion + 1500;
    ASSERT (SELECT diferencia FROM vw_pedido WHERE orden_id = v_orden) = 1500;
    ASSERT EXISTS (SELECT 1 FROM notificacion WHERE usuario_id = 6 AND titulo = 'Se compró tu pedido ' || pg_temp.folio(v_orden));
    PERFORM pg_temp.ok('registrar la compra marca el pedido comprado y avisa al jefe; el saldo no se mueve, la desviación sí');

    -- Recibido no se marca a mano: lo marca la recepción, y solo de lo comprado.
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE orden_compra SET estado = 'recibida' WHERE id = %s$q$, v_orden),
        'confirma la recepción');
    PERFORM pg_temp.debe_fallar(
        format($q$INSERT INTO recepcion (orden_id, recibido_por) VALUES (%s, 6)$q$, v_otra),
        'solo se recibe lo que ya se compró');
    PERFORM set_config('app.usuario_id', '6', true);
    INSERT INTO recepcion (orden_id, recibido_por) VALUES (v_orden, 6);
    ASSERT (SELECT estado FROM orden_compra WHERE id = v_orden) = 'recibida';
    PERFORM pg_temp.ok('el jefe confirma la recepción y el pedido queda recibido; no se recibe lo que no se ha comprado');

    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE orden_compra SET estado = 'emitida' WHERE id = %s$q$, v_orden),
        'está recibido y no puede quedar por comprar');
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE orden_compra SET estado = 'anulada' WHERE id = %s$q$, v_orden),
        'está recibido y no puede quedar anulado');
    PERFORM pg_temp.ok('un pedido no retrocede, y lo comprado no se anula');

    -- Anular lo que está por comprar libera el disponible y avisa al equipo de compra.
    UPDATE orden_compra SET estado = 'anulada' WHERE id = v_otra;
    ASSERT pg_temp.disponible('Física') = v_antes - 20000;
    ASSERT EXISTS (SELECT 1 FROM notificacion WHERE usuario_id = 3 AND titulo = 'Física anuló el pedido ' || pg_temp.folio(v_otra));
    PERFORM pg_temp.ok('anular un pedido por comprar libera el disponible y avisa al equipo de compra');
END $$;


DO $$
DECLARE
    v_antes      bigint := pg_temp.disponible('Física');
    v_orden      integer;
    v_estado     estado_orden;
    v_pendiente  integer;
    v_vigente    bigint;
BEGIN
    -- No cabe: espera a Dirección y no toca el saldo.
    v_orden := pg_temp.borrador('Física', v_antes::integer + 50000);
    UPDATE orden_compra SET estado = 'emitida' WHERE id = v_orden RETURNING estado INTO v_estado;
    ASSERT v_estado = 'pendiente_direccion', 'un pedido que no cabe espera a Dirección';
    SELECT id INTO v_pendiente FROM pendiente_pedido WHERE orden_id = v_orden;
    ASSERT (SELECT monto_excedido FROM pendiente_pedido WHERE id = v_pendiente) = 50000;
    ASSERT pg_temp.disponible('Física') = v_antes, 'lo que espera a Dirección no toca el saldo';
    ASSERT EXISTS (SELECT 1 FROM notificacion
                    WHERE usuario_id = 2 AND titulo = 'Física pide extender su presupuesto en $50.000'
                      AND mensaje = 'Pedido ' || pg_temp.folio(v_orden) || ': Ítem de prueba × 1, para el 20-10-2026.');
    PERFORM pg_temp.ok('un pedido que no cabe va a Dirección con lo que falta exacto, sin tocar el saldo');

    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE orden_compra SET estado = 'emitida' WHERE id = %s$q$, v_orden),
        'espera la resolución de Dirección');
    PERFORM pg_temp.ok('un pedido que espera a Dirección solo lo mueve Dirección');

    PERFORM set_config('app.usuario_id', '', true);
    PERFORM pg_temp.debe_fallar(
        format($q$SELECT fn_resolver_pendiente(%s, true)$q$, v_pendiente),
        'Falta declarar quién resuelve');
    PERFORM set_config('app.usuario_id', '2', true);
    PERFORM pg_temp.debe_fallar(
        format($q$SELECT fn_resolver_pendiente(%s, false, '')$q$, v_pendiente),
        'explicarle el motivo');
    PERFORM pg_temp.ok('resolver exige saber quién resuelve, y denegar exige explicación');

    -- Aprobar: extiende el presupuesto en lo que falta y el pedido pasa a compra.
    SELECT vigente INTO v_vigente FROM vw_saldo_departamento WHERE departamento = 'Física' AND anio = 2026;
    ASSERT fn_resolver_pendiente(v_pendiente, true, 'Va.') = 'emitida';
    ASSERT (SELECT vigente FROM vw_saldo_departamento WHERE departamento = 'Física' AND anio = 2026)
           = v_vigente + 50000, 'el vigente sube en lo que faltaba';
    ASSERT pg_temp.disponible('Física') = 0;
    ASSERT (SELECT monto FROM modificacion_presupuestaria WHERE pendiente_id = v_pendiente) = 50000;
    ASSERT (SELECT motivo FROM modificacion_presupuestaria WHERE pendiente_id = v_pendiente)
           = 'Extensión aprobada por Dirección: pedido ' || pg_temp.folio(v_orden);
    ASSERT (SELECT monto_aprobado FROM presupuesto_departamento WHERE id = pg_temp.pres('Física', 2026)) = 1803660,
        'el monto aprobado original no cambia';
    ASSERT (SELECT extension FROM vw_pedido WHERE orden_id = v_orden) = 50000;
    ASSERT EXISTS (SELECT 1 FROM notificacion
                    WHERE usuario_id = 6 AND titulo = 'Dirección aprobó tu pedido ' || pg_temp.folio(v_orden)
                      AND mensaje = 'Extendió tu presupuesto en $50.000 y el pedido pasó a compra.');
    ASSERT EXISTS (SELECT 1 FROM notificacion
                    WHERE usuario_id = 3 AND titulo = 'Pedido ' || pg_temp.folio(v_orden) || ' de Física listo para comprar');
    PERFORM pg_temp.ok('aprobar extiende el presupuesto en lo que falta, conserva el original, pasa a compra y avisa');

    PERFORM pg_temp.debe_fallar(
        format($q$SELECT fn_resolver_pendiente(%s, false, 'No')$q$, v_pendiente),
        'ya fue resuelta');
    PERFORM pg_temp.ok('una solicitud se resuelve una sola vez');
END $$;


DO $$
DECLARE
    v_orden      integer;
    v_pendiente  integer;
BEGIN
    -- Denegar: el pedido queda denegado y el jefe recibe la explicación.
    v_orden := pg_temp.borrador('Inglés', 200000);
    UPDATE orden_compra SET estado = 'emitida' WHERE id = v_orden;
    SELECT id INTO v_pendiente FROM pendiente_pedido WHERE orden_id = v_orden;

    PERFORM set_config('app.usuario_id', '2', true);
    ASSERT fn_resolver_pendiente(v_pendiente, false, 'Se compra el próximo año.') = 'denegada';
    ASSERT (SELECT estado FROM orden_compra WHERE id = v_orden) = 'denegada';
    ASSERT EXISTS (SELECT 1 FROM notificacion WHERE usuario_id = 8 AND mensaje = 'Se compra el próximo año.'),
        'el aviso le llega al jefe del departamento';
    ASSERT pg_temp.disponible('Inglés') = 80000;
    PERFORM pg_temp.ok('denegar avisa al jefe con la explicación y no toca el saldo');
END $$;


DO $$
DECLARE
    v_orden      integer;
    v_pendiente  integer;
BEGIN
    -- El jefe retira un pedido que espera a Dirección.
    v_orden := pg_temp.borrador('Lenguaje', 300000);
    UPDATE orden_compra SET estado = 'emitida' WHERE id = v_orden;
    SELECT id INTO v_pendiente FROM pendiente_pedido WHERE orden_id = v_orden;

    UPDATE orden_compra SET estado = 'anulada' WHERE id = v_orden;
    ASSERT (SELECT estado FROM pendiente_pedido WHERE id = v_pendiente) = 'retirado';
    ASSERT (SELECT resuelto_por FROM pendiente_pedido WHERE id = v_pendiente) = 9;
    ASSERT EXISTS (SELECT 1 FROM notificacion WHERE usuario_id = 2 AND titulo = 'Lenguaje retiró su pedido ' || pg_temp.folio(v_orden));

    PERFORM set_config('app.usuario_id', '2', true);
    PERFORM pg_temp.debe_fallar(
        format($q$SELECT fn_resolver_pendiente(%s, true)$q$, v_pendiente),
        'retiró ese pedido');
    PERFORM pg_temp.ok('el jefe puede retirar un pedido que espera a Dirección, y Dirección ya no lo resuelve');
END $$;


DO $$
DECLARE
    v_pres   integer := pg_temp.pres('Pastoral', 2026);
    v_linea  integer := pg_temp.linea('Pastoral', 2026, 'Flores y ornamentación');
    v_orden  integer;
    v_estado estado_orden;
BEGIN
    PERFORM set_config('app.usuario_id', '15', true);

    PERFORM pg_temp.debe_fallar(
        format($q$INSERT INTO orden_compra (folio, presupuesto_id, emitida_por, necesaria_para, estado)
                  VALUES ('OC-X', %s, 15, '2026-11-20', 'emitida')$q$, v_pres),
        'se crea en borrador');
    PERFORM pg_temp.ok('un pedido nace en borrador');

    INSERT INTO orden_compra (folio, presupuesto_id, emitida_por, necesaria_para, creado_en)
    VALUES (fn_folio('OC', v_pres), v_pres, 15, '2026-11-20', pg_temp.cl('2026-10-08 10:00')) RETURNING id INTO v_orden;
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE orden_compra SET estado = 'emitida' WHERE id = %s$q$, v_orden),
        'no tiene ítems');
    PERFORM pg_temp.ok('no se pide un pedido vacío');

    PERFORM pg_temp.debe_fallar(
        format($q$INSERT INTO compra (orden_id, proveedor, monto_total, registrada_por) VALUES (%s, 'X', 1000, 3)$q$, v_orden),
        'solo se registran compras de pedidos por comprar');
    PERFORM pg_temp.ok('no se compra lo que no se ha pedido');

    PERFORM pg_temp.debe_fallar(
        format($q$INSERT INTO item_orden (orden_id, linea_id, descripcion, cantidad, precio_presupuesto)
                  VALUES (%s, %s, 'Témpera', 1, 1990)$q$, v_orden, pg_temp.linea('Arte', 2026, 'Témpera frasco 250 ml')),
        'no es del presupuesto del pedido');
    PERFORM pg_temp.ok('un pedido solo trae ítems de su propio presupuesto');

    INSERT INTO item_orden (orden_id, linea_id, descripcion, cantidad, precio_presupuesto)
    VALUES (v_orden, v_linea, 'Flores y ornamentación', 1, 60000);
    INSERT INTO item_orden (orden_id, descripcion, cantidad, precio_presupuesto)
    VALUES (v_orden, 'Velas', 10, 1000);
    ASSERT (SELECT monto_presupuesto FROM orden_compra WHERE id = v_orden) = 70000;
    PERFORM pg_temp.ok('el total del pedido es la suma de sus ítems');

    UPDATE orden_compra SET estado = 'emitida' WHERE id = v_orden RETURNING estado INTO v_estado;
    ASSERT v_estado = 'emitida';
    ASSERT (SELECT pedida FROM vw_linea_pedida WHERE linea_id = v_linea) = 1;
    ASSERT (SELECT no_planificado FROM vw_pedido WHERE orden_id = v_orden);
    PERFORM pg_temp.ok('lo pedido de cada línea y lo que no estaba planificado quedan a la vista');

    ASSERT EXISTS (SELECT 1 FROM bitacora
                    WHERE entidad = 'orden_compra' AND entidad_id = v_orden
                      AND accion = 'cambiar_estado' AND usuario_id = 15);
    PERFORM pg_temp.ok('la bitácora registra quién cambió el estado');
END $$;


DO $$
DECLARE
    v_arte integer := pg_temp.pres('Arte', 2026);
BEGIN
    -- Lo pedido cuenta en el mes en que se necesita, aunque se haya planificado otro.
    ASSERT (SELECT planificado FROM vw_mes_departamento WHERE presupuesto_id = v_arte AND mes = 10) = 59700;
    ASSERT (SELECT pedido FROM vw_mes_departamento WHERE presupuesto_id = v_arte AND mes = 10) = 94700,
        'las témperas de octubre más las cartulinas de septiembre que se necesitaron en octubre';
    ASSERT (SELECT pedido FROM vw_mes_departamento WHERE presupuesto_id = v_arte AND mes = 9)
         = (SELECT planificado FROM vw_mes_departamento WHERE presupuesto_id = v_arte AND mes = 9) - 35000;
    PERFORM pg_temp.ok('mes a mes, lo pedido cuenta en el mes en que se necesita');
END $$;


DO $$
DECLARE
    v_orden integer;
BEGIN
    -- 2027 está en formulación: todavía no se pide contra él.
    v_orden := pg_temp.borrador('Biblioteca', 1000, '2027-03-10', 2027);
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE orden_compra SET estado = 'emitida' WHERE id = %s$q$, v_orden),
        'todavía no empieza');
    PERFORM pg_temp.ok('no se pide contra un presupuesto que todavía no está en ejecución');

    ASSERT fn_folio('SC', pg_temp.pres('Arte', 2026)) = 'SC-2026-0001';
    ASSERT fn_folio('SC', pg_temp.pres('Arte', 2026)) = 'SC-2026-0002';
    ASSERT fn_folio('OC', pg_temp.pres('Arte', 2027)) = 'OC-2027-0002';
    PERFORM pg_temp.ok('los folios son correlativos por año y por tipo');

    ASSERT fn_pesos(1234567) = '$1.234.567' AND fn_pesos(-500) = '-$500';
    PERFORM pg_temp.ok('los montos de los avisos van con punto de miles');
END $$;


DO $$
BEGIN
    -- Cerrar 2026 lo deja inmutable.
    UPDATE anio_presupuestario SET etapa = 'cerrado', fecha_cierre = '2027-01-31' WHERE anio = 2026;
    PERFORM pg_temp.debe_fallar(
        format($q$INSERT INTO programa (presupuesto_id, nombre) VALUES (%s, 'Tarde')$q$, pg_temp.pres('Arte', 2026)),
        'está cerrado');
    PERFORM pg_temp.debe_fallar(
        $q$UPDATE orden_compra SET observacion = 'cambio' WHERE folio = 'OC-2026-0001'$q$,
        'está cerrado');
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE linea_presupuesto SET cantidad = 2 WHERE id = %s$q$, pg_temp.linea('Arte', 2026, 'Témpera frasco 250 ml')),
        'está cerrado');
    PERFORM pg_temp.debe_fallar(
        format($q$DELETE FROM linea_calendario WHERE linea_id = %s$q$, pg_temp.linea('Arte', 2026, 'Témpera frasco 250 ml')),
        'está cerrado');
    PERFORM pg_temp.ok('un año cerrado no admite cambios');
END $$;


DO $$
BEGIN
    RAISE NOTICE 'Todas las reglas pasan.';
END $$;

ROLLBACK;
