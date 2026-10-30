import assert from 'node:assert/strict';
import { test } from 'node:test';
import { construirOficina, estadoBecario, ordenarTareas } from '../lib/oficina.js';

const tarea = (datos) => ({ id: datos.titulo, url: 'https://app.notion.com/p/x', fase: null, prioridad: null, bloqueo: '', editada: null, ...datos });

test('el estado del becario sale de sus tareas', () => {
  assert.equal(estadoBecario([]), 'libre');
  assert.equal(estadoBecario([tarea({ estado: 'Inbox' })]), 'en-cola');
  assert.equal(estadoBecario([tarea({ estado: 'Por hacer' }), tarea({ estado: 'En espera' })]), 'bloqueado');
  assert.equal(estadoBecario([tarea({ estado: 'En espera' }), tarea({ estado: 'En progreso' })]), 'trabajando');
});

test('la tarea actual es la que está en progreso y, a igualdad, la más prioritaria', () => {
  const orden = ordenarTareas([
    tarea({ titulo: 'b', estado: 'Por hacer', prioridad: 'Alta' }),
    tarea({ titulo: 'c', estado: 'En progreso', prioridad: 'Baja' }),
    tarea({ titulo: 'a', estado: 'En progreso', prioridad: 'Alta' }),
  ]);
  assert.deepEqual(orden.map((t) => t.titulo), ['a', 'c', 'b']);
});

test('sin base «Proyectos» salen los proyectos por defecto y los becarios con tareas', () => {
  const oficina = construirOficina({
    proyectosNotion: null,
    tareas: [
      tarea({ titulo: 'Botones', proyecto: 'Casa Tomás', becario: 'cto', estado: 'En progreso', fase: 'PR y revisión' }),
      tarea({ titulo: 'Login', proyecto: 'casa tomas', becario: 'frontend', estado: 'Inbox' }),
      tarea({ titulo: 'Suelta', proyecto: '', becario: 'cto', estado: 'Inbox' }),
    ],
  });
  assert.equal(oficina.guardable, false);
  assert.equal(oficina.sinProyecto, 1);
  const casa = oficina.proyectos.find((p) => p.nombre === 'Casa Tomás');
  assert.equal(casa.abiertas, 2, 'el nombre se compara sin tildes ni mayúsculas');
  assert.deepEqual(casa.puestos.map((p) => [p.becario, p.estado, p.asignado]), [['cto', 'trabajando', false], ['frontend', 'en-cola', false]]);
  assert.equal(casa.puestos[0].actual.fase, 'PR y revisión');
  assert.ok(oficina.proyectos.find((p) => p.nombre === 'Nexo'));
});

test('con base «Proyectos», el equipo asignado tiene puesto aunque esté libre', () => {
  const oficina = construirOficina({
    proyectosNotion: [
      { id: 'p2', url: null, nombre: 'Nexo', clave: 'Nexo', equipo: ['frontend', 'qa-tecnico', 'inventado'], repo: null, orden: 2 },
      { id: 'p1', url: null, nombre: 'Energym', clave: 'Energym', equipo: ['cto'], repo: null, orden: 1 },
    ],
    tareas: [
      tarea({ titulo: 'Clases', proyecto: 'Energym', becario: 'delivery', estado: 'En espera', bloqueo: 'Falta la clave de Stripe' }),
      tarea({ titulo: 'Sin dueño', proyecto: 'Energym', becario: null, estado: 'Inbox' }),
      tarea({ titulo: 'Otra', proyecto: 'Proyecto nuevo', becario: 'cto', estado: 'Inbox' }),
    ],
  });
  assert.equal(oficina.guardable, true);
  assert.deepEqual(oficina.proyectos.map((p) => p.nombre), ['Energym', 'Nexo', 'Proyecto nuevo']);
  const [energym, nexo, nuevo] = oficina.proyectos;
  assert.deepEqual(energym.puestos.map((p) => [p.becario, p.estado, p.asignado]), [['cto', 'libre', true], ['delivery', 'bloqueado', false]]);
  assert.equal(energym.puestos[1].actual.bloqueo, 'Falta la clave de Stripe');
  assert.deepEqual(energym.sinBecario.map((t) => t.titulo), ['Sin dueño']);
  assert.deepEqual(nexo.equipo, ['frontend', 'qa-tecnico'], 'se ignoran becarios que no existen');
  assert.equal(nuevo.id, null, 'un proyecto que solo está en las tareas no se puede editar');
});
