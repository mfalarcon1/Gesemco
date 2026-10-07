/**
 * Los tres periodos del año escolar, como se nombran en la pantalla. La base
 * los tiene en la tabla `periodo`; si cambian, se cambian en los dos lados.
 * Módulo sin acceso a la base: lo pueden importar los componentes de cliente.
 */
export type NumeroPeriodo = 1 | 2 | 3;

export type Periodo = { numero: NumeroPeriodo; nombre: string; meses: string };

export const PERIODOS: readonly Periodo[] = [
  { numero: 1, nombre: 'Periodo 1', meses: 'marzo a mayo' },
  { numero: 2, nombre: 'Periodo 2', meses: 'junio a agosto' },
  { numero: 3, nombre: 'Periodo 3', meses: 'septiembre a diciembre' },
];

export const esPeriodo = (n: unknown): n is NumeroPeriodo => n === 1 || n === 2 || n === 3;

export const periodo = (n: number): Periodo => PERIODOS.find((p) => p.numero === n) ?? PERIODOS[0];

/** "Periodo 1 · marzo a mayo" */
export const nombreCompleto = (n: number) => {
  const p = periodo(n);
  return `${p.nombre} · ${p.meses}`;
};
