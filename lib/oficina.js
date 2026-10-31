// Monta la oficina a partir de las tareas abiertas y los proyectos: una sala por proyecto,
// un puesto por becario del equipo (o con tareas en ese proyecto) y su estado según Notion.
import { BECARIOS, IDS_BECARIOS, PROYECTOS_POR_DEFECTO } from './becarios.js';

const ORDEN_ESTADO = { 'En progreso': 0, 'En espera': 1, 'Por hacer': 2, Inbox: 3 };
const ORDEN_PRIORIDAD = { Alta: 0, Media: 1, Baja: 2 };

export const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function ordenarTareas(tareas) {
  return [...tareas].sort(
    (a, b) =>
      (ORDEN_ESTADO[a.estado] ?? 9) - (ORDEN_ESTADO[b.estado] ?? 9) ||
      (ORDEN_PRIORIDAD[a.prioridad] ?? 9) - (ORDEN_PRIORIDAD[b.prioridad] ?? 9) ||
      String(b.editada || '').localeCompare(String(a.editada || '')),
  );
}

// trabajando: tiene algo En progreso · bloqueado: solo tareas En espera · en-cola: solo pendientes · libre: nada.
export function estadoBecario(tareas) {
  if (tareas.some((t) => t.estado === 'En progreso')) return 'trabajando';
  if (tareas.some((t) => t.estado === 'En espera')) return 'bloqueado';
  if (tareas.length) return 'en-cola';
  return 'libre';
}

const resumen = ({ id, url, titulo, fase, estado, prioridad, bloqueo }) => ({ id, url, titulo, fase, estado, prioridad, bloqueo });

export function construirOficina({ tareas, proyectosNotion }) {
  const guardable = Array.isArray(proyectosNotion);
  const base = guardable
    ? [...proyectosNotion].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999) || a.nombre.localeCompare(b.nombre, 'es'))
    : PROYECTOS_POR_DEFECTO.map((p) => ({ ...p, id: null, url: null, equipo: [] }));

  const salas = new Map(base.map((p) => [normalizar(p.clave), { ...p, tareas: [] }]));
  let sinProyecto = 0;
  for (const tarea of tareas) {
    const clave = normalizar(tarea.proyecto);
    if (!clave) {
      sinProyecto++;
      continue;
    }
    // Un proyecto que solo aparece en las tareas también tiene sala, para no esconder trabajo.
    if (!salas.has(clave)) salas.set(clave, { id: null, url: null, nombre: tarea.proyecto, clave: tarea.proyecto, repo: null, equipo: [], tareas: [] });
    salas.get(clave).tareas.push(tarea);
  }

  const proyectos = [...salas.values()].map((sala) => {
    const equipo = sala.equipo.filter((id) => IDS_BECARIOS.includes(id));
    const conTareas = new Set(sala.tareas.map((t) => t.becario).filter((id) => IDS_BECARIOS.includes(id)));
    const puestos = BECARIOS.filter((b) => equipo.includes(b.id) || conTareas.has(b.id)).map((b) => {
      const suyas = ordenarTareas(sala.tareas.filter((t) => t.becario === b.id));
      return {
        becario: b.id,
        asignado: equipo.includes(b.id),
        estado: estadoBecario(suyas),
        actual: suyas[0] ? resumen(suyas[0]) : null,
        tareas: suyas.map(resumen),
      };
    });
    const sinBecario = ordenarTareas(sala.tareas.filter((t) => !IDS_BECARIOS.includes(t.becario)));
    return {
      id: sala.id,
      url: sala.url,
      nombre: sala.nombre,
      clave: sala.clave,
      repo: sala.repo,
      equipo,
      puestos,
      sinBecario: sinBecario.map(resumen),
      abiertas: sala.tareas.length,
    };
  });

  return { becarios: BECARIOS, proyectos, guardable, sinProyecto };
}
