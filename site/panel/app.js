// Arranque del panel: pestañas, usuario y salida.
import { cargarOficina, iniciarOficina } from './oficina.js';
import { iniciarProducto } from './producto.js';
import { api } from './util.js';

const VISTAS = ['oficina', 'producto'];

function mostrarVista() {
  const actual = VISTAS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'oficina';
  document.querySelectorAll('[data-vista]').forEach((v) => { v.hidden = v.dataset.vista !== actual; });
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
cargarOficina();
