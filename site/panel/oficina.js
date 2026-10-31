// La oficina: una sala por proyecto, dividida en habitaciones (producto y los departamentos del
// equipo: desarrollo, QA y marketing), con los becarios en sus mesas según las tareas de Notion.
// Se ve una sala cada vez, a pantalla completa, y se cambia con las pestañas.
import { ponerAvatares, sprite } from './sprites.js';
import { decorado, estiloTema, logoPequeno, temaDe } from './temas.js';
import { api, enlace, escapar, hora, normalizar } from './util.js';

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
const ALTO_CARTEL = 30; // cartel con el nombre de cada habitación
const HUECO = 10; // entre habitaciones
// Si las mesas quedarían más pequeñas que esto (móvil, o muchos departamentos en una pantalla
// baja), las habitaciones se apilan a lo ancho y el suelo se desplaza.
const U_MINIMO = 46;
const U_APILADA = 54;
const CLAVE_SALA = 'panel-sala';

let datos = null;
let peticiones = { pendientes: 0, enCurso: 0, porProyecto: {} };
let salaActiva = leerSala();
const salas = document.querySelector('[data-salas]');
const pestanas = document.querySelector('[data-pestanas-oficina]');
const avisos = document.querySelector('[data-avisos]');
const actualizado = document.querySelector('[data-actualizado]');
const dialogoPuesto = document.querySelector('[data-dialogo-puesto]');
const dialogoEquipo = document.querySelector('[data-dialogo-equipo]');
const dialogoAsignar = document.querySelector('[data-dialogo-asignar]');
const dialogoLanzar = document.querySelector('[data-dialogo-lanzar]');
const POR_HACER = new Set(['Inbox', 'Por hacer']);

const becario = (id) => datos.becarios.find((b) => b.id === id) || { id, nombre: id, papel: '' };
const departamento = (id) => datos.departamentos.find((d) => d.id === id) || { id, nombre: id, entrada: null };
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

// Mejor rejilla de mesas para un hueco: la que deja las mesas más grandes.
function rejilla(n, ancho, alto) {
  let mejor = { cols: n, filas: 1, u: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const filas = Math.ceil(n / cols);
    const u = Math.min(alto / filas - ALTO_TEXTO, (ancho / cols) * 0.62);
    if (u > mejor.u) mejor = { cols, filas, u };
  }
  return mejor;
}

// Formas de repartir las habitaciones, en orden, en `filas` filas seguidas.
function cortes(n, filas) {
  if (filas === 1) return [[n]];
  const salida = [];
  for (let primero = 1; primero <= n - filas + 1; primero++) {
    for (const resto of cortes(n - primero, filas - 1)) salida.push([primero, ...resto]);
  }
  return salida;
}

// Reparte las habitaciones en filas y las mesas de cada una para que la sala quepa entera, sin
// scroll y con todas las mesas del mismo tamaño. Cada habitación es tan ancha como mesas tiene.
function distribuir() {
  const casa = salas.querySelector('.habitaciones');
  if (!casa) return;
  const cuartos = [...casa.children];
  const mesas = cuartos.map((c) => Math.max(1, c.querySelector('.puestos')?.children.length || 1));
  const ancho = casa.clientWidth;
  const alto = casa.clientHeight;
  if (!ancho || !alto) return;
  let mejor = null;
  for (let filas = 1; filas <= cuartos.length; filas++) {
    for (const reparto of cortes(cuartos.length, filas)) {
      const altoFila = (alto - HUECO * (filas - 1)) / filas;
      const plan = [];
      let u = Infinity;
      let desde = 0;
      for (const cuantos of reparto) {
        const indices = Array.from({ length: cuantos }, (_, k) => desde + k);
        const total = indices.reduce((s, k) => s + mesas[k], 0);
        const libre = ancho - HUECO * (cuantos - 1);
        for (const k of indices) {
          const w = Math.floor((libre * mesas[k]) / total);
          const r = rejilla(mesas[k], w - 16, altoFila - ALTO_CARTEL - 12);
          plan[k] = { ...r, w, h: Math.floor(altoFila) };
          u = Math.min(u, r.u);
        }
        desde += cuantos;
      }
      if (!mejor || u > mejor.u) mejor = { u, plan };
    }
  }
  const apilar = mejor.u < U_MINIMO;
  casa.classList.toggle('habitaciones--apiladas', apilar);
  if (apilar) {
    const cols = Math.max(1, Math.floor((ancho - 16) / (U_APILADA * 1.5 + 8)));
    cuartos.forEach((c, k) => {
      c.style.width = '100%';
      c.style.height = '';
      const lista = c.querySelector('.puestos');
      if (!lista) return;
      lista.style.setProperty('--cols', Math.min(cols, mesas[k]));
      lista.style.setProperty('--filas', Math.ceil(mesas[k] / Math.min(cols, mesas[k])));
      lista.style.setProperty('--u', `${U_APILADA}px`);
    });
    return;
  }
  const u = `${Math.round(Math.min(mejor.u, 170))}px`;
  cuartos.forEach((c, k) => {
    const { cols, filas, w, h } = mejor.plan[k];
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    const lista = c.querySelector('.puestos');
    if (!lista) return;
    lista.style.setProperty('--cols', cols);
    lista.style.setProperty('--filas', filas);
    lista.style.setProperty('--u', u);
  });
}

function escena(id, estado, extra = '') {
  const dormido = DORMIDOS.has(estado);
  const zzz = dormido ? '<span class="zzz" aria-hidden="true"><i>z</i><i>z</i><i>Z</i></span>' : '';
  return `<span class="escena">${sprite(id, { dormido })}<span class="mesa"></span><span class="portatil"></span>${zzz}${extra}</span>`;
}

// Mesas del equipo de producto según sus peticiones: trabajando si /producto tiene una en curso.
function mesasProducto({ pendientes, enCurso }) {
  const estado = enCurso ? 'trabajando' : pendientes ? 'en-cola' : 'libre';
  const extra = estado === 'trabajando' ? '<span class="globo"></span>' : estado === 'en-cola' ? `<span class="pila">${pendientes}</span>` : '';
  return PRODUCTO.map((r) => `<li><a class="puesto puesto--${estado}" href="#producto/peticiones">
      ${escena(r.id, estado, extra)}<span class="puesto__nombre">${r.nombre}</span></a></li>`).join('');
}

// La sala de producto refleja la cola de «Peticiones» de todos los proyectos.
function htmlSalaProducto() {
  const { pendientes, enCurso } = peticiones;
  const texto = enCurso
    ? 'El equipo está trabajando en una petición en Claude Code…'
    : pendientes
      ? `${pendientes} ${pendientes === 1 ? 'petición espera' : 'peticiones esperan'}. Ejecuta <code>/producto</code> en Claude Code para despertarlos.`
      : 'Sin peticiones pendientes. Escríbeles en texto plano y te devuelven las tareas listas para revisar.';
  const sala = { producto: true, nombre: 'Sala de producto' };
  const tema = temaDe(sala);
  return `<article class="sala sala--producto sala--${tema.id}" style="${estiloTema(tema)}">
    <div class="sala__cabecera">${logoPequeno(sala, tema)}<div><h2 class="sala__nombre">Sala de producto</h2><p class="sala__meta">PO, PM y CTO convierten lo que pides en tareas de Notion. También tienen habitación en cada oficina.</p></div>
    ${LEYENDA}<a class="sala__boton" href="#producto/pedir">Pasar una petición →</a></div>
    <div class="sala__suelo sala__suelo--${tema.suelo}">${decorado(sala, tema)}
    <div class="habitaciones"><section class="habitacion habitacion--producto" aria-label="Producto"><h3 class="habitacion__cartel"><span>Producto</span></h3>
    <ul class="puestos">${mesasProducto(peticiones)}</ul></section></div>
    <p class="sala__nota">${texto}</p></div></article>`;
}

// Peticiones de este proyecto (por cualquiera de sus textos de «Proyecto relacionado»).
function peticionesDe(p) {
  const suma = { pendientes: 0, enCurso: 0 };
  for (const c of new Set(p.claves.map(normalizar))) {
    const n = peticiones.porProyecto?.[c];
    if (n) { suma.pendientes += n.pendientes; suma.enCurso += n.enCurso; }
  }
  return suma;
}

function htmlHabitacionProducto(p) {
  const n = peticionesDe(p);
  const cuenta = n.pendientes + n.enCurso;
  return `<section class="habitacion habitacion--producto" aria-label="Producto"><h3 class="habitacion__cartel"><span>Producto</span>${cuenta ? `<small>${cuenta} ${cuenta === 1 ? 'petición' : 'peticiones'}</small>` : ''}</h3>
    <ul class="puestos">${mesasProducto(n)}</ul></section>`;
}

function htmlHabitacion(p, i, h) {
  const suyos = p.puestos.map((pu, j) => ({ pu, j })).filter(({ pu }) => pu.departamento === h.id);
  const cartel = `<h3 class="habitacion__cartel"><span>${escapar(h.nombre)}</span>${h.abiertas ? `<small>${h.abiertas} ${h.abiertas === 1 ? 'tarea' : 'tareas'}</small>` : ''}${h.activo ? '' : '<small class="habitacion__fuera">Fuera del equipo</small>'}</h3>`;
  const mesas = suyos.length
    ? `<ul class="puestos">${suyos.map(({ pu, j }) => `<li>${htmlPuesto(pu, i, j)}</li>`).join('')}</ul>`
    : '<p class="habitacion__vacia">Nadie en su mesa (todos en pausa).</p>';
  return `<section class="habitacion habitacion--${escapar(h.id)}${h.activo ? '' : ' habitacion--fuera'}${h.trabajando ? ' habitacion--trabajando' : ''}" aria-label="${escapar(h.nombre)}">${cartel}${mesas}</section>`;
}

function htmlSala(p, i) {
  const meta = [`${p.abiertas} ${p.abiertas === 1 ? 'tarea abierta' : 'tareas abiertas'}`];
  if (enlace(p.repo)) meta.push(`<a href="${enlace(p.repo)}" target="_blank" rel="noopener">${escapar(repoCorto(p.repo))}</a>`);
  if (enlace(p.url)) meta.push(`<a href="${enlace(p.url)}" target="_blank" rel="noopener">Notion</a>`);
  const habitaciones = [htmlHabitacionProducto(p), ...p.habitaciones.map((h) => htmlHabitacion(p, i, h))];
  if (!p.habitaciones.length) {
    habitaciones.push(`<section class="habitacion habitacion--vacia"><h3 class="habitacion__cartel"><span>Sin departamentos</span></h3>
      <p class="habitacion__vacia">${datos.guardable && p.id ? 'Pulsa «Equipo» para añadir Desarrollo, QA o Marketing a esta oficina.' : 'Añade el proyecto a la base «Proyectos» de Notion para darle departamentos.'}</p></section>`);
  }
  const bandeja = p.sinBecario.length
    ? `<button type="button" class="bandeja" data-bandeja="${i}"><span class="bandeja__papeles" aria-hidden="true"></span>${p.sinBecario.length} sin departamento</button>`
    : '';
  const nube = p.conectado
    ? '<span class="sala__nube" title="Puedes lanzar sus tareas en la nube con tu suscripción de Claude">☁ En la nube</span>'
    : datos.nube && p.id ? '<a class="sala__boton sala__boton--nube" href="#conexiones" title="Conecta tu tarea programada de Claude para lanzar sus tareas en la nube">☁ Conectar</a>' : '';
  const tema = temaDe(p);
  return `<article class="sala sala--${tema.id}" style="${estiloTema(tema)}">
    <div class="sala__cabecera">${logoPequeno(p, tema)}<div><h2 class="sala__nombre">${escapar(p.nombre)}</h2>
    <p class="sala__meta">${tema.sector ? `<span>${escapar(tema.sector)}</span><span aria-hidden="true">·</span>` : ''}${meta.join('<span aria-hidden="true">·</span>')}</p></div>
    ${LEYENDA}${nube}<button type="button" class="sala__boton sala__boton--principal" data-asignar="${i}"><span class="texto-largo">Asignar tareas</span><span class="texto-corto">Asignar</span></button>
    <button type="button" class="sala__boton" data-equipo="${i}">Equipo</button></div>
    <div class="sala__suelo sala__suelo--${tema.suelo}">${decorado(p, tema)}<div class="habitaciones">${habitaciones.join('')}</div>${bandeja}</div></article>`;
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

// Se puede lanzar en la nube si quien mira tiene conexión para la sala y la tarea ya está en
// un departamento.
const lanzable = (proyecto, t) => proyecto.conectado && t.departamento && t.estado !== 'Hecha';
const botonLanzar = (i, t) => `<button type="button" class="boton-nube" data-lanzar="${i}|${escapar(t.id)}" aria-label="Lanzar «${escapar(t.titulo)}» en la nube">☁ Lanzar</button>`;

function htmlTareas(tareas, proyecto, i) {
  if (!tareas.length) return '<p class="dialogo__nota">No tiene tareas abiertas en este proyecto.</p>';
  return `<ul class="lista-tareas">${tareas.map((t) => {
    const titulo = enlace(t.url) ? `<a href="${enlace(t.url)}" target="_blank" rel="noopener">${escapar(t.titulo)}</a>` : escapar(t.titulo);
    const clase = t.estado === 'En progreso' ? ' etiqueta--trabajando' : t.estado === 'En espera' ? ' etiqueta--bloqueado' : '';
    const etiquetas = [`<span class="etiqueta${clase}">${escapar(t.estado || 'Sin estado')}</span>`];
    if (t.fase) etiquetas.push(`<span class="etiqueta">${escapar(t.fase)}</span>`);
    if (t.prioridad) etiquetas.push(`<span class="etiqueta">Prioridad ${escapar(t.prioridad.toLowerCase())}</span>`);
    if (enlace(t.pr)) etiquetas.push(`<a class="etiqueta etiqueta--enlace" href="${enlace(t.pr)}" target="_blank" rel="noopener">Ver PR ↗</a>`);
    return `<li><div class="lista-tareas__fila">${titulo}${lanzable(proyecto, t) ? botonLanzar(i, t) : ''}</div><div class="etiquetas">${etiquetas.join('')}</div>${t.bloqueo ? `<span>Bloqueo: ${escapar(t.bloqueo)}</span>` : ''}</li>`;
  }).join('')}</ul>`;
}

function abrirPuesto(i, j) {
  const proyecto = datos.proyectos[i];
  const puesto = proyecto.puestos[j];
  const b = becario(puesto.becario);
  const dep = departamento(b.departamento);
  dialogoPuesto.querySelector('[data-titulo]').innerHTML = `${sprite(b.id)}${escapar(b.nombre)}`;
  const nube = proyecto.conectado
    ? ' Con «☁ Lanzar» la tarea se hace en la nube con tu suscripción de Claude, hasta abrir el PR.'
    : datos.nube && proyecto.id ? ' Para lanzar sus tareas en la nube, conecta tu tarea programada en <a href="#conexiones" data-cerrar>Conexiones</a>.' : '';
  dialogoPuesto.querySelector('[data-cuerpo]').innerHTML = `
    <p class="dialogo__nota">${escapar(b.papel)} · ${escapar(dep.nombre)}. En <strong>${escapar(proyecto.nombre)}</strong>: ${ESTADOS[puesto.estado].toLowerCase()}${puesto.asignado ? '' : ', aunque no está en el equipo de esta sala'}.${b.pausado ? ' <strong>Está pausado</strong>: sale aquí solo porque aún tiene tareas abiertas.' : ''}${nube}</p>
    ${htmlTareas(puesto.tareas, proyecto, i)}`;
  dialogoPuesto.showModal();
}

// Tareas por hacer (Inbox o Por hacer) del proyecto: las que aún no están en ningún
// departamento y las que ya están en el flujo de uno esperando a quien las tiene.
function tareasPorHacer(proyecto) {
  const prioridad = { Alta: 0, Media: 1, Baja: 2 };
  const ordenar = (lista) => lista.sort((a, b) => (prioridad[a.prioridad] ?? 9) - (prioridad[b.prioridad] ?? 9));
  return {
    libres: ordenar(proyecto.sinBecario.filter((t) => POR_HACER.has(t.estado))),
    // Una tarea con varios becarios está en varias mesas: sale una sola vez.
    enFlujo: ordenar([...new Map(proyecto.puestos.flatMap((pu) => pu.tareas.filter((t) => POR_HACER.has(t.estado))).map((t) => [t.id, t])).values()]),
  };
}

function filaTarea(t, control, extra = '') {
  const titulo = enlace(t.url) ? `<a href="${enlace(t.url)}" target="_blank" rel="noopener">${escapar(t.titulo)}</a>` : escapar(t.titulo);
  const etiquetas = [`<span class="etiqueta">${escapar(t.estado)}</span>`];
  if (t.prioridad) etiquetas.push(`<span class="etiqueta">Prioridad ${escapar(t.prioridad.toLowerCase())}</span>`);
  return `<li class="asignar__fila">${control}<div class="asignar__tarea">${titulo}<span class="etiquetas">${etiquetas.join('')}</span></div>${extra}</li>`;
}

// Departamentos a los que se pueden pasar tareas en esta sala: los del equipo con su entrada
// en el equipo y sin pausar.
function opcionesDepartamento(proyecto) {
  return datos.departamentos.map((d) => {
    const h = proyecto.habitaciones.find((x) => x.id === d.id);
    const entrada = becario(d.entrada);
    let motivo = '';
    if (!h?.activo) motivo = 'no está en el equipo';
    else if (!h.conEntrada) motivo = `falta ${entrada.nombre} en el equipo`;
    else if (entrada.pausado) motivo = `${entrada.nombre} está en pausa`;
    return { ...d, entradaNombre: entrada.nombre, motivo };
  });
}

// La asignación pasa siempre por el departamento entero: la tarea entra por su entrada (CTO,
// Jefa de QA o Dirección de marketing), en Preparación, y decide quién la coge después.
function abrirAsignar(i) {
  const proyecto = datos.proyectos[i];
  const { libres, enFlujo } = tareasPorHacer(proyecto);
  const opciones = opcionesDepartamento(proyecto);
  const elegible = opciones.find((d) => !d.motivo);
  dialogoAsignar.dataset.indice = i;
  dialogoAsignar.querySelector('[data-titulo]').textContent = `Asignar tareas · ${proyecto.nombre}`;
  dialogoAsignar.querySelector('[data-departamentos-asignar]').innerHTML = opciones.map((d) => `<label class="ritmo${d.motivo ? ' ritmo--apagado' : ''}">
      <input type="radio" name="departamento" value="${escapar(d.id)}"${d.id === elegible?.id ? ' checked' : ''}${d.motivo ? ' disabled' : ''}>
      <strong>${escapar(d.nombre)}</strong><small>${d.motivo ? escapar(`No: ${d.motivo}`) : `Entra por ${escapar(d.entradaNombre)}`}</small></label>`).join('');
  const lanzar = dialogoAsignar.querySelector('input[name="lanzar"]');
  lanzar.checked = false;
  lanzar.disabled = !proyecto.conectado;
  dialogoAsignar.querySelector('[data-ayuda-lanzar]').innerHTML = proyecto.conectado
    ? 'Se abre una sesión de Claude Code por tarea, en tu cuenta y con tu suscripción. Trabajan hasta abrir el PR; lo revisas y fusionas tú.'
    : datos.nube && proyecto.id
      ? 'Para lanzarlas en la nube, conecta tu tarea programada de Claude para esta oficina en <a href="#conexiones" data-cerrar>Conexiones</a>.'
      : 'Lanzar en la nube aún no está disponible en esta oficina.';
  dialogoAsignar.querySelector('[data-nota-lanzar]').hidden = true;
  dialogoAsignar.querySelector('textarea[name="nota"]').value = '';
  dialogoAsignar.querySelector('[data-nota]').innerHTML = !elegible
    ? 'Ningún departamento de esta oficina puede recibir tareas ahora mismo. Revisa el equipo con el botón «Equipo» o reactiva a quien esté en pausa en <a href="#becarios" data-cerrar>Becarios</a>.'
    : libres.length
      ? 'Marca las tareas y elige el departamento. Las recibe su entrada en <strong>Preparación</strong>: hace el plan y decide qué becario sigue. Las que estén en Inbox pasan a «Por hacer».'
      : 'No quedan tareas por hacer fuera de un departamento.';
  const lista = [];
  if (libres.length) {
    lista.push(`<li class="asignar__titulo">Sin departamento · ${libres.length}</li>`);
    lista.push(...libres.map((t) => filaTarea(t, `<input type="checkbox" data-tarea="${escapar(t.id)}" aria-label="Pasar «${escapar(t.titulo)}» al departamento"${elegible ? '' : ' disabled'}>`)));
  }
  if (enFlujo.length) {
    lista.push(`<li class="asignar__titulo">Ya en un departamento · ${enFlujo.length}</li>`);
    lista.push(...enFlujo.map((t) => filaTarea(t, `<span class="asignar__quien">${t.becarios.map((id) => `${sprite(id)}${escapar(becario(id).nombre)}`).join(' ')}${t.fase ? ` · ${escapar(t.fase)}` : ''}</span>`, lanzable(proyecto, t) ? botonLanzar(i, t) : '')));
  }
  dialogoAsignar.querySelector('[data-lista-asignar]').innerHTML = lista.join('');
  dialogoAsignar.querySelector('[data-resultado-asignar]').hidden = true;
  dialogoAsignar.querySelector('[data-error-asignar]').hidden = true;
  contarCambios();
  dialogoAsignar.showModal();
}

const marcadas = () => [...dialogoAsignar.querySelectorAll('input[data-tarea]:checked')].map((c) => c.dataset.tarea);

function contarCambios() {
  const n = marcadas().length;
  const lanzar = dialogoAsignar.querySelector('input[name="lanzar"]').checked;
  const dep = dialogoAsignar.querySelector('input[name="departamento"]:checked');
  dialogoAsignar.querySelector('[data-nota-lanzar]').hidden = !lanzar;
  dialogoAsignar.querySelector('[data-cambios]').textContent = n ? `${n} ${n === 1 ? 'tarea marcada' : 'tareas marcadas'}` : '';
  const boton = dialogoAsignar.querySelector('[data-guardar-asignar]');
  boton.disabled = !n || !dep;
  const destino = dep ? departamento(dep.value).nombre : 'el equipo';
  boton.textContent = `${n ? `Pasar ${n} a ${destino}` : `Pasar a ${destino}`}${lanzar ? ' y lanzar ☁' : ''} →`;
}

const enlaceSesion = (url) => (enlace(url) ? `<a href="${enlace(url)}" target="_blank" rel="noopener">Ver la sesión ↗</a>` : '');

function htmlLanzadas(lanzadas, titulos) {
  return `<p><strong>En marcha en la nube.</strong> Cada tarea tiene su sesión de Claude Code en tu cuenta: puedes seguirla o contestarle desde ahí. Cuando abran el PR, la tarea pasa a «PR y revisión».</p>
    <ul class="lista-tareas">${lanzadas.map((l) => `<li><div class="lista-tareas__fila">${escapar(titulos.get(l.id) || l.id)}${enlaceSesion(l.sesionUrl)}</div>${l.aviso ? `<span>${escapar(l.aviso)}</span>` : ''}</li>`).join('')}</ul>`;
}

async function guardarAsignaciones(e) {
  e.preventDefault();
  const tareas = marcadas();
  const dep = dialogoAsignar.querySelector('input[name="departamento"]:checked')?.value;
  if (!tareas.length || !dep) return;
  const lanzar = dialogoAsignar.querySelector('input[name="lanzar"]').checked;
  const nota = dialogoAsignar.querySelector('textarea[name="nota"]').value.trim();
  const boton = dialogoAsignar.querySelector('[data-guardar-asignar]');
  const error = dialogoAsignar.querySelector('[data-error-asignar]');
  const resultado = dialogoAsignar.querySelector('[data-resultado-asignar]');
  const proyecto = datos.proyectos[Number(dialogoAsignar.dataset.indice)];
  const titulos = new Map(proyecto.sinBecario.map((t) => [t.id, t.titulo]));
  boton.disabled = true;
  error.hidden = true;
  boton.textContent = lanzar ? 'Lanzando…' : 'Pasando…';
  try {
    const { lanzadas } = await api('/api/asignar', { method: 'PUT', body: { tareas, departamento: dep, lanzar, nota } });
    if (lanzadas?.length) {
      resultado.innerHTML = htmlLanzadas(lanzadas, titulos);
      resultado.hidden = false;
      // Hecho: solo queda el resultado con los enlaces a las sesiones.
      dialogoAsignar.classList.add('dialogo--hecho');
      dialogoAsignar.querySelector('[data-cambios]').textContent = '';
      boton.hidden = true;
    } else {
      dialogoAsignar.close();
    }
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
    if (err.datos?.lanzadas?.length) {
      resultado.innerHTML = htmlLanzadas(err.datos.lanzadas, titulos);
      resultado.hidden = false;
    }
    contarCambios();
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
      : 'Producto está siempre. Añade los departamentos que trabajan en esta oficina y elige quién de cada uno. Se guarda en Notion, en la base «Proyectos».';
  const opciones = dialogoEquipo.querySelector('[data-opciones]');
  opciones.innerHTML = datos.departamentos.map((d) => {
    const miembros = datos.becarios.filter((b) => b.departamento === d.id);
    const dentro = miembros.filter((b) => proyecto.equipo.includes(b.id)).length;
    const todos = dentro === miembros.length;
    return `<fieldset class="departamento" data-departamento="${escapar(d.id)}">
      <legend class="departamento__cabeza"><label class="departamento__interruptor">
        <input type="checkbox" data-todo-departamento="${escapar(d.id)}"${todos ? ' checked' : ''}${dentro && !todos ? ' data-medio="1"' : ''}${puedeGuardar ? '' : ' disabled'}>
        <span><strong>${escapar(d.nombre)}</strong><small>${escapar(d.papel)} · entra por ${escapar(becario(d.entrada).nombre)}</small></span></label></legend>
      <div class="departamento__miembros">${miembros.map((b) => `<label class="equipo-opcion">
        <input type="checkbox" name="becario" value="${escapar(b.id)}"${proyecto.equipo.includes(b.id) ? ' checked' : ''}${puedeGuardar ? '' : ' disabled'}>
        ${sprite(b.id, { dormido: b.pausado })}<span><strong>${escapar(b.nombre)}${b.id === d.entrada ? ' · entrada' : ''}${b.pausado ? ' · pausado' : ''}</strong><small>${escapar(b.papel)}</small></span></label>`).join('')}</div></fieldset>`;
  }).join('');
  opciones.querySelectorAll('[data-medio]').forEach((c) => { c.indeterminate = true; });
  dialogoEquipo.querySelector('[data-guardar]').disabled = !puedeGuardar;
  dialogoEquipo.querySelector('[data-error-equipo]').hidden = true;
  dialogoEquipo.showModal();
}

// El interruptor del departamento marca o desmarca a todos; marcar a alguien suelto lo
// deja a medias.
function cambioEquipo(e) {
  const todo = e.target.closest('[data-todo-departamento]');
  const grupo = e.target.closest('[data-departamento]');
  if (!grupo) return;
  const miembros = [...grupo.querySelectorAll('input[name="becario"]')];
  if (todo) {
    miembros.forEach((m) => { m.checked = todo.checked; });
    todo.indeterminate = false;
    return;
  }
  const interruptor = grupo.querySelector('[data-todo-departamento]');
  const marcados = miembros.filter((m) => m.checked).length;
  interruptor.checked = marcados === miembros.length;
  interruptor.indeterminate = marcados > 0 && marcados < miembros.length;
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

// Lanzar una tarea que ya está en un departamento (desde una mesa o desde «Asignar»).
function abrirLanzar(i, tareaId) {
  const proyecto = datos.proyectos[i];
  const tarea = proyecto.puestos.flatMap((pu) => pu.tareas).find((t) => t.id === tareaId);
  if (!tarea) return;
  const dep = departamento(tarea.departamento);
  dialogoLanzar.dataset.indice = i;
  dialogoLanzar.dataset.tarea = tareaId;
  dialogoLanzar.querySelector('[data-titulo]').textContent = `Lanzar en la nube · ${proyecto.nombre}`;
  const enMarcha = tarea.estado === 'En progreso' ? ' <strong>Ya está en progreso</strong>: si la lanzas otra vez, se abre otra sesión que trabaja sobre lo que haya.' : '';
  dialogoLanzar.querySelector('[data-cuerpo-lanzar]').innerHTML = `<p class="dialogo__nota"><strong>${escapar(tarea.titulo)}</strong> · ${escapar(dep.nombre)}, ahora con ${tarea.becarios.map((id) => escapar(becario(id).nombre)).join(', ')}${tarea.fase ? ` en ${escapar(tarea.fase)}` : ''}.</p>
    <p class="dialogo__nota">Se abre una sesión de Claude Code en <strong>tu cuenta</strong> (tu suscripción), con tu tarea programada de ${escapar(proyecto.nombre)}. El equipo de ${escapar(dep.nombre)} trabaja hasta abrir el PR y deja la tarea en «PR y revisión». No fusiona ni despliega a producción.${enMarcha}</p>`;
  dialogoLanzar.querySelector('textarea[name="nota"]').value = '';
  dialogoLanzar.querySelector('[data-error-lanzar]').hidden = true;
  dialogoLanzar.querySelector('[data-resultado-lanzar]').hidden = true;
  const boton = dialogoLanzar.querySelector('[data-confirmar-lanzar]');
  boton.hidden = false;
  boton.disabled = false;
  boton.textContent = 'Lanzar en la nube ☁';
  if (dialogoPuesto.open) dialogoPuesto.close();
  if (dialogoAsignar.open) dialogoAsignar.close();
  dialogoLanzar.showModal();
}

async function confirmarLanzar(e) {
  e.preventDefault();
  const boton = dialogoLanzar.querySelector('[data-confirmar-lanzar]');
  const error = dialogoLanzar.querySelector('[data-error-lanzar]');
  const resultado = dialogoLanzar.querySelector('[data-resultado-lanzar]');
  boton.disabled = true;
  boton.textContent = 'Lanzando…';
  error.hidden = true;
  try {
    const { sesionUrl, aviso } = await api('/api/lanzar', { method: 'POST', body: { tareaId: dialogoLanzar.dataset.tarea, nota: dialogoLanzar.querySelector('textarea[name="nota"]').value.trim() } });
    resultado.innerHTML = `<p><strong>En marcha.</strong> ${enlaceSesion(sesionUrl)}</p>${aviso ? `<p>${escapar(aviso)}</p>` : ''}`;
    resultado.hidden = false;
    boton.hidden = true;
    cargarOficina();
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
    boton.disabled = false;
    boton.textContent = 'Lanzar en la nube ☁';
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
  for (const dialogo of [dialogoPuesto, dialogoEquipo, dialogoAsignar, dialogoLanzar]) {
    dialogo.addEventListener('click', (e) => {
      const lanzar = e.target.closest('[data-lanzar]');
      if (lanzar) {
        const [i, id] = lanzar.dataset.lanzar.split('|');
        return abrirLanzar(Number(i), id);
      }
      if (e.target === dialogo || e.target.closest('[data-cerrar]')) dialogo.close();
    });
  }
  dialogoEquipo.querySelector('[data-form-equipo]').addEventListener('submit', guardarEquipo);
  dialogoEquipo.addEventListener('change', cambioEquipo);
  dialogoAsignar.querySelector('[data-form-asignar]').addEventListener('submit', guardarAsignaciones);
  dialogoAsignar.addEventListener('change', (e) => {
    if (e.target.matches('input[data-tarea], input[name="lanzar"], input[name="departamento"]')) contarCambios();
  });
  dialogoAsignar.addEventListener('close', () => {
    dialogoAsignar.querySelector('[data-guardar-asignar]').hidden = false;
    dialogoAsignar.classList.remove('dialogo--hecho');
  });
  dialogoLanzar.querySelector('[data-form-lanzar]').addEventListener('submit', confirmarLanzar);
  document.querySelector('[data-recargar]').addEventListener('click', cargarOficina);
  document.addEventListener('oficina:recargar', cargarOficina);
  document.addEventListener('peticiones:datos', (e) => {
    const cambia = JSON.stringify(e.detail) !== JSON.stringify(peticiones);
    peticiones = e.detail;
    if (datos && cambia) {
      pintarPestanas();
      pintarSala();
    }
  });
  // Notion cambia mientras los becarios trabajan: se refresca cada minuto si se está mirando.
  setInterval(() => {
    if (document.visibilityState === 'visible' && ![dialogoPuesto, dialogoEquipo, dialogoAsignar, dialogoLanzar].some((d) => d.open)) cargarOficina();
  }, 60_000);
}
