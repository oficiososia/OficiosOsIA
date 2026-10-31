// Monta la oficina a partir de las tareas abiertas y los proyectos: una sala por proyecto,
// un puesto por becario del equipo (o con tareas en ese proyecto) y su estado según Notion.
// Cada sala se divide en habitaciones, una por departamento (desarrollo, ciberseguridad,
// marketing y soporte IT); la de
// producto la pone el panel en todas.
import { BECARIOS, DEPARTAMENTOS, departamentoDe, IDS_BECARIOS, PROYECTOS_POR_DEFECTO } from './becarios.js';

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

// Becarios de una tarea: una tarea padre puede tenerla uno o varios a la vez.
export const becariosDeTarea = (t) => (Array.isArray(t.becarios) ? t.becarios : t.becario ? [t.becario] : []).filter((id) => IDS_BECARIOS.includes(id));

// Departamento de una tarea: el de quien la tiene (si la tienen varios, el del primero).
export const departamentoDeTarea = (t) => becariosDeTarea(t).map(departamentoDe).find(Boolean) || null;

const resumen = (t) => ({ id: t.id, url: t.url, titulo: t.titulo, fase: t.fase, estado: t.estado, prioridad: t.prioridad, bloqueo: t.bloqueo, pr: t.pr || null, becarios: becariosDeTarea(t), departamento: departamentoDeTarea(t) });

// Habitaciones de la sala: los departamentos con alguien en el equipo o con tareas abiertas.
// `activo`: está en el equipo (se le pueden pasar tareas); si solo tiene tareas, sale igual
// para no esconder trabajo.
export function habitaciones(equipo, puestos) {
  return DEPARTAMENTOS.map((d) => {
    const suyos = puestos.filter((pu) => departamentoDe(pu.becario) === d.id);
    const activo = equipo.some((id) => departamentoDe(id) === d.id);
    return {
      id: d.id,
      nombre: d.nombre,
      entrada: d.entrada,
      activo,
      conEntrada: equipo.includes(d.entrada),
      trabajando: suyos.some((pu) => pu.estado === 'trabajando'),
      abiertas: new Set(suyos.flatMap((pu) => pu.tareas.map((t) => t.id))).size,
    };
  }).filter((h) => h.activo || puestos.some((pu) => departamentoDe(pu.becario) === h.id));
}

// «Proyecto en tareas» admite varios textos separados por comas (p. ej. «Atletas, Nexo»).
export const clavesDe = (clave) => String(clave || '').split(',').map((c) => c.trim()).filter(Boolean);

// Proyectos ordenados, sin las filas duplicadas: si todas las claves de una fila ya las cubre
// otra con más claves (o igual y antes), no se dibuja otra sala para ella.
export function proyectosBase(proyectosNotion) {
  const lista = Array.isArray(proyectosNotion)
    ? [...proyectosNotion].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999) || a.nombre.localeCompare(b.nombre, 'es'))
    : PROYECTOS_POR_DEFECTO.map((p) => ({ ...p, id: null, url: null, equipo: [], logo: null, color: null }));
  const conClaves = lista.map((p) => ({ ...p, claves: clavesDe(p.clave).length ? clavesDe(p.clave) : [p.nombre] }));
  return conClaves.filter((p, i) => {
    const mias = new Set(p.claves.map(normalizar));
    return !conClaves.some((otro, j) => {
      if (j === i) return false;
      const suyas = new Set(otro.claves.map(normalizar));
      const cubre = [...mias].every((c) => suyas.has(c));
      return cubre && (suyas.size > mias.size || j < i);
    });
  });
}

// De cada texto de «Proyecto relacionado» al nombre de su sala.
export function mapaSalas(proyectosNotion) {
  const mapa = new Map();
  for (const p of proyectosBase(proyectosNotion)) for (const c of p.claves) mapa.set(normalizar(c), p.nombre);
  return mapa;
}

// `becarios`: las fichas completas (combinarBecarios). Un becario pausado no tiene mesa en las
// salas, salvo donde aún tenga tareas abiertas, para no esconder trabajo.
export function construirOficina({ tareas, proyectosNotion, becarios = BECARIOS }) {
  const guardable = Array.isArray(proyectosNotion);
  const salas = proyectosBase(proyectosNotion).map((p) => ({ ...p, tareas: [] }));
  const porClave = new Map();
  for (const sala of salas) for (const c of sala.claves) porClave.set(normalizar(c), sala);

  let sinProyecto = 0;
  for (const tarea of tareas) {
    const clave = normalizar(tarea.proyecto);
    if (!clave) {
      sinProyecto++;
      continue;
    }
    // Un proyecto que solo aparece en las tareas también tiene sala, para no esconder trabajo.
    if (!porClave.has(clave)) {
      const nueva = { id: null, url: null, nombre: tarea.proyecto, claves: [tarea.proyecto], repo: null, equipo: [], logo: null, color: null, tareas: [] };
      salas.push(nueva);
      porClave.set(clave, nueva);
    }
    porClave.get(clave).tareas.push(tarea);
  }

  const proyectos = salas.map((sala) => {
    const equipo = sala.equipo.filter((id) => IDS_BECARIOS.includes(id));
    const conTareas = new Set(sala.tareas.flatMap(becariosDeTarea));
    const puestos = becarios.filter((b) => conTareas.has(b.id) || (equipo.includes(b.id) && !b.pausado)).map((b) => {
      const suyas = ordenarTareas(sala.tareas.filter((t) => becariosDeTarea(t).includes(b.id)));
      return {
        becario: b.id,
        departamento: b.departamento,
        asignado: equipo.includes(b.id),
        pausado: b.pausado,
        estado: estadoBecario(suyas),
        actual: suyas[0] ? resumen(suyas[0]) : null,
        tareas: suyas.map(resumen),
      };
    });
    const sinBecario = ordenarTareas(sala.tareas.filter((t) => !becariosDeTarea(t).length));
    return {
      id: sala.id,
      url: sala.url,
      nombre: sala.nombre,
      // La primera clave es la que llevan las tareas y peticiones nuevas de esta sala.
      clave: sala.claves[0],
      claves: sala.claves,
      repo: sala.repo,
      logo: sala.logo,
      color: sala.color,
      equipo,
      puestos,
      habitaciones: habitaciones(equipo, puestos),
      sinBecario: sinBecario.map(resumen),
      abiertas: sala.tareas.length,
    };
  });

  // Las instrucciones no hacen falta para pintar la oficina.
  const departamentos = DEPARTAMENTOS.map(({ id, nombre, entrada, papel }) => ({ id, nombre, entrada, papel }));
  return { becarios: becarios.map(({ instrucciones, ...b }) => b), departamentos, proyectos, guardable, sinProyecto };
}
