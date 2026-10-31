// Arranque del panel: pestañas, usuario y salida.
import { cargarBecarios, iniciarBecarios } from './becarios.js';
import { iniciarChat } from './chat.js';
import { cargarOficina, iniciarOficina } from './oficina.js';
import { iniciarProducto, mostrarSubpestana } from './producto.js';
import { cargarTablero, iniciarTablero } from './tablero.js';
import { api } from './util.js';

const VISTAS = ['oficina', 'producto', 'tareas', 'becarios'];
// La oficina y el tablero ocupan la pantalla entera sin scroll de página; producto y becarios sí se desplazan.
const FIJAS = new Set(['oficina', 'tareas']);

function mostrarVista() {
  // «#producto/chat»: la vista y, detrás de la barra, la subpestaña.
  const base = location.hash.slice(1).split('/')[0];
  const actual = VISTAS.includes(base) ? base : 'oficina';
  document.querySelectorAll('[data-vista]').forEach((v) => { v.hidden = v.dataset.vista !== actual; });
  document.body.classList.toggle('panel--fija', FIJAS.has(actual));
  if (actual === 'tareas') cargarTablero();
  if (actual === 'becarios') cargarBecarios();
  if (actual === 'producto') mostrarSubpestana();
  document.querySelectorAll('[data-pestana]').forEach((a) => {
    if (a.dataset.pestana === actual) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

document.addEventListener('oficina:datos', (e) => {
  document.querySelector('[data-usuario]').textContent = e.detail.usuario || '';
});

document.querySelector('[data-salir]').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  location.replace('/login');
});

window.addEventListener('hashchange', mostrarVista);
mostrarVista();
iniciarOficina();
iniciarProducto();
iniciarChat();
iniciarTablero();
iniciarBecarios();
cargarOficina();
