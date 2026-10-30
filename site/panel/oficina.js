// La oficina: una sala por proyecto con los becarios en sus mesas, según las tareas de Notion.
import { sprite } from './sprites.js';
import { api, enlace, escapar, hora } from './util.js';

const ESTADOS = { trabajando: 'Trabajando', bloqueado: 'En espera', 'en-cola': 'Con tareas pendientes', libre: 'Libre' };
const PRODUCTO = [
  { id: 'po', nombre: 'Product Owner' },
  { id: 'pm', nombre: 'Project Manager' },
  { id: 'cto', nombre: 'CTO' },
];
const PLANTA = '<svg class="planta" viewBox="0 0 8 11" shape-rendering="crispEdges" aria-hidden="true"><rect x="3" y="0" width="2" height="2" fill="#4f9a5a"/><rect x="1" y="1" width="2" height="3" fill="#3e7f48"/><rect x="5" y="1" width="2" height="3" fill="#3e7f48"/><rect x="2" y="3" width="4" height="3" fill="#4f9a5a"/><rect x="1" y="6" width="6" height="5" fill="#8a6238"/></svg>';

let datos = null;
let peticiones = { pendientes: 0, enCurso: 0 };
const salas = document.querySelector('[data-salas]');
const avisos = document.querySelector('[data-avisos]');
const actualizado = document.querySelector('[data-actualizado]');
const dialogoPuesto = document.querySelector('[data-dialogo-puesto]');
const dialogoEquipo = document.querySelector('[data-dialogo-equipo]');

const becario = (id) => datos.becarios.find((b) => b.id === id) || { id, nombre: id, papel: '' };
const repoCorto = (url) => url.replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/^https?:\/\//i, '');

export async function cargarOficina() {
  salas.setAttribute('aria-busy', 'true');
  try {
    datos = await api('/api/oficina');
    pintar();
    actualizado.textContent = `Actualizado a las ${hora()}`;
    document.dispatchEvent(new CustomEvent('oficina:datos', { detail: datos }));
  } catch (error) {
    avisos.innerHTML = `<div class="aviso"><strong>No se ha podido abrir la oficina.</strong> ${escapar(error.message)}</div>`;
    if (!datos) salas.innerHTML = '';
  } finally {
    salas.setAttribute('aria-busy', 'false');
  }
}

function pintar() {
  const lista = (datos.avisos || []).map((a) => `<div class="aviso"><strong>Notion:</strong> ${escapar(a)}</div>`);
  // Si Notion ya ha dado un aviso, ese explica también por qué no se leen los equipos.
  if (!datos.guardable && !lista.length) {
    lista.push('<div class="aviso"><strong>Equipos sin guardar.</strong> El panel no encuentra la base «Proyectos» de Notion. Mientras tanto, cada sala muestra a los becarios que ya tienen tareas en ese proyecto.</div>');
  }
  if (datos.sinProyecto) {
    lista.push(`<div class="aviso">${datos.sinProyecto} ${datos.sinProyecto === 1 ? 'tarea abierta no tiene' : 'tareas abiertas no tienen'} «Proyecto relacionado» en Notion y no salen en ninguna sala.</div>`);
  }
  avisos.innerHTML = lista.join('');
  salas.innerHTML = htmlSalaProducto() + datos.proyectos.map(htmlSala).join('');
}

// La sala de producto refleja la cola de «Peticiones»: trabajando si /producto tiene una en curso.
function htmlSalaProducto() {
  const { pendientes, enCurso } = peticiones;
  const estado = enCurso ? 'trabajando' : pendientes ? 'en-cola' : 'libre';
  const puestos = PRODUCTO.map((r) => `<li><a class="puesto puesto--${estado}" href="#producto">
      <span class="escena">${sprite(r.id)}<span class="mesa"></span><span class="portatil"></span><span class="globo">${estado === 'en-cola' ? pendientes : ''}</span></span>
      <span class="puesto__nombre">${r.nombre}</span></a></li>`).join('');
  const texto = enCurso
    ? 'El equipo está trabajando en una petición en Claude Code…'
    : pendientes
      ? `${pendientes} ${pendientes === 1 ? 'petición espera' : 'peticiones esperan'}. Ejecuta <code>/producto</code> en Claude Code para que la conviertan en tareas.`
      : 'Sin peticiones pendientes. Escríbeles en texto plano y te devuelven las tareas listas para revisar.';
  return `<article class="sala sala--producto" aria-labelledby="sala-producto">
    <div class="sala__cabecera"><div><h2 class="sala__nombre" id="sala-producto">Sala de producto</h2><p class="sala__meta">PO, PM y CTO convierten lo que pides en tareas de Notion</p></div>
    <a class="sala__boton" href="#producto">Pasar una petición →</a></div>
    <div class="sala__suelo">${PLANTA}<ul class="puestos">${puestos}</ul>
    <p>${texto}</p></div></article>`;
}

function htmlSala(p, i) {
  const meta = [`${p.abiertas} ${p.abiertas === 1 ? 'tarea abierta' : 'tareas abiertas'}`];
  if (enlace(p.repo)) meta.push(`<a href="${enlace(p.repo)}" target="_blank" rel="noopener">${escapar(repoCorto(p.repo))}</a>`);
  if (enlace(p.url)) meta.push(`<a href="${enlace(p.url)}" target="_blank" rel="noopener">Notion</a>`);
  const puestos = p.puestos.length
    ? `<ul class="puestos">${p.puestos.map((pu, j) => `<li>${htmlPuesto(pu, i, j)}</li>`).join('')}</ul>`
    : `<p class="sala__vacia">Sala vacía: nadie del equipo ni ninguna tarea con becario.${datos.guardable && p.id ? ' Pulsa «Equipo» para asignar becarios.' : ''}</p>`;
  const bandeja = p.sinBecario.length
    ? `<button type="button" class="bandeja" data-bandeja="${i}"><span class="bandeja__papeles" aria-hidden="true"></span>${p.sinBecario.length} sin becario</button>`
    : '';
  return `<article class="sala" aria-labelledby="sala-${i}">
    <div class="sala__cabecera"><div><h2 class="sala__nombre" id="sala-${i}">${escapar(p.nombre)}</h2>
    <p class="sala__meta">${meta.join('<span aria-hidden="true">·</span>')}</p></div>
    <button type="button" class="sala__boton" data-equipo="${i}">Equipo</button></div>
    <div class="sala__suelo">${PLANTA}${puestos}${bandeja}</div></article>`;
}

function htmlPuesto(pu, i, j) {
  const b = becario(pu.becario);
  const tarea = pu.actual
    ? `<span class="puesto__tarea">${escapar(pu.actual.titulo)}</span>${pu.actual.fase ? `<span class="puesto__fase">${escapar(pu.actual.fase)}</span>` : ''}`
    : '<span class="puesto__tarea">Sin tareas</span>';
  const etiqueta = `${b.nombre}: ${ESTADOS[pu.estado]}${pu.actual ? `, «${pu.actual.titulo}»` : ''}`;
  return `<button type="button" class="puesto puesto--${pu.estado}${pu.asignado ? '' : ' puesto--fuera'}" data-puesto="${i}:${j}" aria-label="${escapar(etiqueta)}">
    <span class="escena">${sprite(pu.becario)}<span class="mesa"></span><span class="portatil"></span><span class="globo">${pu.estado === 'en-cola' ? pu.tareas.length : ''}</span></span>
    <span class="puesto__nombre">${escapar(b.nombre)}</span>${tarea}${pu.asignado ? '' : '<span class="puesto__fuera">Fuera del equipo</span>'}</button>`;
}

function htmlTareas(tareas) {
  if (!tareas.length) return '<p class="dialogo__nota">No tiene tareas abiertas en este proyecto.</p>';
  return `<ul class="lista-tareas">${tareas.map((t) => {
    const titulo = enlace(t.url) ? `<a href="${enlace(t.url)}" target="_blank" rel="noopener">${escapar(t.titulo)}</a>` : escapar(t.titulo);
    const clase = t.estado === 'En progreso' ? ' etiqueta--trabajando' : t.estado === 'En espera' ? ' etiqueta--bloqueado' : '';
    const etiquetas = [`<span class="etiqueta${clase}">${escapar(t.estado || 'Sin estado')}</span>`];
    if (t.fase) etiquetas.push(`<span class="etiqueta">${escapar(t.fase)}</span>`);
    if (t.prioridad) etiquetas.push(`<span class="etiqueta">Prioridad ${escapar(t.prioridad.toLowerCase())}</span>`);
    return `<li>${titulo}<div class="etiquetas">${etiquetas.join('')}</div>${t.bloqueo ? `<span>Bloqueo: ${escapar(t.bloqueo)}</span>` : ''}</li>`;
  }).join('')}</ul>`;
}

function abrirPuesto(i, j) {
  const proyecto = datos.proyectos[i];
  const puesto = proyecto.puestos[j];
  const b = becario(puesto.becario);
  dialogoPuesto.querySelector('[data-titulo]').innerHTML = `${sprite(b.id)}${escapar(b.nombre)}`;
  dialogoPuesto.querySelector('[data-cuerpo]').innerHTML = `
    <p class="dialogo__nota">${escapar(b.papel)}. En <strong>${escapar(proyecto.nombre)}</strong>: ${ESTADOS[puesto.estado].toLowerCase()}${puesto.asignado ? '' : ', aunque no está en el equipo de esta sala'}.</p>
    ${htmlTareas(puesto.tareas)}`;
  dialogoPuesto.showModal();
}

function abrirBandeja(i) {
  const proyecto = datos.proyectos[i];
  dialogoPuesto.querySelector('[data-titulo]').textContent = `Sin becario · ${proyecto.nombre}`;
  dialogoPuesto.querySelector('[data-cuerpo]').innerHTML = `<p class="dialogo__nota">Tareas abiertas de este proyecto sin becario asignado en Notion.</p>${htmlTareas(proyecto.sinBecario)}`;
  dialogoPuesto.showModal();
}

function abrirEquipo(i) {
  const proyecto = datos.proyectos[i];
  const puedeGuardar = datos.guardable && proyecto.id;
  dialogoEquipo.dataset.indice = i;
  dialogoEquipo.querySelector('[data-titulo]').textContent = `Equipo · ${proyecto.nombre}`;
  dialogoEquipo.querySelector('[data-nota]').textContent = !datos.guardable
    ? 'Para guardar equipos falta la base «Proyectos» de Notion. Puedes ver la selección, pero aún no guardarla.'
    : !proyecto.id
      ? 'Este proyecto aparece en las tareas pero no en la base «Proyectos» de Notion. Añádelo allí para asignarle un equipo.'
      : 'Elige qué becarios trabajan en este proyecto. Se guarda en Notion, en la base «Proyectos».';
  const opciones = dialogoEquipo.querySelector('[data-opciones]');
  opciones.querySelectorAll('label').forEach((l) => l.remove());
  opciones.insertAdjacentHTML('beforeend', datos.becarios.map((b) => `<label class="equipo-opcion">
      <input type="checkbox" name="becario" value="${escapar(b.id)}"${proyecto.equipo.includes(b.id) ? ' checked' : ''}${puedeGuardar ? '' : ' disabled'}>
      ${sprite(b.id)}<span><strong>${escapar(b.nombre)}</strong><small>${escapar(b.papel)}</small></span></label>`).join(''));
  dialogoEquipo.querySelector('[data-guardar]').disabled = !puedeGuardar;
  dialogoEquipo.querySelector('[data-error-equipo]').hidden = true;
  dialogoEquipo.showModal();
}

async function guardarEquipo(e) {
  e.preventDefault();
  const proyecto = datos.proyectos[Number(dialogoEquipo.dataset.indice)];
  const boton = dialogoEquipo.querySelector('[data-guardar]');
  const error = dialogoEquipo.querySelector('[data-error-equipo]');
  const equipo = [...dialogoEquipo.querySelectorAll('input[name="becario"]:checked')].map((c) => c.value);
  boton.disabled = true;
  error.hidden = true;
  try {
    await api('/api/equipos', { method: 'PUT', body: { proyectoId: proyecto.id, equipo } });
    dialogoEquipo.close();
    await cargarOficina();
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
  } finally {
    boton.disabled = false;
  }
}

export function iniciarOficina() {
  salas.addEventListener('click', (e) => {
    const puesto = e.target.closest('[data-puesto]');
    if (puesto) return abrirPuesto(...puesto.dataset.puesto.split(':').map(Number));
    const equipo = e.target.closest('[data-equipo]');
    if (equipo) return abrirEquipo(Number(equipo.dataset.equipo));
    const bandeja = e.target.closest('[data-bandeja]');
    if (bandeja) abrirBandeja(Number(bandeja.dataset.bandeja));
  });
  for (const dialogo of [dialogoPuesto, dialogoEquipo]) {
    dialogo.addEventListener('click', (e) => {
      if (e.target === dialogo || e.target.closest('[data-cerrar]')) dialogo.close();
    });
  }
  dialogoEquipo.querySelector('[data-form-equipo]').addEventListener('submit', guardarEquipo);
  document.querySelector('[data-recargar]').addEventListener('click', cargarOficina);
  document.addEventListener('oficina:recargar', cargarOficina);
  document.addEventListener('peticiones:datos', (e) => {
    const cambia = e.detail.pendientes !== peticiones.pendientes || e.detail.enCurso !== peticiones.enCurso;
    peticiones = e.detail;
    if (datos && cambia) pintar();
  });
  // Notion cambia mientras los becarios trabajan: se refresca cada minuto si se está mirando.
  setInterval(() => {
    if (document.visibilityState === 'visible' && !dialogoPuesto.open && !dialogoEquipo.open) cargarOficina();
  }, 60_000);
}
