import assert from 'node:assert/strict';
import { test } from 'node:test';
import { columnaDe, COLUMNAS, construirTablero } from '../lib/tablero.js';

const tarea = (datos) => ({ id: datos.titulo, url: 'https://app.notion.com/p/x', proyecto: 'Energym', becario: null, fase: null, estado: 'Por hacer', prioridad: null, bloqueo: '', editada: null, ...datos });

test('las columnas siguen el flujo de los becarios, con «Sin empezar» delante y «Cerrada» al final', () => {
  assert.deepEqual(COLUMNAS.map((c) => c.id), ['sin-empezar', 'Preparación', 'Desarrollo y unitarias', 'Pruebas', 'Producción', 'Despliegue DEMO', 'QA DEMO', 'PR y revisión', 'Despliegue PROD', 'QA PROD', 'Cerrada']);
  const de = (dep) => COLUMNAS.filter((c) => c.departamentos.includes(dep)).map((c) => c.id);
  assert.deepEqual(de('qa'), ['sin-empezar', 'Preparación', 'Pruebas', 'PR y revisión', 'Cerrada']);
  assert.deepEqual(de('marketing'), ['sin-empezar', 'Preparación', 'Producción', 'PR y revisión', 'Cerrada']);
  assert.ok(!de('desarrollo').includes('Pruebas'));
});

test('cada tarjeta dice de qué departamento es, según quién la tiene', () => {
  const { tareas } = construirTablero([
    tarea({ titulo: 'a', becarios: ['qa-accesibilidad', 'qa-visual'], fase: 'Pruebas' }),
    tarea({ titulo: 'b', becarios: ['mk-seo'], fase: 'Producción' }),
    tarea({ titulo: 'c', becarios: ['frontend'] }),
    tarea({ titulo: 'd' }),
  ]);
  assert.deepEqual(tareas.map((t) => [t.titulo, t.departamento, t.columna]), [['a', 'qa', 'Pruebas'], ['b', 'marketing', 'Producción'], ['c', 'desarrollo', 'sin-empezar'], ['d', null, 'sin-empezar']]);
});

test('cada tarea va a la columna de su fase; sin fase, a «Sin empezar»; hecha, a «Cerrada»', () => {
  assert.equal(columnaDe(tarea({ titulo: 'a', fase: 'QA DEMO', estado: 'En progreso' })), 'QA DEMO');
  assert.equal(columnaDe(tarea({ titulo: 'b', estado: 'Inbox' })), 'sin-empezar');
  assert.equal(columnaDe(tarea({ titulo: 'c', fase: 'Fase inventada' })), 'sin-empezar');
  assert.equal(columnaDe(tarea({ titulo: 'd', fase: 'PR y revisión', estado: 'Hecha' })), 'Cerrada');
  assert.equal(columnaDe(tarea({ titulo: 'e', fase: 'Cerrada', estado: 'En progreso' })), 'Cerrada');
});

test('el tablero ordena las abiertas por estado y prioridad y limita las cerradas a las más recientes', () => {
  const cerradas = Array.from({ length: 40 }, (_, i) => tarea({ titulo: `hecha ${i}`, estado: 'Hecha', editada: `2026-10-${String((i % 28) + 1).padStart(2, '0')}T10:00:00Z` }));
  const { tareas } = construirTablero([
    tarea({ titulo: 'pendiente', fase: 'QA DEMO', estado: 'Por hacer', prioridad: 'Alta' }),
    tarea({ titulo: 'en marcha', fase: 'QA DEMO', estado: 'En progreso', prioridad: 'Baja' }),
    ...cerradas,
  ]);
  const qa = tareas.filter((t) => t.columna === 'QA DEMO').map((t) => t.titulo);
  assert.deepEqual(qa, ['en marcha', 'pendiente']);
  const cerradasEnTablero = tareas.filter((t) => t.columna === 'Cerrada');
  assert.equal(cerradasEnTablero.length, 30);
  assert.ok(cerradasEnTablero[0].editada >= cerradasEnTablero.at(-1).editada, 'las cerradas van de la más reciente a la más antigua');
});

test('cada tarjeta lleva el nombre de su sala aunque la tarea use otro texto de proyecto', async () => {
  const { mapaSalas } = await import('../lib/oficina.js');
  const salas = mapaSalas([{ id: 'p', url: null, nombre: 'Nexo', clave: 'Atletas, Nexo', equipo: [], repo: null, orden: 1 }]);
  const { tareas } = construirTablero([tarea({ titulo: 'Chat', proyecto: 'Atletas' }), tarea({ titulo: 'Suelta', proyecto: 'Otro' })], salas);
  assert.deepEqual(tareas.map((t) => t.sala), ['Nexo', 'Otro']);
});
