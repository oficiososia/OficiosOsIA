// Middleware y funciones de login/logout: quién entra y qué rutas siguen públicas.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import login from '../api/login.js';
import logout from '../api/logout.js';
import oficina from '../api/oficina.js';
import middleware, { config } from '../middleware.js';
import { cookieSesion, firmar } from '../lib/sesion.js';

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
