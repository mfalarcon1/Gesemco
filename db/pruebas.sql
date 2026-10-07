-- =====================================================================
--  GESEMCO · Pruebas de las reglas de negocio
--
--  Corre sobre los datos de prueba y deshace todo al final (ROLLBACK),
--  así que se puede correr cuantas veces se quiera.
--
--      npm run db:test
--
--  Cada regla que pasa imprime "ok"; la primera que falla detiene todo
--  con el motivo.
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

CREATE FUNCTION pg_temp.pres(p_depto text, p_anio integer) RETURNS integer AS $$
    SELECT pd.id
      FROM presupuesto_departamento pd
      JOIN departamento d ON d.id = pd.departamento_id
      JOIN anio_presupuestario ap ON ap.id = pd.anio_id
     WHERE d.nombre = p_depto AND ap.anio = p_anio;
$$ LANGUAGE sql;

CREATE FUNCTION pg_temp.disponible(p_depto text) RETURNS bigint AS $$
    SELECT disponible FROM vw_saldo_departamento WHERE departamento = p_depto AND anio = 2026;
$$ LANGUAGE sql;

-- Orden en borrador con un ítem libre, a nombre del jefe del
-- departamento; devuelve su id.
CREATE FUNCTION pg_temp.borrador(p_depto text, p_anio integer, p_monto integer) RETURNS integer AS $$
DECLARE
    v_pres   integer := pg_temp.pres(p_depto, p_anio);
    v_jefe   integer;
    v_orden  integer;
BEGIN
    SELECT r.usuario_id INTO v_jefe
      FROM rol_asignado r JOIN departamento d ON d.id = r.departamento_id
     WHERE r.rol = 'jefe_departamento' AND d.nombre = p_depto;

    INSERT INTO orden_compra (folio, presupuesto_id, emitida_por)
    VALUES (fn_folio('OC', v_pres), v_pres, v_jefe)
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
        $q$INSERT INTO rol_asignado (usuario_id, rol, departamento_id) VALUES (17, 'jefe_departamento', 2)$q$,
        'uq_un_jefe_vigente');
    PERFORM pg_temp.ok('un solo jefe vigente por departamento');

    PERFORM pg_temp.debe_fallar(
        $q$INSERT INTO rol_asignado (usuario_id, rol) VALUES (18, 'profesor')$q$,
        'ck_rol_ambito');
    PERFORM pg_temp.debe_fallar(
        $q$INSERT INTO rol_asignado (usuario_id, rol, departamento_id) VALUES (18, 'direccion', 2)$q$,
        'ck_rol_ambito');
    PERFORM pg_temp.ok('profesor y jefe van con departamento; los demás roles, sin');
END $$;


-- ---------------------------------------------------------------------
-- Etapa 1 · Formulación por periodos
-- ---------------------------------------------------------------------

DO $$
DECLARE
    v_arte  integer := pg_temp.pres('Arte', 2027);
BEGIN
    -- Todo programa va en uno de los tres periodos.
    PERFORM pg_temp.debe_fallar(
        format($q$INSERT INTO programa (presupuesto_id, nombre) VALUES (%s, 'Sin periodo')$q$, v_arte),
        'periodo');
    PERFORM pg_temp.debe_fallar(
        format($q$INSERT INTO programa (presupuesto_id, periodo, nombre) VALUES (%s, 4, 'Periodo inventado')$q$, v_arte),
        'programa_periodo_fkey');
    PERFORM pg_temp.ok('todo programa va en uno de los tres periodos');

    -- Un programa que sigue en otro periodo se vuelve a ingresar ahí, pero
    -- no puede estar dos veces en el mismo periodo.
    PERFORM pg_temp.debe_fallar(
        format($q$INSERT INTO programa (presupuesto_id, periodo, nombre) VALUES (%s, 1, 'muestra de arte de fin de año')$q$, v_arte),
        'uq_programa_nombre');
    ASSERT (SELECT count(*) FROM programa WHERE presupuesto_id = v_arte AND nombre = 'Muestra de arte de fin de año') = 3;
    PERFORM pg_temp.ok('un programa se repite en otro periodo, pero no dos veces en el mismo');

    -- Lo que pide cada periodo: el ejemplo de Arte de las presentaciones.
    ASSERT (SELECT monto FROM vw_proyeccion_periodo WHERE presupuesto_id = v_arte AND periodo = 1) = 107580;
    ASSERT (SELECT monto FROM vw_proyeccion_periodo WHERE presupuesto_id = v_arte AND periodo = 2) = 29850;
    ASSERT (SELECT monto FROM vw_proyeccion_periodo WHERE presupuesto_id = v_arte AND periodo = 3) = 359950;
    ASSERT (SELECT formulado FROM vw_presupuesto_departamento WHERE presupuesto_id = v_arte) = 497380;
    PERFORM pg_temp.ok('lo que pide cada periodo suma el total del presupuesto');
END $$;


DO $$
DECLARE
    v_mat   integer := pg_temp.pres('Matemática', 2027);
    v_prog  integer;
BEGIN
    SELECT id INTO v_prog FROM programa WHERE presupuesto_id = v_mat AND nombre = 'Olimpiada de matemática';

    -- Enviado: congelado mientras lo revisa Dirección.
    PERFORM pg_temp.debe_fallar(
        format($q$INSERT INTO linea_presupuesto (programa_id, descripcion, cantidad, precio_unitario)
                  VALUES (%s, 'Algo más', 1, 1000)$q$, v_prog),
        'en revisión de Dirección');
    PERFORM pg_temp.debe_fallar(
        format($q$DELETE FROM programa WHERE id = %s$q$, v_prog),
        'en revisión de Dirección');
    PERFORM pg_temp.ok('un presupuesto enviado no se edita');

    -- El jefe puede retirar el envío, editar y volver a enviar.
    UPDATE presupuesto_departamento SET estado = 'borrador' WHERE id = v_mat;
    INSERT INTO linea_presupuesto (programa_id, descripcion, cantidad, precio_unitario)
    VALUES (v_prog, 'Premios olimpiada', 3, 15000);
    UPDATE presupuesto_departamento SET estado = 'enviado' WHERE id = v_mat;
    ASSERT (SELECT enviado_en FROM presupuesto_departamento WHERE id = v_mat) IS NOT NULL;
    PERFORM pg_temp.ok('retirar el envío, editar y reenviar');

    -- Devolver exige comentario.
    PERFORM set_config('app.usuario_id', '2', true);
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE presupuesto_departamento SET estado = 'devuelto', comentario_direccion = '  ' WHERE id = %s$q$, v_mat),
        'ck_devuelto_con_comentario');
    PERFORM pg_temp.ok('Dirección no devuelve sin comentario');

    -- No se salta a nadie.
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE presupuesto_departamento SET estado = 'aprobado' WHERE id = %s$q$, pg_temp.pres('Arte', 2027)),
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
        format($q$UPDATE presupuesto_departamento SET monto_aprobado = 1 WHERE id = %s$q$, v_mat),
        'modificación presupuestaria');
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE presupuesto_departamento SET estado = 'con_reparos', comentario_contabilidad = 'Tarde' WHERE id = %s$q$, v_mat),
        'está aprobado y no puede quedar con reparos');
    PERFORM pg_temp.ok('un presupuesto aprobado queda congelado');

    -- Las órdenes de compra: solo lo aprobado, separado por periodo.
    ASSERT NOT EXISTS (SELECT 1 FROM vw_orden_periodo WHERE presupuesto_id = pg_temp.pres('Arte', 2027)),
        'un presupuesto sin aprobar no entra a las órdenes';
    ASSERT (SELECT sum(subtotal) FROM vw_orden_periodo WHERE presupuesto_id = v_mat) = v_monto;
    ASSERT NOT EXISTS (
        SELECT 1 FROM vw_proyeccion_periodo pp
         WHERE pp.presupuesto_id = v_mat
           AND pp.monto <> (SELECT COALESCE(sum(o.subtotal), 0) FROM vw_orden_periodo o
                             WHERE o.presupuesto_id = v_mat AND o.periodo = pp.periodo)),
        'cada orden trae lo del periodo';
    PERFORM pg_temp.ok('las órdenes de compra traen lo aprobado, separado por periodo');
END $$;


DO $$
DECLARE
    v_his integer := pg_temp.pres('Historia', 2027);
BEGIN
    -- Historia tiene reparos: si el jefe lo vacía, no lo puede reenviar.
    PERFORM set_config('app.usuario_id', '7', true);
    DELETE FROM programa WHERE presupuesto_id = v_his;
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE presupuesto_departamento SET estado = 'revision_contabilidad' WHERE id = %s$q$, v_his),
        'sin ítems');
    PERFORM pg_temp.ok('tampoco se reenvía vacío a contabilidad');
END $$;


-- ---------------------------------------------------------------------
-- Etapa 2 · Ejecución (año 2026)
-- ---------------------------------------------------------------------

DO $$
DECLARE
    v_antes   bigint := pg_temp.disponible('Física');
    v_orden   integer;
    v_estado  estado_orden;
BEGIN
    PERFORM set_config('app.usuario_id', '6', true);

    -- Cabe: queda emitida y descuenta a precio presupuesto.
    v_orden := pg_temp.borrador('Física', 2026, 250000);
    UPDATE orden_compra SET estado = 'emitida' WHERE id = v_orden RETURNING estado INTO v_estado;
    ASSERT v_estado = 'emitida', 'una orden que cabe queda emitida';
    ASSERT pg_temp.disponible('Física') = v_antes - 250000;
    ASSERT (SELECT fecha_emision FROM orden_compra WHERE id = v_orden) IS NOT NULL;
    ASSERT EXISTS (SELECT 1 FROM notificacion WHERE usuario_id = 3 AND titulo LIKE '%' ||
                   (SELECT folio FROM orden_compra WHERE id = v_orden) || '%lista para comprar');
    PERFORM pg_temp.ok('una orden que cabe se emite, descuenta y avisa al equipo de compra');

    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE item_orden SET cantidad = 2 WHERE orden_id = %s$q$, v_orden),
        'solo se cambian mientras está en borrador');
    PERFORM pg_temp.ok('los ítems de una orden emitida no se tocan');

    -- La compra real no mueve el saldo, solo la desviación.
    PERFORM set_config('app.usuario_id', '3', true);
    INSERT INTO compra (orden_id, proveedor, monto_total, registrada_por)
    VALUES (v_orden, 'Proveedor de prueba', 262000, 3);
    UPDATE orden_compra SET estado = 'comprada' WHERE id = v_orden;
    ASSERT pg_temp.disponible('Física') = v_antes - 250000;
    ASSERT (SELECT desviacion FROM vw_saldo_departamento WHERE departamento = 'Física' AND anio = 2026) = 12000;
    PERFORM pg_temp.ok('la compra real no mueve el saldo y la desviación la registra');

    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE orden_compra SET estado = 'emitida' WHERE id = %s$q$, v_orden),
        'no puede pasar de comprada a emitida');
    PERFORM pg_temp.ok('una orden no retrocede de estado');
END $$;


DO $$
DECLARE
    v_antes      bigint := pg_temp.disponible('Física');
    v_orden      integer;
    v_estado     estado_orden;
    v_pendiente  integer;
    v_vigente    bigint;
BEGIN
    PERFORM set_config('app.usuario_id', '6', true);

    -- No cabe: queda pendiente de Dirección y no toca el saldo.
    v_orden := pg_temp.borrador('Física', 2026, v_antes::integer + 50000);
    UPDATE orden_compra SET estado = 'emitida' WHERE id = v_orden RETURNING estado INTO v_estado;
    ASSERT v_estado = 'pendiente_direccion', 'una orden que no cabe queda pendiente';
    SELECT id INTO v_pendiente FROM pendiente_pedido WHERE orden_id = v_orden;
    ASSERT (SELECT monto_excedido FROM pendiente_pedido WHERE id = v_pendiente) = 50000;
    ASSERT pg_temp.disponible('Física') = v_antes, 'un pendiente no toca el saldo';
    ASSERT EXISTS (SELECT 1 FROM notificacion WHERE usuario_id = 2 AND mensaje LIKE '%$50.000');
    PERFORM pg_temp.ok('una orden que no cabe queda pendiente de Dirección con el exceso exacto');

    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE orden_compra SET estado = 'emitida' WHERE id = %s$q$, v_orden),
        'espera la resolución de Dirección');
    PERFORM pg_temp.ok('una orden pendiente solo la mueve Dirección');

    PERFORM set_config('app.usuario_id', '', true);
    PERFORM pg_temp.debe_fallar(
        format($q$SELECT fn_resolver_pendiente(%s, true)$q$, v_pendiente),
        'Falta declarar quién resuelve');
    PERFORM set_config('app.usuario_id', '2', true);
    PERFORM pg_temp.debe_fallar(
        format($q$SELECT fn_resolver_pendiente(%s, false, '')$q$, v_pendiente),
        'explicarle el motivo');
    PERFORM pg_temp.ok('resolver exige saber quién resuelve, y denegar exige explicación');

    -- Aprobar: aumenta el presupuesto en lo que falta y emite.
    SELECT vigente INTO v_vigente FROM vw_saldo_departamento WHERE departamento = 'Física' AND anio = 2026;
    ASSERT fn_resolver_pendiente(v_pendiente, true, 'Va.') = 'emitida';
    ASSERT (SELECT vigente FROM vw_saldo_departamento WHERE departamento = 'Física' AND anio = 2026)
           = v_vigente + 50000, 'el vigente sube en lo que faltaba';
    ASSERT pg_temp.disponible('Física') = 0;
    ASSERT (SELECT monto FROM modificacion_presupuestaria WHERE pendiente_id = v_pendiente) = 50000;
    ASSERT (SELECT monto_aprobado FROM presupuesto_departamento WHERE id = pg_temp.pres('Física', 2026)) = 1900000,
        'el monto aprobado original no cambia';
    PERFORM pg_temp.ok('aprobar un pendiente registra la modificación, conserva el original y emite');

    PERFORM pg_temp.debe_fallar(
        format($q$SELECT fn_resolver_pendiente(%s, false, 'No')$q$, v_pendiente),
        'ya fue resuelto');
    PERFORM pg_temp.ok('un pendiente se resuelve una sola vez');
END $$;


DO $$
DECLARE
    v_orden      integer;
    v_pendiente  integer;
BEGIN
    -- Denegar: la orden queda denegada y el jefe recibe la explicación.
    PERFORM set_config('app.usuario_id', '8', true);
    v_orden := pg_temp.borrador('Inglés', 2026, 1600000);
    UPDATE orden_compra SET estado = 'emitida' WHERE id = v_orden;
    SELECT id INTO v_pendiente FROM pendiente_pedido WHERE orden_id = v_orden;

    PERFORM set_config('app.usuario_id', '2', true);
    ASSERT fn_resolver_pendiente(v_pendiente, false, 'Se compra el próximo año.') = 'denegada';
    ASSERT (SELECT estado FROM orden_compra WHERE id = v_orden) = 'denegada';
    ASSERT EXISTS (SELECT 1 FROM notificacion WHERE usuario_id = 8 AND mensaje = 'Se compra el próximo año.'),
        'el aviso le llega a quien emitió la orden';
    ASSERT pg_temp.disponible('Inglés') = 1500000;
    PERFORM pg_temp.ok('denegar un pendiente avisa al jefe con la explicación y no toca el saldo');
END $$;


DO $$
DECLARE
    v_orden  integer;
    v_pres   integer := pg_temp.pres('Lenguaje', 2026);
BEGIN
    PERFORM set_config('app.usuario_id', '9', true);

    PERFORM pg_temp.debe_fallar(
        format($q$INSERT INTO orden_compra (folio, presupuesto_id, emitida_por, estado)
                  VALUES ('OC-X', %s, 9, 'emitida')$q$, v_pres),
        'se crea en borrador');
    PERFORM pg_temp.ok('una orden nace en borrador');

    INSERT INTO orden_compra (folio, presupuesto_id, emitida_por)
    VALUES (fn_folio('OC', v_pres), v_pres, 9) RETURNING id INTO v_orden;
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE orden_compra SET estado = 'emitida' WHERE id = %s$q$, v_orden),
        'no tiene ítems');
    PERFORM pg_temp.ok('no se emite una orden vacía');

    PERFORM pg_temp.debe_fallar(
        format($q$INSERT INTO compra (orden_id, proveedor, monto_total, registrada_por)
                  VALUES (%s, 'X', 1000, 3)$q$, v_orden),
        'Solo se registran compras de órdenes emitidas');
    PERFORM pg_temp.ok('no se compra una orden sin emitir');

    INSERT INTO item_orden (orden_id, descripcion, cantidad, precio_presupuesto)
    VALUES (v_orden, 'Ítem', 2, 1000);
    UPDATE orden_compra SET estado = 'emitida' WHERE id = v_orden;
    PERFORM pg_temp.debe_fallar(
        format($q$INSERT INTO recepcion (orden_id, recibido_por) VALUES (%s, 9)$q$, v_orden),
        'ya compradas');
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE orden_compra SET estado = 'recibida' WHERE id = %s$q$, v_orden),
        'no puede pasar de emitida a recibida');
    PERFORM pg_temp.ok('no se recibe lo que no se ha comprado');

    ASSERT (SELECT monto_presupuesto FROM orden_compra WHERE id = v_orden) = 2000;
    PERFORM pg_temp.ok('el total de la orden es la suma de sus ítems');

    ASSERT EXISTS (SELECT 1 FROM bitacora
                    WHERE entidad = 'orden_compra' AND entidad_id = v_orden
                      AND accion = 'cambiar_estado' AND usuario_id = 9);
    PERFORM pg_temp.ok('la bitácora registra quién cambió el estado');
END $$;


DO $$
DECLARE
    v_orden integer;
BEGIN
    -- 2027 está en formulación: todavía no se compra contra él.
    PERFORM set_config('app.usuario_id', '11', true);
    v_orden := pg_temp.borrador('Reproducción de imagen', 2027, 1000);
    PERFORM pg_temp.debe_fallar(
        format($q$UPDATE orden_compra SET estado = 'emitida' WHERE id = %s$q$, v_orden),
        'año en ejecución');
    PERFORM pg_temp.ok('no se emiten órdenes contra un año en formulación');

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
        format($q$INSERT INTO programa (presupuesto_id, periodo, nombre) VALUES (%s, 1, 'Tarde')$q$,
               pg_temp.pres('Arte', 2026)),
        'está cerrado');
    PERFORM pg_temp.debe_fallar(
        $q$UPDATE orden_compra SET observacion = 'cambio' WHERE folio = 'OC-2026-0001'$q$,
        'está cerrado');
    PERFORM pg_temp.debe_fallar(
        $q$UPDATE linea_presupuesto SET cantidad = 2 WHERE descripcion = 'Monto aprobado 2026'$q$,
        'está cerrado');
    PERFORM pg_temp.ok('un año cerrado no admite cambios');
END $$;


DO $$
BEGIN
    RAISE NOTICE 'Todas las reglas pasan.';
END $$;

ROLLBACK;
