// Equipo de producto: el panel guarda la petición en Notion y la lista con su estado.
// La PO, el PM y el CTO la procesan en Claude Code con el skill /producto.
import { sprite } from './sprites.js';
import { api, enlace, escapar } from './util.js';

const ROLES = [
  { id: 'po', nombre: 'Product Owner', papel: 'Historias y criterios de aceptación' },
  { id: 'pm', nombre: 'Project Manager', papel: 'Prioridad, tiempos, orden y duplicados' },
  { id: 'cto', nombre: 'CTO', papel: 'Plan técnico y qué becario empieza' },
];
const CLASE_ESTADO = { Pendiente: 'pendiente', 'En curso': 'en-curso', 'Con dudas': 'dudas', Hecha: 'hecha', Descartada: 'descartada' };

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
    ${p.resumen ? `<p class="peticion__resumen">${escapar(p.resumen)}</p>` : ''}</li>`;
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
  errorPeticion.hidden = true;
  enviada.hidden = true;
  const proyecto = proyectos[Number(selector.value)];
  const peticion = form.elements.peticion.value.trim();
  if (!proyecto || !peticion) {
    errorPeticion.textContent = !proyecto ? 'Todavía no hay proyectos: espera a que cargue la oficina.' : 'Escribe qué necesitas.';
    errorPeticion.hidden = false;
    return;
  }
  const boton = form.querySelector('button[type="submit"]');
  boton.disabled = true;
  try {
    await api('/api/peticiones', { method: 'POST', body: { proyecto: { nombre: proyecto.nombre, clave: proyecto.clave }, peticion } });
    form.elements.peticion.value = '';
    enviada.textContent = `Enviada al equipo de producto de ${proyecto.nombre}. Ejecuta /producto en Claude Code para que la conviertan en tareas.`;
    enviada.hidden = false;
    await cargarPeticiones();
  } catch (error) {
    errorPeticion.textContent = error.message;
    errorPeticion.hidden = false;
  } finally {
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
  // La oficina se refresca cada minuto; las peticiones se refrescan con ella.
  document.addEventListener('oficina:datos', (e) => {
    actualizarProyectos(e.detail.proyectos);
    cargarPeticiones();
  });
}
