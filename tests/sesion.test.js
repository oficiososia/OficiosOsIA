import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cookieSesion, DURACION_S, firmar, leerCookie, verificar } from '../lib/sesion.js';
import { comprobarCredenciales, leerUsuarios } from '../lib/usuarios.js';

const SECRETO = 'secreto-de-prueba';

test('una sesión firmada se verifica y devuelve el usuario', async () => {
  assert.equal(await verificar(await firmar('Pablo', SECRETO), SECRETO), 'Pablo');
});

test('una sesión caduca a los 7 días', async () => {
  const ahora = Date.parse('2026-10-30T10:00:00Z');
  const token = await firmar('Miguel', SECRETO, ahora);
  assert.equal(await verificar(token, SECRETO, ahora + (DURACION_S - 60) * 1000), 'Miguel');
  assert.equal(await verificar(token, SECRETO, ahora + (DURACION_S + 1) * 1000), null);
});

test('no vale una sesión manipulada, con otro secreto o sin secreto', async () => {
  const token = await firmar('Pablo', SECRETO);
  const [, firma] = token.split('.');
  const falsa = `${Buffer.from(JSON.stringify({ u: 'Miguel', exp: 9999999999 })).toString('base64url')}.${firma}`;
  assert.equal(await verificar(falsa, SECRETO), null);
  assert.equal(await verificar(token, 'otro-secreto'), null);
  assert.equal(await verificar(token, undefined), null);
  assert.equal(await verificar('basura', SECRETO), null);
  assert.equal(await verificar(`${token}.extra`, SECRETO), null);
});

test('la cookie es HttpOnly, Secure y SameSite=Lax y se lee de la cabecera', () => {
  const cookie = cookieSesion('abc.def');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  const request = new Request('https://x.test/', { headers: { cookie: 'otra=1; panel_sesion=abc.def' } });
  assert.equal(leerCookie(request, 'panel_sesion'), 'abc.def');
});

test('PANEL_USUARIOS admite varios usuarios y no distingue mayúsculas en el nombre', () => {
  const valor = 'Miguel:clave-de-prueba, Pablo:clave-de-prueba';
  assert.deepEqual([...leerUsuarios(valor).keys()], ['miguel', 'pablo']);
  assert.equal(comprobarCredenciales('miguel', 'clave-de-prueba', valor), 'Miguel');
  assert.equal(comprobarCredenciales(' PABLO ', 'clave-de-prueba', valor), 'Pablo');
});

test('se rechazan contraseñas incorrectas, usuarios desconocidos y la configuración vacía', () => {
  const valor = 'Miguel:clave-de-prueba,Pablo:clave-de-prueba';
  assert.equal(comprobarCredenciales('Pablo', 'clave-de-prueb', valor), null);
  assert.equal(comprobarCredenciales('Ana', 'clave-de-prueba', valor), null);
  assert.equal(comprobarCredenciales('Pablo', 'clave-de-prueba', ''), null);
  assert.equal(comprobarCredenciales('Pablo', 'clave-de-prueba', undefined), null);
});

test('una contraseña con dos puntos se respeta entera', () => {
  assert.equal(comprobarCredenciales('Pablo', 'a:b', 'Pablo:a:b'), 'Pablo');
});
