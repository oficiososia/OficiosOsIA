// La oficina: una sala por proyecto con los becarios en sus mesas, según las tareas de Notion.
// Se ve una sala cada vez, a pantalla completa, y se cambia con las pestañas.
import { ponerAvatares, sprite } from './sprites.js';
import { decorado, estiloTema, logoPequeno, temaDe } from './temas.js';
import { api, enlace, escapar, hora } from './util.js';

const ESTADOS = { trabajando: 'Trabajando', bloqueado: 'En espera', 'en-cola': 'Durmiendo, con tareas pendientes', libre: 'Durmiendo, sin tareas' };
// Sin nada en marcha, los becarios duermen en su mesa.
const DORMIDOS = new Set(['libre', 'en-cola']);
const PRODUCTO = [
  { id: 'po', nombre: 'Product Owner' },
  { id: 'pm', nombre: 'Project Manager' },
  { id: 'cto', nombre: 'CTO' },
];
const LEYENDA = `<ul class="leyenda" aria-label="Leyenda">
  <li><span class="leyenda__marca leyenda__marca--trabajando"></span>Trabajando</li>
  <li><span class="leyenda__marca leyenda__marca--bloqueado"></span>En espera</li>
  <li><span class="leyenda__marca leyenda__marca--libre"></span>Durmiendo</li></ul>`;
const ALTO_TEXTO = 84; // nombre, tarea (dos líneas) y fase bajo cada mesa
const CLAVE_SALA = 'panel-sala';

let datos = null;
let peticiones = { pendientes: 0, enCurso: 0 };
let salaActiva = leerSala();
const salas = document.querySelector('[data-salas]');
const pestanas = document.querySelector('[data-pestanas-oficina]');
const avisos = document.querySelector('[data-avisos]');
const actualizado = document.querySelector('[data-actualizado]');
const dialogoPuesto = document.querySelector('[data-dialogo-puesto]');
const dialogoEquipo = document.querySelector('[data-dialogo-equipo]');
const dialogoAsignar = document.querySelector('[data-dialogo-asignar]');
const POR_HACER = new Set(['Inbox', 'Por hacer']);

const becario = (id) => datos.becarios.find((b) => b.id === id) || { id, nombre: id, papel: '' };
const repoCorto = (url) => url.replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/^https?:\/\//i, '');

// La última sala vista se recuerda en este navegador; si no se puede, se empieza por la primera.
function leerSala() {
  try { return localStorage.getItem(CLAVE_SALA); } catch { return null; }
}
function guardarSala(clave) {
  try { localStorage.setItem(CLAVE_SALA, clave); } catch {}
}

export async function cargarOficina() {
  salas.setAttribute('aria-busy', 'true');
  try {
    datos = await api('/api/oficina');
    ponerAvatares(datos.becarios);
    pintar();
    const sinProyecto = datos.sinProyecto ? ` · ${datos.sinProyecto} ${datos.sinProyecto === 1 ? 'tarea' : 'tareas'} sin proyecto` : '';
    actualizado.textContent = `Actualizado ${hora()}${sinProyecto}`;
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
    lista.push('<div class="aviso"><strong>Equipos sin guardar.</strong> El panel no encuentra la base «Proyectos» de Notion: cada sala muestra solo a los becarios con tareas.</div>');
  }
  avisos.innerHTML = lista.join('');
  const claves = ['producto', ...datos.proyectos.map((p) => p.clave)];
  if (!claves.includes(salaActiva)) salaActiva = datos.proyectos[0]?.clave || 'producto';
  pintarPestanas();
  pintarSala();
}

function indicador(puestos) {
  if (puestos.some((p) => p.estado === 'trabajando')) return 'trabajando';
  if (puestos.some((p) => p.estado === 'bloqueado')) return 'bloqueado';
  return 'dormida';
}

function pintarPestanas() {
  const producto = peticiones.enCurso ? 'trabajando' : 'dormida';
  const items = [
    { clave: 'producto', nombre: 'Producto', punto: producto, numero: peticiones.pendientes || null, acento: temaDe({ producto: true, nombre: 'Producto' }).acento },
    ...datos.proyectos.map((p) => ({ clave: p.clave, nombre: p.nombre, punto: indicador(p.puestos), numero: p.abiertas, acento: temaDe(p).acento })),
  ];
  pestanas.innerHTML = items.map((item, i) => {
    const activa = item.clave === salaActiva;
    return `<button type="button" role="tab" class="pestana-oficina" style="--acento:${item.acento}" id="pestana-sala-${i}" aria-selected="${activa}" tabindex="${activa ? 0 : -1}" data-sala="${escapar(item.clave)}">
      <span class="pestana-oficina__punto pestana-oficina__punto--${item.punto}" aria-hidden="true"></span>${escapar(item.nombre)}${item.numero != null ? `<span class="pestana-oficina__num">${item.numero}</span>` : ''}</button>`;
  }).join('');
  salas.setAttribute('aria-labelledby', pestanas.querySelector('[aria-selected="true"]')?.id || '');
}

function pintarSala() {
  const i = datos.proyectos.findIndex((p) => p.clave === salaActiva);
  salas.innerHTML = i === -1 ? htmlSalaProducto() : htmlSala(datos.proyectos[i], i);
  distribuir();
}

// Reparte las mesas en filas y columnas para que la sala quepa entera, sin scroll.
function distribuir() {
  const suelo = salas.querySelector('.sala__suelo');
  const lista = suelo?.querySelector('.puestos');
  if (!lista || !lista.children.length) return;
  const estilo = getComputedStyle(suelo);
  const ancho = suelo.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight);
  const alto = suelo.clientHeight - parseFloat(estilo.paddingTop) - parseFloat(estilo.paddingBottom);
  const n = lista.children.length;
  let mejor = { cols: n, filas: 1, u: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const filas = Math.ceil(n / cols);
    const u = Math.min(alto / filas - ALTO_TEXTO, (ancho / cols) * 0.62);
    if (u > mejor.u) mejor = { cols, filas, u };
  }
  lista.style.setProperty('--cols', mejor.cols);
  lista.style.setProperty('--filas', mejor.filas);
  lista.style.setProperty('--u', `${Math.round(Math.max(36, Math.min(mejor.u, 190)))}px`);
}

function escena(id, estado, extra = '') {
  const dormido = DORMIDOS.has(estado);
  const zzz = dormido ? '<span class="zzz" aria-hidden="true"><i>z</i><i>z</i><i>Z</i></span>' : '';
  return `<span class="escena">${sprite(id, { dormido })}<span class="mesa"></span><span class="portatil"></span>${zzz}${extra}</span>`;
}

// La sala de producto refleja la cola de «Peticiones»: trabajando si /producto tiene una en curso.
function htmlSalaProducto() {
  const { pendientes, enCurso } = peticiones;
  const estado = enCurso ? 'trabajando' : pendientes ? 'en-cola' : 'libre';
  const extra = estado === 'trabajando' ? '<span class="globo"></span>' : estado === 'en-cola' ? `<span class="pila">${pendientes}</span>` : '';
  const puestos = PRODUCTO.map((r) => `<li><a class="puesto puesto--${estado}" href="#producto">
      ${escena(r.id, estado, extra)}<span class="puesto__nombre">${r.nombre}</span></a></li>`).join('');
  const texto = enCurso
    ? 'El equipo está trabajando en una petición en Claude Code…'
    : pendientes
      ? `${pendientes} ${pendientes === 1 ? 'petición espera' : 'peticiones esperan'}. Ejecuta <code>/producto</code> en Claude Code para despertarlos.`
      : 'Sin peticiones pendientes. Escríbeles en texto plano y te devuelven las tareas listas para revisar.';
  const sala = { producto: true, nombre: 'Sala de producto' };
  const tema = temaDe(sala);
  return `<article class="sala sala--producto sala--${tema.id}" style="${estiloTema(tema)}">
    <div class="sala__cabecera">${logoPequeno(sala, tema)}<div><h2 class="sala__nombre">Sala de producto</h2><p class="sala__meta">PO, PM y CTO convierten lo que pides en tareas de Notion</p></div>
    ${LEYENDA}<a class="sala__boton" href="#producto">Pasar una petición →</a></div>
    <div class="sala__suelo sala__suelo--${tema.suelo}">${decorado(sala, tema)}<ul class="puestos">${puestos}</ul>
    <p class="sala__nota">${texto}</p></div></article>`;
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
  const tema = temaDe(p);
  return `<article class="sala sala--${tema.id}" style="${estiloTema(tema)}">
    <div class="sala__cabecera">${logoPequeno(p, tema)}<div><h2 class="sala__nombre">${escapar(p.nombre)}</h2>
    <p class="sala__meta">${tema.sector ? `<span>${escapar(tema.sector)}</span><span aria-hidden="true">·</span>` : ''}${meta.join('<span aria-hidden="true">·</span>')}</p></div>
    ${LEYENDA}<button type="button" class="sala__boton sala__boton--principal" data-asignar="${i}"><span class="texto-largo">Asignar tareas</span><span class="texto-corto">Asignar</span></button>
    <button type="button" class="sala__boton" data-equipo="${i}">Equipo</button></div>
    <div class="sala__suelo sala__suelo--${tema.suelo}">${decorado(p, tema)}${puestos}${bandeja}</div></article>`;
}

function htmlPuesto(pu, i, j) {
  const b = becario(pu.becario);
  const tarea = pu.actual
    ? `<span class="puesto__tarea">${escapar(pu.actual.titulo)}</span>${pu.actual.fase ? `<span class="puesto__fase">${escapar(pu.actual.fase)}</span>` : ''}`
    : '<span class="puesto__tarea">Sin tareas</span>';
  const etiqueta = `${b.nombre}: ${ESTADOS[pu.estado]}${pu.actual ? `, «${pu.actual.titulo}»` : ''}`;
  const extra = pu.estado === 'en-cola' ? `<span class="pila">${pu.tareas.length}</span>` : DORMIDOS.has(pu.estado) ? '' : '<span class="globo"></span>';
  const marca = pu.pausado ? '<span class="puesto__fuera">Pausado</span>' : pu.asignado ? '' : '<span class="puesto__fuera">Fuera del equipo</span>';
  return `<button type="button" class="puesto puesto--${pu.estado}${pu.asignado ? '' : ' puesto--fuera'}${pu.pausado ? ' puesto--pausado' : ''}" data-puesto="${i}:${j}" aria-label="${escapar(etiqueta)}${pu.pausado ? ' (pausado)' : ''}">
    ${escena(pu.becario, pu.estado, extra)}
    <span class="puesto__nombre">${escapar(b.nombre)}</span>${tarea}${marca}</button>`;
}

function cambiarSala(clave, enfocar = false) {
  salaActiva = clave;
  guardarSala(clave);
  pintarPestanas();
  pintarSala();
  if (enfocar) pestanas.querySelector('[aria-selected="true"]')?.focus();
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
    <p class="dialogo__nota">${escapar(b.papel)}. En <strong>${escapar(proyecto.nombre)}</strong>: ${ESTADOS[puesto.estado].toLowerCase()}${puesto.asignado ? '' : ', aunque no está en el equipo de esta sala'}.${b.pausado ? ' <strong>Está pausado</strong>: sale aquí solo porque aún tiene tareas abiertas.' : ''}</p>
    ${htmlTareas(puesto.tareas)}`;
  dialogoPuesto.showModal();
}

// Tareas por hacer (Inbox o Por hacer) del proyecto: las que aún no están en el equipo y las
// que ya están en su flujo esperando a quien las tiene.
function tareasPorHacer(proyecto) {
  const prioridad = { Alta: 0, Media: 1, Baja: 2 };
  const ordenar = (lista) => lista.sort((a, b) => (prioridad[a.prioridad] ?? 9) - (prioridad[b.prioridad] ?? 9));
  return {
    libres: ordenar(proyecto.sinBecario.filter((t) => POR_HACER.has(t.estado))),
    enFlujo: ordenar(proyecto.puestos.flatMap((pu) => pu.tareas.filter((t) => POR_HACER.has(t.estado)).map((t) => ({ ...t, becario: pu.becario })))),
  };
}

function filaTarea(t, control) {
  const titulo = enlace(t.url) ? `<a href="${enlace(t.url)}" target="_blank" rel="noopener">${escapar(t.titulo)}</a>` : escapar(t.titulo);
  const etiquetas = [`<span class="etiqueta">${escapar(t.estado)}</span>`];
  if (t.prioridad) etiquetas.push(`<span class="etiqueta">Prioridad ${escapar(t.prioridad.toLowerCase())}</span>`);
  return `<li class="asignar__fila">${control}<div class="asignar__tarea">${titulo}<span class="etiquetas">${etiquetas.join('')}</span></div></li>`;
}

// La asignación pasa siempre por el equipo entero: la tarea entra por el CTO, en Preparación,
// y él decide qué becario la coge después. Aquí no se elige becario.
function abrirAsignar(i) {
  const proyecto = datos.proyectos[i];
  const { libres, enFlujo } = tareasPorHacer(proyecto);
  const ctoPausado = becario('cto').pausado;
  const conCto = !ctoPausado && (!proyecto.equipo.length || proyecto.equipo.includes('cto'));
  dialogoAsignar.dataset.indice = i;
  dialogoAsignar.querySelector('[data-titulo]').textContent = `Asignar tareas · ${proyecto.nombre}`;
  dialogoAsignar.querySelector('[data-nota]').innerHTML = ctoPausado
    ? '<strong>El CTO está pausado.</strong> Las tareas siempre entran por él: reactívalo en la pestaña <a href="#becarios" data-cerrar>Becarios</a> para poder pasarlas.'
    : !conCto
    ? '<strong>Este equipo no tiene CTO.</strong> Las tareas siempre entran por el CTO, que decide quién las coge: añádelo con el botón «Equipo».'
    : libres.length
      ? 'Marca las tareas que pasan al equipo. Las recibe el <strong>CTO</strong> en <strong>Preparación</strong>: hace el plan técnico y decide qué becario sigue (datos, servicios, interfaz, despliegue, QA). Las que estén en Inbox pasan a «Por hacer».'
      : 'No quedan tareas por hacer fuera del equipo.';
  const lista = [];
  if (libres.length) {
    lista.push(`<li class="asignar__titulo">Sin equipo · ${libres.length}</li>`);
    lista.push(...libres.map((t) => filaTarea(t, `<input type="checkbox" data-tarea="${escapar(t.id)}" aria-label="Pasar «${escapar(t.titulo)}» al equipo"${conCto ? '' : ' disabled'}>`)));
  }
  if (enFlujo.length) {
    lista.push(`<li class="asignar__titulo">Ya en el flujo del equipo · ${enFlujo.length}</li>`);
    lista.push(...enFlujo.map((t) => filaTarea(t, `<span class="asignar__quien">${sprite(t.becario)}${escapar(becario(t.becario).nombre)}${t.fase ? ` · ${escapar(t.fase)}` : ''}</span>`)));
  }
  dialogoAsignar.querySelector('[data-lista-asignar]').innerHTML = lista.join('');
  dialogoAsignar.querySelector('[data-error-asignar]').hidden = true;
  contarCambios();
  dialogoAsignar.showModal();
}

const marcadas = () => [...dialogoAsignar.querySelectorAll('input[data-tarea]:checked')].map((c) => c.dataset.tarea);

function contarCambios() {
  const n = marcadas().length;
  dialogoAsignar.querySelector('[data-cambios]').textContent = n ? `${n} ${n === 1 ? 'tarea marcada' : 'tareas marcadas'}` : '';
  const boton = dialogoAsignar.querySelector('[data-guardar-asignar]');
  boton.disabled = !n;
  boton.textContent = n ? `Pasar ${n} al equipo →` : 'Pasar al equipo →';
}

async function guardarAsignaciones(e) {
  e.preventDefault();
  const tareas = marcadas();
  if (!tareas.length) return;
  const boton = dialogoAsignar.querySelector('[data-guardar-asignar]');
  const error = dialogoAsignar.querySelector('[data-error-asignar]');
  boton.disabled = true;
  error.hidden = true;
  try {
    await api('/api/asignar', { method: 'PUT', body: { tareas } });
    dialogoAsignar.close();
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
    boton.disabled = false;
  }
  await cargarOficina();
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
      ${sprite(b.id, { dormido: b.pausado })}<span><strong>${escapar(b.nombre)}${b.pausado ? ' · pausado' : ''}</strong><small>${escapar(b.papel)}</small></span></label>`).join(''));
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
  pestanas.addEventListener('click', (e) => {
    const pestana = e.target.closest('[data-sala]');
    if (pestana) cambiarSala(pestana.dataset.sala, true);
  });
  // Flechas para moverse entre pestañas, como en cualquier lista de pestañas.
  pestanas.addEventListener('keydown', (e) => {
    const todas = [...pestanas.querySelectorAll('[data-sala]')];
    const actual = todas.findIndex((p) => p.getAttribute('aria-selected') === 'true');
    const paso = { ArrowRight: 1, ArrowLeft: -1, Home: -actual, End: todas.length - 1 - actual }[e.key];
    if (paso === undefined) return;
    e.preventDefault();
    cambiarSala(todas[(actual + paso + todas.length) % todas.length].dataset.sala, true);
  });
  new ResizeObserver(() => distribuir()).observe(salas);
  salas.addEventListener('click', (e) => {
    const puesto = e.target.closest('[data-puesto]');
    if (puesto) return abrirPuesto(...puesto.dataset.puesto.split(':').map(Number));
    const equipo = e.target.closest('[data-equipo]');
    if (equipo) return abrirEquipo(Number(equipo.dataset.equipo));
    const bandeja = e.target.closest('[data-bandeja]');
    if (bandeja) return abrirAsignar(Number(bandeja.dataset.bandeja));
    const asignar = e.target.closest('[data-asignar]');
    if (asignar) abrirAsignar(Number(asignar.dataset.asignar));
  });
  for (const dialogo of [dialogoPuesto, dialogoEquipo, dialogoAsignar]) {
    dialogo.addEventListener('click', (e) => {
      if (e.target === dialogo || e.target.closest('[data-cerrar]')) dialogo.close();
    });
  }
  dialogoEquipo.querySelector('[data-form-equipo]').addEventListener('submit', guardarEquipo);
  dialogoAsignar.querySelector('[data-form-asignar]').addEventListener('submit', guardarAsignaciones);
  dialogoAsignar.addEventListener('change', (e) => { if (e.target.matches('input[data-tarea]')) contarCambios(); });
  document.querySelector('[data-recargar]').addEventListener('click', cargarOficina);
  document.addEventListener('oficina:recargar', cargarOficina);
  document.addEventListener('peticiones:datos', (e) => {
    const cambia = e.detail.pendientes !== peticiones.pendientes || e.detail.enCurso !== peticiones.enCurso;
    peticiones = e.detail;
    if (datos && cambia) {
      pintarPestanas();
      if (salaActiva === 'producto') pintarSala();
    }
  });
  // Notion cambia mientras los becarios trabajan: se refresca cada minuto si se está mirando.
  setInterval(() => {
    if (document.visibilityState === 'visible' && !dialogoPuesto.open && !dialogoEquipo.open && !dialogoAsignar.open) cargarOficina();
  }, 60_000);
}
