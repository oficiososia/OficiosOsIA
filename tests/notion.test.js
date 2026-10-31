import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
  aPeticion, aProyecto, aTarea, asignarTarea, crearPeticion, enviarPeticion, guardarEquipo, leerPeticiones, PETICIONES_DS, PROYECTOS_DS, TAREAS_DS, tareasAbiertas,
  tareasTablero, tituloPeticion,
} from '../lib/notion.js';

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
  const proyecto = aProyecto({ id: 'p1', url: 'u', properties: { Nombre: { title: [{ plain_text: 'Cristalería BV' }] }, 'Proyecto en tareas': { rich_text: [{ plain_text: 'Cristalería' }] }, Becarios: { multi_select: [{ name: 'cto' }] }, Repositorio: { url: null }, Orden: { number: 3 }, Logo: { url: 'https://x.test/logo.png' }, Color: { rich_text: [{ plain_text: '#7ec8e3' }] } } });
  assert.deepEqual(proyecto, { id: 'p1', url: 'u', nombre: 'Cristalería BV', clave: 'Cristalería', equipo: ['cto'], repo: null, orden: 3, logo: 'https://x.test/logo.png', color: '#7ec8e3' });
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

const paginaPeticion = (datos = {}) => ({
  id: 'pe1',
  url: 'https://app.notion.com/p/pe1',
  created_time: '2026-10-30T18:00:00.000Z',
  properties: {
    'Petición': { title: [{ plain_text: 'Reservar clases desde el móvil' }] },
    Proyecto: { rich_text: [{ plain_text: 'Energym' }] },
    Estado: { status: { name: 'Hecha' } },
    'Pedida por': { rich_text: [{ plain_text: 'Pablo' }] },
    Resumen: { rich_text: [{ plain_text: '2 tareas: Reservas; Recordatorio' }] },
    Tareas: { relation: [{ id: 't1' }, { id: 't2' }], has_more: false },
  },
  ...datos,
});

test('aPeticion lee la petición con su estado y cuántas tareas salieron de ella', () => {
  assert.deepEqual(aPeticion(paginaPeticion()), {
    id: 'pe1', url: 'https://app.notion.com/p/pe1', titulo: 'Reservar clases desde el móvil', proyecto: 'Energym', estado: 'Hecha',
    pedidaPor: 'Pablo', resumen: '2 tareas: Reservas; Recordatorio', tareas: 2, creada: '2026-10-30T18:00:00.000Z',
  });
});

test('el título de la petición es su primera línea, recortada', () => {
  assert.equal(tituloPeticion('  Reservas de clases\ncon recordatorio'), 'Reservas de clases');
  const larga = tituloPeticion('x'.repeat(200));
  assert.equal(larga.length, 90);
  assert.ok(larga.endsWith('…'));
});

test('leerPeticiones pide las más recientes de la base «Peticiones»', async () => {
  simularNotion([{ results: [paginaPeticion()], has_more: false }]);
  const lista = await leerPeticiones();
  assert.equal(lista[0].estado, 'Hecha');
  assert.equal(peticiones[0].url, `https://api.notion.com/v1/data_sources/${PETICIONES_DS}/query`);
  assert.deepEqual(peticiones[0].cuerpo.sorts, [{ timestamp: 'created_time', direction: 'descending' }]);
});

test('crearPeticion la deja Pendiente, con el texto completo en el cuerpo', async () => {
  simularNotion([paginaPeticion({ id: 'nueva' })]);
  await crearPeticion({ proyecto: 'Energym', textoPeticion: 'Reservas de clases\ncon recordatorio el día antes', usuario: 'Miguel' });
  const { cuerpo, method } = peticiones[0];
  assert.equal(method, 'POST');
  assert.deepEqual(cuerpo.parent, { type: 'data_source_id', data_source_id: PETICIONES_DS });
  assert.deepEqual(cuerpo.properties['Petición'], { title: [{ text: { content: 'Reservas de clases' } }] });
  assert.deepEqual(cuerpo.properties.Proyecto, { rich_text: [{ text: { content: 'Energym' } }] });
  assert.deepEqual(cuerpo.properties['Pedida por'], { rich_text: [{ text: { content: 'Miguel' } }] });
  assert.deepEqual(cuerpo.properties.Estado, { status: { name: 'Pendiente' } });
  assert.equal(cuerpo.markdown, 'Reservas de clases\ncon recordatorio el día antes');
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

test('una petición guardada para más tarde se crea en «Guardada»', async () => {
  simularNotion([paginaPeticion({ id: 'guardada' })]);
  await crearPeticion({ proyecto: 'JPR', textoPeticion: 'Idea para más adelante', usuario: 'Pablo', guardar: true });
  assert.deepEqual(peticiones[0].cuerpo.properties.Estado, { status: { name: 'Guardada' } });
});

test('enviarPeticion pasa una guardada a «Pendiente» y no toca las demás', async () => {
  const guardada = { parent: { type: 'data_source_id', data_source_id: PETICIONES_DS }, properties: { Estado: { status: { name: 'Guardada' } } } };
  simularNotion([guardada, { id: 'pe1' }]);
  await enviarPeticion('pe1');
  assert.equal(peticiones[1].method, 'PATCH');
  assert.deepEqual(peticiones[1].cuerpo.properties.Estado, { status: { name: 'Pendiente' } });

  peticiones = [];
  simularNotion([{ ...guardada, properties: { Estado: { status: { name: 'Hecha' } } } }]);
  await assert.rejects(enviarPeticion('pe1'), /ya no está guardada/);
  peticiones = [];
  simularNotion([{ ...guardada, parent: { type: 'data_source_id', data_source_id: TAREAS_DS } }]);
  await assert.rejects(enviarPeticion('t1'), /no es una petición/);
  assert.equal(peticiones.length, 1, 'no llega a modificar nada');
});

test('tareasTablero pide las abiertas y las tocadas en el último mes', async () => {
  simularNotion([{ results: [paginaTarea], has_more: false }]);
  await tareasTablero();
  assert.deepEqual(peticiones[0].cuerpo.filter, {
    or: [
      { property: 'Estado', status: { does_not_equal: 'Hecha' } },
      { timestamp: 'last_edited_time', last_edited_time: { past_month: {} } },
    ],
  });
});

test('asignarTarea pone el becario, pasa Inbox a «Por hacer» y solo toca tareas de OficiosOS', async () => {
  const tarea = (estado) => ({ parent: { type: 'data_source_id', data_source_id: TAREAS_DS }, properties: { Estado: { status: { name: estado } } } });
  simularNotion([tarea('Inbox'), { id: 't1' }]);
  await asignarTarea('t1', 'frontend');
  assert.deepEqual(peticiones[1].cuerpo.properties, { Becario: { select: { name: 'frontend' } }, Estado: { status: { name: 'Por hacer' } } });

  peticiones = [];
  simularNotion([tarea('Por hacer'), { id: 't1' }]);
  await asignarTarea('t1', null);
  assert.deepEqual(peticiones[1].cuerpo.properties, { Becario: { select: null } }, 'quitar el becario no cambia el estado');

  peticiones = [];
  simularNotion([{ ...tarea('Inbox'), parent: { type: 'data_source_id', data_source_id: PROYECTOS_DS } }]);
  await assert.rejects(asignarTarea('p1', 'cto'), /no es una tarea/);
  assert.equal(peticiones.length, 1, 'no llega a modificar la página');
});
