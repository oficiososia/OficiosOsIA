// Kanban de tareas: una columna por fase del flujo de los becarios, más «Sin empezar»
// (abiertas sin fase) y «Cerrada» (hechas en el último mes).
import { becariosDeTarea, normalizar, ordenarTareas } from './oficina.js';

export const FASES = ['Preparación', 'Desarrollo y unitarias', 'Despliegue DEMO', 'QA DEMO', 'PR y revisión', 'Despliegue PROD', 'QA PROD'];
const MAX_CERRADAS = 30;

export const COLUMNAS = [
  { id: 'sin-empezar', nombre: 'Sin empezar' },
  ...FASES.map((fase) => ({ id: fase, nombre: fase })),
  { id: 'Cerrada', nombre: 'Cerrada' },
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
    tareas: [...abiertas, ...cerradas].map((t) => ({ ...t, becarios: becariosDeTarea(t), columna: columnaDe(t), sala: salas.get(normalizar(t.proyecto)) || t.proyecto || '' })),
  };
}
