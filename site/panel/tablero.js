// Tareas: el kanban de OficiosOS dentro del panel, con una columna por fase del flujo de los becarios.
import { sprite } from './sprites.js';
import { temaDe } from './temas.js';
import { api, enlace, escapar, hora } from './util.js';

const vista = document.querySelector('[data-vista="tareas"]');
const tablero = document.querySelector('[data-tablero]');
const filtroProyecto = document.querySelector('[data-filtro-proyecto]');
const filtroBecario = document.querySelector('[data-filtro-becario]');
const filtroDepartamento = document.querySelector('[data-filtro-departamento]');
const avisos = document.querySelector('[data-avisos-tablero]');
const actualizado = document.querySelector('[data-actualizado-tablero]');

let datos = null;
let nombres = {};
let cargando = false;

const slug = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');

function opciones(select, valores, etiqueta = (v) => v) {
  const actual = select.value;
  select.innerHTML = `<option value="">Todos</option>${valores.map((v) => `<option value="${escapar(v)}"${v === actual ? ' selected' : ''}>${escapar(etiqueta(v))}</option>`).join('')}`;
}

function tarjeta(t) {
  const titulo = enlace(t.url) ? `<a href="${enlace(t.url)}" target="_blank" rel="noopener">${escapar(t.titulo)}</a>` : escapar(t.titulo);
  const etiquetas = [];
  if (t.estado && t.columna !== 'Cerrada') {
    const clase = t.estado === 'En progreso' ? ' etiqueta--trabajando' : t.estado === 'En espera' ? ' etiqueta--bloqueado' : '';
    etiquetas.push(`<span class="etiqueta${clase}">${escapar(t.estado)}</span>`);
  }
  if (t.prioridad) etiquetas.push(`<span class="etiqueta">Prioridad ${escapar(t.prioridad.toLowerCase())}</span>`);
  if (enlace(t.pr)) etiquetas.push(`<a class="etiqueta etiqueta--enlace" href="${enlace(t.pr)}" target="_blank" rel="noopener">PR ↗</a>`);
  // Una tarea padre puede tenerla uno o varios becarios a la vez.
  const becarios = t.becarios?.length
    ? `<span class="tarjeta__becarios">${t.becarios.map((id) => `<span class="tarjeta__becario">${sprite(id, { dormido: t.estado !== 'En progreso' })}${escapar(nombres[id] || id)}</span>`).join('')}</span>`
    : '';
  const subtareas = t.subtareas ? `<span class="tarjeta__subtareas" title="Subtareas en Notion: no salen en el tablero">↳ ${t.subtareas} ${t.subtareas === 1 ? 'subtarea' : 'subtareas'}</span>` : '';
  const acento = temaDe({ nombre: t.sala || t.proyecto, claves: [t.proyecto] }).acento;
  return `<li class="tarjeta${t.estado === 'En espera' ? ' tarjeta--bloqueada' : ''}" style="--acento:${acento}">
    <span class="tarjeta__titulo">${titulo}</span>
    <span class="tarjeta__proyecto">${escapar(t.sala || 'Sin proyecto')}</span>
    ${etiquetas.length ? `<span class="etiquetas">${etiquetas.join('')}</span>` : ''}
    ${t.bloqueo && t.estado === 'En espera' ? `<span class="tarjeta__bloqueo">${escapar(t.bloqueo)}</span>` : ''}
    ${subtareas}${becarios}</li>`;
}

function pintar() {
  const proyecto = filtroProyecto.value;
  const becario = filtroBecario.value;
  const dep = filtroDepartamento.value;
  const tareas = datos.tareas.filter((t) => (!proyecto || t.sala === proyecto) && (!becario || t.becarios?.includes(becario)) && (!dep || t.departamento === dep));
  // Con un departamento elegido, solo sus fases. Con todos, las de QA y marketing solo si tienen algo.
  const columnas = datos.columnas.filter((c) => (dep ? c.departamentos.includes(dep) : c.departamentos.includes('desarrollo') || tareas.some((t) => t.columna === c.id)));
  tablero.innerHTML = columnas.map((c) => {
    const suyas = tareas.filter((t) => t.columna === c.id);
    return `<section class="columna columna--${slug(c.id)}" aria-label="${escapar(c.nombre)}">
      <header class="columna__cabeza"><h2>${escapar(c.nombre)}</h2><span class="columna__num">${suyas.length}</span></header>
      <ul class="columna__lista">${suyas.map(tarjeta).join('') || '<li class="columna__vacia">Nada por aquí</li>'}</ul></section>`;
  }).join('');
}

export async function cargarTablero() {
  if (cargando) return;
  cargando = true;
  tablero.setAttribute('aria-busy', 'true');
  try {
    datos = await api('/api/tablero');
    avisos.innerHTML = '';
    opciones(filtroProyecto, [...new Set(datos.tareas.map((t) => t.sala).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')));
    opciones(filtroBecario, [...new Set(datos.tareas.flatMap((t) => t.becarios || []))].sort(), (id) => nombres[id] || id);
    const deps = Object.fromEntries((datos.departamentos || []).map((d) => [d.id, d.nombre]));
    opciones(filtroDepartamento, Object.keys(deps), (id) => deps[id]);
    pintar();
    actualizado.textContent = `Actualizado a las ${hora()}`;
  } catch (error) {
    avisos.innerHTML = `<div class="aviso"><strong>No se puede leer el tablero.</strong> ${escapar(error.message)}</div>`;
    if (!datos) tablero.innerHTML = '';
  } finally {
    cargando = false;
    tablero.setAttribute('aria-busy', 'false');
  }
}

export function iniciarTablero() {
  filtroProyecto.addEventListener('change', () => datos && pintar());
  filtroBecario.addEventListener('change', () => datos && pintar());
  filtroDepartamento.addEventListener('change', () => datos && pintar());
  // Se refresca con la oficina (cada minuto), pero solo mientras se está mirando.
  document.addEventListener('oficina:datos', (e) => {
    nombres = Object.fromEntries(e.detail.becarios.map((b) => [b.id, b.nombre]));
    if (!vista.hidden) cargarTablero();
  });
}
