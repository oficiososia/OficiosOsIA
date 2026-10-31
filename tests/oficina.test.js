import assert from 'node:assert/strict';
import { test } from 'node:test';
import { combinarBecarios } from '../lib/becarios.js';
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

test('una sala puede recoger varios textos de proyecto y la fila duplicada no crea otra sala', () => {
  const oficina = construirOficina({
    proyectosNotion: [
      { id: 'p-nexo', url: null, nombre: 'Nexo', clave: 'Atletas, Nexo', equipo: ['frontend'], repo: null, orden: 3, logo: null, color: '#2ec4b6' },
      { id: 'p-viejo', url: null, nombre: 'Nexo', clave: 'Nexo', equipo: [], repo: null, orden: 3, logo: null, color: null },
    ],
    tareas: [
      tarea({ titulo: 'Chat', proyecto: 'Atletas', becario: 'frontend', estado: 'En progreso' }),
      tarea({ titulo: 'Alta', proyecto: 'Nexo', becario: null, estado: 'Por hacer' }),
    ],
  });
  assert.deepEqual(oficina.proyectos.map((p) => p.id), ['p-nexo']);
  const [nexo] = oficina.proyectos;
  assert.equal(nexo.clave, 'Atletas', 'las tareas nuevas usan la primera clave');
  assert.deepEqual(nexo.claves, ['Atletas', 'Nexo']);
  assert.equal(nexo.abiertas, 2);
  assert.equal(nexo.color, '#2ec4b6');
});

test('sin base «Proyectos», Atletas y Nexo son la misma sala', () => {
  const oficina = construirOficina({ proyectosNotion: null, tareas: [tarea({ titulo: 'Chat', proyecto: 'Atletas', estado: 'Por hacer' })] });
  assert.equal(oficina.proyectos.filter((p) => p.nombre === 'Nexo').length, 1);
  assert.equal(oficina.proyectos.find((p) => p.nombre === 'Nexo').abiertas, 1);
  assert.ok(!oficina.proyectos.some((p) => p.nombre === 'Atletas'));
});

test('un becario pausado no tiene mesa, salvo donde aún tiene tareas abiertas', () => {
  const becarios = combinarBecarios([{ id: 'frontend', pausado: true, instrucciones: 'secretas' }, { id: 'cto', nombre: 'Jefa', avatar: { peinado: 'largo' } }]);
  const proyectosNotion = [
    { id: 'p1', nombre: 'Energym', clave: 'Energym', equipo: ['cto', 'frontend'], orden: 1 },
    { id: 'p2', nombre: 'JPR', clave: 'JPR', equipo: ['cto', 'frontend'], orden: 2 },
  ];
  const oficina = construirOficina({ proyectosNotion, becarios, tareas: [tarea({ titulo: 'Menú', proyecto: 'JPR', becario: 'frontend', estado: 'En progreso' })] });
  const [energym, jpr] = oficina.proyectos;
  assert.deepEqual(energym.puestos.map((p) => p.becario), ['cto'], 'sin tareas, el pausado no sale');
  assert.deepEqual(energym.equipo, ['cto', 'frontend'], 'sigue en el equipo');
  assert.deepEqual(jpr.puestos.map((p) => [p.becario, p.pausado]), [['cto', false], ['frontend', true]]);
  assert.equal(oficina.becarios[0].nombre, 'Jefa');
  assert.equal(oficina.becarios[0].avatar.peinado, 'largo');
  assert.ok(oficina.becarios.every((b) => !('instrucciones' in b)), 'las instrucciones no van a la oficina');
});

test('una tarea con varios becarios sale en la mesa de cada uno, y no como «sin becario»', () => {
  const oficina = construirOficina({
    proyectosNotion: [{ id: 'p1', nombre: 'Energym', clave: 'Energym', equipo: ['cto', 'backend-datos', 'frontend'], orden: 1 }],
    tareas: [tarea({ titulo: 'Reservas', proyecto: 'Energym', becarios: ['backend-datos', 'frontend'], estado: 'En progreso', fase: 'Desarrollo y unitarias' })],
  });
  const [energym] = oficina.proyectos;
  const trabajando = energym.puestos.filter((p) => p.estado === 'trabajando').map((p) => p.becario).sort();
  assert.deepEqual(trabajando, ['backend-datos', 'frontend']);
  assert.equal(energym.sinBecario.length, 0);
  assert.equal(energym.abiertas, 1, 'cuenta una tarea, no dos');
  assert.deepEqual(energym.puestos.find((p) => p.becario === 'frontend').actual.becarios, ['backend-datos', 'frontend']);
});

test('cada sala tiene una habitación por departamento del equipo o con tareas', () => {
  const oficina = construirOficina({
    proyectosNotion: [{ id: 'p1', nombre: 'Energym', clave: 'Energym', equipo: ['cto', 'frontend', 'sec-lead', 'sec-pentest'], orden: 1 }],
    tareas: [
      tarea({ titulo: 'SEO', proyecto: 'Energym', becarios: ['mk-seo'], estado: 'En progreso', fase: 'Producción' }),
      tarea({ titulo: 'Correo que no llega', proyecto: 'Energym', becarios: ['it-comunicaciones'], estado: 'En espera', fase: 'Intervención' }),
      tarea({ titulo: 'Auditoría', proyecto: 'Energym', becarios: ['sec-lead'], estado: 'Por hacer', fase: 'Preparación' }),
    ],
  });
  const [energym] = oficina.proyectos;
  assert.deepEqual(energym.habitaciones.map((d) => [d.id, d.activo, d.conEntrada, d.abiertas, d.trabajando]), [
    ['desarrollo', true, true, 0, false],
    ['seguridad', true, true, 1, false],
    ['marketing', false, false, 1, true],
    ['soporte', false, false, 1, false],
  ], 'marketing y soporte no están en el equipo, pero salen porque tienen trabajo');
  assert.deepEqual(energym.puestos.map((p) => [p.becario, p.departamento]), [
    ['cto', 'desarrollo'], ['frontend', 'desarrollo'], ['sec-lead', 'seguridad'], ['sec-pentest', 'seguridad'], ['mk-seo', 'marketing'], ['it-comunicaciones', 'soporte'],
  ]);
  assert.equal(energym.puestos.find((p) => p.becario === 'sec-lead').actual.departamento, 'seguridad');
});

test('una sala sin equipo ni tareas no tiene habitaciones', () => {
  const oficina = construirOficina({ proyectosNotion: [{ id: 'p1', nombre: 'JPR', clave: 'JPR', equipo: [], orden: 1 }], tareas: [] });
  assert.deepEqual(oficina.proyectos[0].habitaciones, []);
});
