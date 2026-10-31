// Equipo de producto: el panel guarda la petición en Notion y la lista con su estado.
// La PO, el PM y el CTO la procesan en Claude Code con el skill /producto.
import { sprite } from './sprites.js';
import { api, enlace, escapar } from './util.js';

const ROLES = [
  { id: 'po', nombre: 'Product Owner', papel: 'Historias y criterios de aceptación' },
  { id: 'pm', nombre: 'Project Manager', papel: 'Prioridad, tiempos, orden y duplicados' },
  { id: 'cto', nombre: 'CTO', papel: 'Plan técnico y qué becario empieza' },
];
const CLASE_ESTADO = { Guardada: 'guardada', Pendiente: 'pendiente', 'En curso': 'en-curso', 'Con dudas': 'dudas', Hecha: 'hecha', Descartada: 'descartada' };

const form = document.querySelector('[data-peticion]');
const selector = form.elements.proyecto;
const errorPeticion = document.querySelector('[data-error-peticion]');
const enviada = document.querySelector('[data-enviada]');
const lista = document.querySelector('[data-peticiones]');
const avisos = document.querySelector('[data-avisos-peticiones]');

let proyectos = [];

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

function htmlPeticion(p) {
  const titulo = enlace(p.url) ? `<a href="${enlace(p.url)}" target="_blank" rel="noopener">${escapar(p.titulo)}</a>` : escapar(p.titulo);
  const meta = [p.proyecto, p.pedidaPor && `pedida por ${p.pedidaPor}`, fecha(p.creada)].filter(Boolean).map(escapar);
  if (p.tareas) meta.push(`${p.tareas} ${p.tareas === 1 ? 'tarea creada' : 'tareas creadas'}`);
  return `<li class="peticion">
    <div class="peticion__cabeza"><span class="peticion__titulo">${titulo}</span>
    <span class="estado estado--${CLASE_ESTADO[p.estado] || 'pendiente'}">${escapar(p.estado || 'Pendiente')}</span></div>
    <span class="peticion__meta">${meta.join(' · ')}</span>
    ${p.resumen ? `<p class="peticion__resumen">${escapar(p.resumen)}</p>` : ''}
    ${p.estado === 'Guardada' ? `<button type="button" class="boton-texto peticion__enviar" data-enviar="${escapar(p.id)}">Enviar al equipo →</button>` : ''}</li>`;
}

export async function cargarPeticiones() {
  try {
    const { peticiones } = await api('/api/peticiones');
    avisos.innerHTML = '';
    lista.innerHTML = peticiones.length ? peticiones.map(htmlPeticion).join('') : '<li class="cargando">Todavía no hay peticiones.</li>';
    document.dispatchEvent(new CustomEvent('peticiones:datos', {
      detail: {
        pendientes: peticiones.filter((p) => p.estado === 'Pendiente').length,
        enCurso: peticiones.filter((p) => p.estado === 'En curso').length,
      },
    }));
  } catch (error) {
    avisos.innerHTML = `<div class="aviso"><strong>No se pueden leer las peticiones.</strong> ${escapar(error.message)}</div>`;
    lista.innerHTML = '';
  } finally {
    lista.setAttribute('aria-busy', 'false');
  }
}

async function enviar(e) {
  e.preventDefault();
  // Dos botones: «Guardar para más tarde» la deja en Guardada; «Enviar al equipo», en Pendiente.
  const guardar = e.submitter?.value === 'guardar';
  errorPeticion.hidden = true;
  enviada.hidden = true;
  const proyecto = proyectos[Number(selector.value)];
  const peticion = form.elements.peticion.value.trim();
  if (!proyecto || !peticion) {
    errorPeticion.textContent = !proyecto ? 'Todavía no hay proyectos: espera a que cargue la oficina.' : 'Escribe qué necesitas.';
    errorPeticion.hidden = false;
    return;
  }
  const botones = form.querySelectorAll('button[type="submit"]');
  botones.forEach((b) => { b.disabled = true; });
  try {
    await api('/api/peticiones', { method: 'POST', body: { proyecto: { nombre: proyecto.nombre, clave: proyecto.clave }, peticion, guardar } });
    form.elements.peticion.value = '';
    enviada.textContent = guardar
      ? `Guardada para más tarde en ${proyecto.nombre}. Nadie la tocará hasta que pulses «Enviar al equipo» en la lista.`
      : `Enviada al equipo de producto de ${proyecto.nombre}. Ejecuta /producto en Claude Code para que la conviertan en tareas.`;
    enviada.hidden = false;
    await cargarPeticiones();
  } catch (error) {
    errorPeticion.textContent = error.message;
    errorPeticion.hidden = false;
  } finally {
    botones.forEach((b) => { b.disabled = false; });
  }
}

async function enviarGuardada(boton) {
  boton.disabled = true;
  try {
    await api('/api/peticiones', { method: 'PATCH', body: { id: boton.dataset.enviar } });
    await cargarPeticiones();
  } catch (error) {
    avisos.innerHTML = `<div class="aviso"><strong>No se ha podido enviar.</strong> ${escapar(error.message)}</div>`;
    boton.disabled = false;
  }
}

function actualizarProyectos(nuevos) {
  const anterior = selector.value ? proyectos[Number(selector.value)]?.clave : null;
  proyectos = nuevos;
  selector.innerHTML = proyectos.map((p, i) => `<option value="${i}"${p.clave === anterior ? ' selected' : ''}>${escapar(p.nombre)}</option>`).join('');
}

export function iniciarProducto() {
  document.querySelector('[data-roles]').innerHTML = ROLES.map((r) => `<li class="rol">
    <div class="rol__cabeza">${sprite(r.id)}<div><p class="rol__nombre">${r.nombre}</p><p class="rol__papel">${r.papel}</p></div></div></li>`).join('');
  form.addEventListener('submit', enviar);
  lista.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-enviar]');
    if (boton) enviarGuardada(boton);
  });
  // La oficina se refresca cada minuto; las peticiones se refrescan con ella.
  document.addEventListener('oficina:datos', (e) => {
    actualizarProyectos(e.detail.proyectos);
    cargarPeticiones();
  });
}
