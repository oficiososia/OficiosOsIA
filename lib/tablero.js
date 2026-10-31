// Kanban de tareas: una columna por fase del flujo de los becarios, más «Sin empezar»
// (abiertas sin fase) y «Cerrada» (hechas en el último mes). Cada departamento tiene sus fases
// (ver DEPARTAMENTOS): el tablero las junta en el orden del flujo y, al filtrar por
// departamento, el panel enseña solo las suyas.
import { DEPARTAMENTOS } from './becarios.js';
import { becariosDeTarea, departamentoDeTarea, normalizar, ordenarTareas } from './oficina.js';

export const FASES = ['Preparación', 'Cimientos', 'Desarrollo y unitarias', 'Auditoría', 'Producción', 'Intervención', 'Despliegue DEMO', 'QA DEMO', 'PR y revisión', 'Despliegue PROD', 'QA PROD'];
const MAX_CERRADAS = 30;

const departamentosDeFase = (fase) => DEPARTAMENTOS.filter((d) => d.fases.includes(fase)).map((d) => d.id);
const TODOS = DEPARTAMENTOS.map((d) => d.id);

export const COLUMNAS = [
  { id: 'sin-empezar', nombre: 'Sin empezar', departamentos: TODOS },
  ...FASES.map((fase) => ({ id: fase, nombre: fase, departamentos: departamentosDeFase(fase) })),
  { id: 'Cerrada', nombre: 'Cerrada', departamentos: TODOS },
];

export function columnaDe(tarea) {
  if (tarea.estado === 'Hecha' || tarea.fase === 'Cerrada') return 'Cerrada';
  return FASES.includes(tarea.fase) ? tarea.fase : 'sin-empezar';
}

// `salas`: de cada texto de «Proyecto relacionado» al nombre de su sala (ver mapaSalas).
export function construirTablero(tareas, salas = new Map()) {
  const abiertas = ordenarTareas(tareas.filter((t) => columnaDe(t) !== 'Cerrada'));
  const cerradas = tareas
    .filter((t) => columnaDe(t) === 'Cerrada')
    .sort((a, b) => String(b.editada || '').localeCompare(String(a.editada || '')))
    .slice(0, MAX_CERRADAS);
  return {
    columnas: COLUMNAS,
    tareas: [...abiertas, ...cerradas].map((t) => ({ ...t, becarios: becariosDeTarea(t), departamento: departamentoDeTarea(t), columna: columnaDe(t), sala: salas.get(normalizar(t.proyecto)) || t.proyecto || '' })),
  };
}
