import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { aProyecto, aTarea, crearTarea, guardarEquipo, PROYECTOS_DS, TAREAS_DS, tareasAbiertas } from '../lib/notion.js';
import { normalizarTicket } from '../lib/tickets.js';

const fetchOriginal = globalThis.fetch;
let peticiones;

beforeEach(() => {
  process.env.NOTION_TOKEN = 'token-de-prueba';
  peticiones = [];
});
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

function simularNotion(respuestas) {
  globalThis.fetch = async (url, opciones) => {
    peticiones.push({ url, ...opciones, cuerpo: opciones.body ? JSON.parse(opciones.body) : null });
    return Response.json(respuestas.shift());
  };
}

const paginaTarea = {
  id: 't1',
  url: 'https://app.notion.com/p/t1',
  last_edited_time: '2026-10-30T10:00:00.000Z',
  properties: {
    'Título de la tarea': { title: [{ plain_text: 'Botones de ' }, { plain_text: 'acción' }] },
    'Proyecto relacionado': { rich_text: [{ plain_text: 'Casa Tomás' }] },
    Becario: { select: { name: 'cto' } },
    Fase: { select: { name: 'PR y revisión' } },
    Estado: { status: { name: 'En progreso' } },
    Prioridad: { select: null },
    Bloqueo: { rich_text: [] },
  },
};

test('aTarea y aProyecto leen las propiedades de Notion', () => {
  assert.deepEqual(aTarea(paginaTarea), {
    id: 't1', url: 'https://app.notion.com/p/t1', titulo: 'Botones de acción', proyecto: 'Casa Tomás', becario: 'cto',
    fase: 'PR y revisión', estado: 'En progreso', prioridad: null, bloqueo: '', editada: '2026-10-30T10:00:00.000Z',
  });
  const proyecto = aProyecto({ id: 'p1', url: 'u', properties: { Nombre: { title: [{ plain_text: 'Cristalería BV' }] }, 'Proyecto en tareas': { rich_text: [{ plain_text: 'Cristalería' }] }, Becarios: { multi_select: [{ name: 'cto' }] }, Repositorio: { url: null }, Orden: { number: 3 } } });
  assert.deepEqual(proyecto, { id: 'p1', url: 'u', nombre: 'Cristalería BV', clave: 'Cristalería', equipo: ['cto'], repo: null, orden: 3 });
});

test('tareasAbiertas pide las que no están hechas y recorre todas las páginas', async () => {
  simularNotion([
    { results: [paginaTarea], has_more: true, next_cursor: 'c2' },
    { results: [{ ...paginaTarea, id: 't2' }], has_more: false },
  ]);
  const tareas = await tareasAbiertas();
  assert.deepEqual(tareas.map((t) => t.id), ['t1', 't2']);
  assert.equal(peticiones[0].url, `https://api.notion.com/v1/data_sources/${TAREAS_DS}/query`);
  assert.equal(peticiones[0].headers['Notion-Version'], '2026-03-11');
  assert.deepEqual(peticiones[0].cuerpo.filter, { property: 'Estado', status: { does_not_equal: 'Hecha' } });
  assert.equal(peticiones[1].cuerpo.start_cursor, 'c2');
});

test('crearTarea crea la página en Oficios OS, en Inbox y fase Preparación', async () => {
  simularNotion([{ id: 'nueva', url: 'https://app.notion.com/p/nueva' }]);
  const ticket = { ...normalizarTicket({ titulo: 'Reservas', prioridad: 'Alta', tipo: 'Profunda', horas: 8, becarioInicial: 'cto' }), proyecto: 'Energym' };
  const creada = await crearTarea(ticket, '# cuerpo', 'Pablo');
  assert.deepEqual(creada, { id: 'nueva', url: 'https://app.notion.com/p/nueva', titulo: 'Reservas' });
  const { cuerpo } = peticiones[0];
  assert.deepEqual(cuerpo.parent, { type: 'data_source_id', data_source_id: TAREAS_DS });
  assert.equal(cuerpo.markdown, '# cuerpo');
  assert.deepEqual(cuerpo.properties.Estado, { status: { name: 'Inbox' } });
  assert.deepEqual(cuerpo.properties.Fase, { select: { name: 'Preparación' } });
  assert.deepEqual(cuerpo.properties['Proyecto relacionado'], { rich_text: [{ text: { content: 'Energym' } }] });
  assert.deepEqual(cuerpo.properties['Estimación (horas)'], { number: 8 });
});

test('un error de Notion se convierte en un mensaje legible', async () => {
  globalThis.fetch = async () => Response.json({ message: 'Could not find data_source' }, { status: 404 });
  await assert.rejects(tareasAbiertas(), /Notion respondió 404: Could not find data_source/);
});

test('guardarEquipo solo escribe en páginas de la base «Proyectos»', async () => {
  simularNotion([{ parent: { type: 'data_source_id', data_source_id: PROYECTOS_DS } }, { id: 'p1' }]);
  await guardarEquipo('p1', ['cto', 'frontend']);
  assert.equal(peticiones[1].method, 'PATCH');
  assert.deepEqual(peticiones[1].cuerpo.properties.Becarios, { multi_select: [{ name: 'cto' }, { name: 'frontend' }] });

  peticiones = [];
  simularNotion([{ parent: { type: 'data_source_id', data_source_id: TAREAS_DS } }]);
  await assert.rejects(guardarEquipo('t1', ['cto']), /no es un proyecto/);
  assert.equal(peticiones.length, 1, 'no llega a modificar la página');
});
