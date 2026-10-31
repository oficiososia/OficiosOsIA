// Middleware y funciones de login/logout: quién entra y qué rutas siguen públicas.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import login from '../api/login.js';
import logout from '../api/logout.js';
import oficina from '../api/oficina.js';
import peticiones from '../api/peticiones.js';
import asignar from '../api/asignar.js';
import becariosApi from '../api/becarios.js';
import middleware, { config } from '../middleware.js';
import { cookieSesion, firmar } from '../lib/sesion.js';
import { BECARIOS_DS, TAREAS_DS } from '../lib/notion.js';

beforeEach(() => {
  process.env.SESION_SECRETO = 'secreto-de-prueba';
  process.env.PANEL_USUARIOS = 'Miguel:clave-de-prueba,Pablo:clave-de-prueba';
  delete process.env.NOTION_TOKEN;
});

const protegida = (ruta) => config.matcher.some((p) => new RegExp(`^${p}$`).test(ruta));

test('el panel está protegido y /entrenos, /legal y el login siguen públicos', () => {
  for (const ruta of ['/', '/index.html', '/panel/app.js', '/panel/panel.css']) assert.ok(protegida(ruta), ruta);
  for (const ruta of ['/login', '/login.html', '/entrenos', '/legal', '/api/login', '/logo/oficiososia-icono-app.svg', '/styles.css']) {
    assert.ok(!protegida(ruta), ruta);
  }
});

test('sin sesión, el middleware manda al login y recuerda adónde ibas', async () => {
  const raiz = await middleware(new Request('https://panel.test/'));
  assert.equal(raiz.status, 302);
  assert.equal(raiz.headers.get('location'), 'https://panel.test/login');
  const panel = await middleware(new Request('https://panel.test/panel/app.js'));
  assert.equal(new URL(panel.headers.get('location')).searchParams.get('volver'), '/panel/app.js');
});

test('con sesión válida, el middleware deja pasar sin indexar ni cachear', async () => {
  const cookie = cookieSesion(await firmar('Pablo', process.env.SESION_SECRETO)).split(';')[0];
  const respuesta = await middleware(new Request('https://panel.test/', { headers: { cookie } }));
  assert.equal(respuesta.headers.get('x-middleware-next'), '1');
  assert.match(respuesta.headers.get('x-robots-tag') || '', /noindex/);
});

const pedirLogin = (cuerpo) =>
  login.fetch(new Request('https://panel.test/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }));

test('Miguel y Pablo entran con su contraseña y reciben la cookie de sesión', async () => {
  for (const usuario of ['Miguel', 'pablo']) {
    const respuesta = await pedirLogin({ usuario, contrasena: 'clave-de-prueba' });
    assert.equal(respuesta.status, 200);
    assert.match(respuesta.headers.get('set-cookie'), /^panel_sesion=/);
  }
});

test('una contraseña incorrecta no da sesión', async () => {
  const respuesta = await pedirLogin({ usuario: 'Pablo', contrasena: 'mal' });
  assert.equal(respuesta.status, 401);
  assert.equal(respuesta.headers.get('set-cookie'), null);
});

test('sin SESION_SECRETO el login se niega en vez de firmar con un secreto conocido', async () => {
  delete process.env.SESION_SECRETO;
  const respuesta = await pedirLogin({ usuario: 'Pablo', contrasena: 'clave-de-prueba' });
  assert.equal(respuesta.status, 503);
});

test('logout borra la cookie', async () => {
  const respuesta = await logout.fetch(new Request('https://panel.test/api/logout', { method: 'POST' }));
  assert.match(respuesta.headers.get('set-cookie'), /Max-Age=0/);
});

test('las funciones del panel exigen sesión', async () => {
  const respuesta = await oficina.fetch(new Request('https://panel.test/api/oficina'));
  assert.equal(respuesta.status, 401);
});

test('sin NOTION_TOKEN la oficina se abre vacía con un aviso', async () => {
  const cookie = cookieSesion(await firmar('Pablo', process.env.SESION_SECRETO)).split(';')[0];
  const respuesta = await oficina.fetch(new Request('https://panel.test/api/oficina', { headers: { cookie } }));
  assert.equal(respuesta.status, 200);
  const datos = await respuesta.json();
  assert.equal(datos.usuario, 'Pablo');
  assert.match(datos.avisos[0], /NOTION_TOKEN/);
  assert.ok(datos.proyectos.some((p) => p.nombre === 'Energym'));
});

test('/api/peticiones exige sesión, valida y guarda la petición a nombre de quien la pide', async () => {
  const sinSesion = await peticiones.fetch(new Request('https://panel.test/api/peticiones'));
  assert.equal(sinSesion.status, 401);

  const cookie = cookieSesion(await firmar('Miguel', process.env.SESION_SECRETO)).split(';')[0];
  const pedir = (cuerpo) =>
    peticiones.fetch(new Request('https://panel.test/api/peticiones', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }));
  assert.equal((await pedir({ proyecto: { clave: 'Energym' }, peticion: '   ' })).status, 400);
  assert.equal((await pedir({ peticion: 'Algo' })).status, 400);

  process.env.NOTION_TOKEN = 'token-de-prueba';
  const fetchOriginal = globalThis.fetch;
  let enviado;
  globalThis.fetch = async (_url, opciones) => {
    enviado = JSON.parse(opciones.body);
    return Response.json({ id: 'nueva', url: 'https://app.notion.com/p/nueva', properties: {} });
  };
  try {
    const respuesta = await pedir({ proyecto: { nombre: 'Energym', clave: 'Energym' }, peticion: 'Reservas de clases' });
    assert.equal(respuesta.status, 201);
    assert.deepEqual(enviado.properties['Pedida por'], { rich_text: [{ text: { content: 'Miguel' } }] });
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test('/api/asignar exige sesión, rechaza tareas que no valen y siempre se las pasa al CTO', async () => {
  const sinSesion = await asignar.fetch(new Request('https://panel.test/api/asignar', { method: 'PUT' }));
  assert.equal(sinSesion.status, 401);
  const cookie = cookieSesion(await firmar('Pablo', process.env.SESION_SECRETO)).split(';')[0];
  const pedir = (cuerpo) =>
    asignar.fetch(new Request('https://panel.test/api/asignar', { method: 'PUT', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }));
  assert.equal((await pedir({ tareas: [] })).status, 400);
  assert.equal((await pedir({ tareas: ['no-es-un-id'] })).status, 400);
  assert.equal((await pedir({ cambios: [{ tareaId: '40a3221d-8eb7-81c3-bb5d-dd1359a188ee', becario: 'frontend' }] })).status, 400, 'ya no se elige becario');

  process.env.NOTION_TOKEN = 'token-de-prueba';
  const fetchOriginal = globalThis.fetch;
  const enviados = [];
  globalThis.fetch = async (url, opciones) => {
    if (opciones.method === 'PATCH') {
      enviados.push(JSON.parse(opciones.body).properties);
      return Response.json({ id: 'ok' });
    }
    if (url.endsWith('/query')) return Response.json({ results: [], has_more: false });
    return Response.json({ parent: { type: 'data_source_id', data_source_id: TAREAS_DS }, properties: { Estado: { status: { name: 'Inbox' } }, Becario: { select: null } } });
  };
  try {
    const id = '40a3221d-8eb7-81c3-bb5d-dd1359a188ee';
    const respuesta = await pedir({ tareas: [id, id], becario: 'frontend' });
    assert.equal(respuesta.status, 200);
    assert.deepEqual((await respuesta.json()).hechas, [id]);
    assert.equal(enviados.length, 1, 'una tarea repetida se pasa una sola vez');
    assert.deepEqual(enviados[0].Becario, { select: { name: 'cto' } }, 'empieza el CTO aunque pidan otro becario');
    assert.deepEqual(enviados[0].Fase, { select: { name: 'Preparación' } });
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test('/api/asignar no pasa nada si el CTO está pausado', async () => {
  process.env.NOTION_TOKEN = 'token-de-prueba';
  const cookie = cookieSesion(await firmar('Pablo', process.env.SESION_SECRETO)).split(';')[0];
  const fetchOriginal = globalThis.fetch;
  const llamadas = [];
  globalThis.fetch = async (url, opciones) => {
    llamadas.push(`${opciones.method} ${url}`);
    return Response.json({ results: [{ id: 'b1', properties: { Id: { select: { name: 'cto' } }, Pausado: { checkbox: true } } }], has_more: false });
  };
  try {
    const respuesta = await asignar.fetch(new Request('https://panel.test/api/asignar', {
      method: 'PUT', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ tareas: ['40a3221d-8eb7-81c3-bb5d-dd1359a188ee'] }),
    }));
    assert.equal(respuesta.status, 409);
    assert.match((await respuesta.json()).error, /CTO está pausado/);
    assert.deepEqual(llamadas, [`POST https://api.notion.com/v1/data_sources/${BECARIOS_DS}/query`], 'no toca ninguna tarea');
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test('/api/becarios exige sesión, valida la ficha y la guarda', async () => {
  const sinSesion = await becariosApi.fetch(new Request('https://panel.test/api/becarios'));
  assert.equal(sinSesion.status, 401);
  process.env.NOTION_TOKEN = 'token-de-prueba';
  const cookie = cookieSesion(await firmar('Miguel', process.env.SESION_SECRETO)).split(';')[0];
  const pedir = (cuerpo) => becariosApi.fetch(new Request('https://panel.test/api/becarios', { method: 'PUT', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }));
  const ficha = { id: 'qa-tecnico', nombre: 'Lupa', papel: 'Regresión', pausado: true, instrucciones: '', avatar: { peinado: 'largo', accesorios: ['gafas'], piel: '#e0ac69', pelo: '#121212', ropa: '#c9473f', detalle: '#ffb000' } };
  assert.equal((await pedir({ ...ficha, id: 'jefe' })).status, 400);
  assert.equal((await pedir({ ...ficha, avatar: { ...ficha.avatar, piel: 'rosa' } })).status, 400);

  const fetchOriginal = globalThis.fetch;
  let guardado = null;
  globalThis.fetch = async (url, opciones) => {
    if (url.endsWith('/query')) return Response.json({ results: [], has_more: false });
    guardado = JSON.parse(opciones.body);
    return Response.json({ id: 'nuevo', url: 'https://app.notion.com/p/nuevo', properties: { ...guardado.properties, Nombre: { title: [{ plain_text: 'Lupa' }] }, Id: { select: { name: 'qa-tecnico' } }, Pausado: { checkbox: true } } });
  };
  try {
    const respuesta = await pedir(ficha);
    assert.equal(respuesta.status, 200);
    const { becario } = await respuesta.json();
    assert.equal(becario.nombre, 'Lupa');
    assert.equal(becario.pausado, true);
    assert.equal(guardado.parent.data_source_id, BECARIOS_DS);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
