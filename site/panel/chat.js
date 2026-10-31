// Chat con el equipo de producto (pestaña «Equipo de producto»). Miguel y Pablo preguntan
// cómo van las tareas; el equipo contesta cuando se ejecuta /producto en Claude Code.
import { sprite } from './sprites.js';
import { api, enlace, escapar } from './util.js';

const ROLES = { CTO: 'cto', PM: 'pm', PO: 'po' };
const NOMBRES = { CTO: 'CTO', PM: 'Project Manager', PO: 'Product Owner' };

const lista = document.querySelector('[data-chat]');
const form = document.querySelector('[data-form-chat]');
const selector = form.elements.proyecto;
const estado = document.querySelector('[data-chat-estado]');
const avisos = document.querySelector('[data-avisos-chat]');
const error = document.querySelector('[data-error-chat]');

let mensajes = [];
// Títulos de las tareas abiertas (vienen con la oficina), para enlazar las que cita el equipo.
let titulos = new Map();

const hora = (iso) => (iso ? new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const urlTarea = (id) => `https://app.notion.com/p/${id.replace(/-/g, '')}`;

function htmlMensaje(m) {
  const rol = ROLES[m.autor?.toUpperCase()];
  const quien = m.deEquipo
    ? `<span class="mensaje__autor">${sprite(rol || 'cto')}${escapar(NOMBRES[m.autor?.toUpperCase()] || m.autor || 'Equipo')}</span>`
    : `<span class="mensaje__autor">${escapar(m.autor || 'Tú')}</span>`;
  const meta = [m.proyecto && `<span class="etiqueta">${escapar(m.proyecto)}</span>`, `<time datetime="${escapar(m.creado || '')}">${escapar(hora(m.creado))}</time>`].filter(Boolean).join('');
  const tareas = m.tareas.length
    ? `<ul class="mensaje__tareas">${m.tareas.map((id) => `<li><a href="${enlace(urlTarea(id))}" target="_blank" rel="noopener">${escapar(titulos.get(id.replace(/-/g, '')) || 'Ver tarea en Notion')}</a></li>`).join('')}</ul>`
    : '';
  const espera = !m.deEquipo && m.estado === 'Pendiente' ? '<span class="mensaje__espera">Esperando respuesta del equipo</span>' : '';
  return `<li class="mensaje ${m.deEquipo ? 'mensaje--equipo' : 'mensaje--persona'}">
    <div class="mensaje__cabeza">${quien}${meta}</div>
    <p class="mensaje__texto">${escapar(m.texto)}</p>${tareas}${espera}</li>`;
}

function pintar() {
  const abajo = lista.scrollHeight - lista.scrollTop - lista.clientHeight < 40;
  lista.innerHTML = mensajes.length
    ? mensajes.map(htmlMensaje).join('')
    : '<li class="cargando chat__vacio">Todavía no hay mensajes. Pregunta, por ejemplo, qué falta para cerrar una tarea.</li>';
  const pendientes = mensajes.filter((m) => !m.deEquipo && m.estado === 'Pendiente').length;
  estado.textContent = pendientes ? `${pendientes} sin contestar · ejecuta /producto en Claude Code` : '';
  // Si se estaba al final (o es la primera carga), se baja al último mensaje.
  if (abajo || lista.dataset.cargado !== 'si') lista.scrollTop = lista.scrollHeight;
  lista.dataset.cargado = 'si';
}

// Al abrir la pestaña: la lista estaba oculta y no se pudo bajar al último mensaje.
export function bajarChat() {
  lista.scrollTop = lista.scrollHeight;
}

export async function cargarChat() {
  try {
    ({ mensajes } = await api('/api/chat'));
    avisos.innerHTML = '';
    pintar();
  } catch (err) {
    avisos.innerHTML = `<div class="aviso"><strong>No se puede leer el chat.</strong> ${escapar(err.message)}</div>`;
  } finally {
    lista.setAttribute('aria-busy', 'false');
  }
}

async function enviar(e) {
  e.preventDefault();
  const texto = form.elements.texto.value.trim();
  if (!texto) return;
  const boton = form.querySelector('button[type="submit"]');
  boton.disabled = true;
  error.hidden = true;
  try {
    const { mensaje } = await api('/api/chat', { method: 'POST', body: { texto, proyecto: selector.value } });
    form.elements.texto.value = '';
    mensajes.push(mensaje);
    lista.dataset.cargado = 'no';
    pintar();
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
  } finally {
    boton.disabled = false;
    form.elements.texto.focus();
  }
}

function actualizarDatos(oficina) {
  const anterior = selector.value;
  selector.innerHTML = '<option value="">General</option>'
    + oficina.proyectos.map((p) => `<option value="${escapar(p.clave)}"${p.clave === anterior ? ' selected' : ''}>${escapar(p.nombre)}</option>`).join('');
  titulos = new Map(oficina.proyectos.flatMap((p) => [...p.sinBecario, ...p.puestos.flatMap((pu) => pu.tareas)]).map((t) => [String(t.id).replace(/-/g, ''), t.titulo]));
}

export function iniciarChat() {
  form.addEventListener('submit', enviar);
  // Ctrl/Cmd + Intro envía; Intro solo hace salto de línea.
  form.elements.texto.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) form.requestSubmit();
  });
  // La oficina se refresca cada minuto: el chat se refresca con ella.
  document.addEventListener('oficina:datos', (e) => {
    actualizarDatos(e.detail);
    cargarChat();
  });
}
