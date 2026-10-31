// Pestaña «Becarios»: la ficha de cada becario (nombre, papel, avatar, instrucciones y pausa,
// en la base «Becarios» de Notion) y en qué oficinas trabaja (base «Proyectos»).
import { ACCESORIOS, PEINADOS, ponerAvatares, sprite, spriteAvatar } from './sprites.js';
import { api, escapar } from './util.js';

const vista = document.querySelector('[data-vista="becarios"]');
const fichas = vista.querySelector('[data-fichas]');
const avisos = vista.querySelector('[data-avisos-becarios]');
const matriz = vista.querySelector('[data-matriz]');
const avisoMatriz = vista.querySelector('[data-matriz-aviso]');
const errorMatriz = vista.querySelector('[data-error-matriz]');
const cambiosMatriz = vista.querySelector('[data-cambios-matriz]');
const deshacer = vista.querySelector('[data-deshacer-matriz]');
const guardarMatriz = vista.querySelector('[data-guardar-matriz]');
const equipos = vista.querySelector('[data-equipos]');
const pieOficinas = vista.querySelector('[data-pie-oficinas]');
const subpestanas = vista.querySelector('[data-subpestanas-becarios]');
const numCambios = vista.querySelector('[data-num-cambios]');
const SUBPESTANAS = ['fichas', 'equipos', 'detalle'];
const CLAVE_SUB = 'panel-becarios';
const CLAVE_DEP = 'panel-becarios-departamento';
const filtroDep = vista.querySelector('[data-filtro-becarios]');
// En Fichas y «Becario a becario» se ve un departamento cada vez (o todos), para no hacer scroll.
let departamentoVisto = (() => { try { return localStorage.getItem(CLAVE_DEP) || 'desarrollo'; } catch { return 'desarrollo'; } })();
const dialogo = document.querySelector('[data-dialogo-becario]');
const form = dialogo.querySelector('[data-form-becario]');

let datos = null;
// Oficinas marcadas en la tabla, aún sin guardar: id del proyecto → Set de becarios.
let marcadas = new Map();
let cargando = false;
// Sube con cada cambio que se guarda desde aquí: una carga que salió antes trae datos viejos y se descarta.
let version = 0;

const nombreAccesorio = { gafas: 'Gafas', cascos: 'Cascos', barba: 'Barba', corbata: 'Corbata', placa: 'Placa' };
const nombrePeinado = { corto: 'Corto', largo: 'Largo', rizado: 'Rizado', mono: 'Moño', gorra: 'Gorra', gorro: 'Gorro' };

// Modelo y esfuerzo con que se lanza cada becario. Vacío: lo que diga su fichero del plugin.
const MODELOS = { haiku: 'Haiku', sonnet: 'Sonnet', opus: 'Opus', fable: 'Fable' };
const USO_MODELO = { haiku: 'rápido, para tareas sencillas', sonnet: 'el del día a día', opus: 'para razonar lo complejo', fable: 'para lo más difícil y largo' };
const ESFUERZOS = { low: 'bajo', medium: 'medio', high: 'alto', xhigh: 'muy alto', max: 'máximo' };
const RITMOS = {
  defecto: { modelo: null, esfuerzo: null },
  rapido: { modelo: 'haiku', esfuerzo: 'low', nombre: 'Rápido' },
  equilibrado: { modelo: 'sonnet', esfuerzo: 'medium', nombre: 'Equilibrado' },
  fondo: { modelo: 'opus', esfuerzo: 'high', nombre: 'A fondo' },
};
const ritmoDe = (modelo, esfuerzo) => Object.keys(RITMOS).find((r) => RITMOS[r].modelo === modelo && RITMOS[r].esfuerzo === esfuerzo) || null;
const textoEsfuerzo = (esfuerzo) => (esfuerzo ? `esfuerzo ${ESFUERZOS[esfuerzo]}` : 'esfuerzo de la sesión');

// Lo que usará de verdad: lo elegido en el panel o, si no, lo del plugin.
function comoTrabaja(b) {
  const modelo = b.modelo || b.plugin?.modelo;
  const esfuerzo = b.esfuerzo || b.plugin?.esfuerzo;
  const ritmo = RITMOS[ritmoDe(b.modelo, b.esfuerzo)]?.nombre;
  return `${ritmo ? `${ritmo} · ` : ''}${MODELOS[modelo] || 'Modelo de la sesión'} · ${textoEsfuerzo(esfuerzo)}`;
}

const iguales = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
const proyectosCambiados = () => datos.proyectos.filter((p) => !iguales(new Set(p.equipo), marcadas.get(p.id)));

// No se pisa lo que se está tocando: una ficha abierta o cambios sin guardar en la tabla.
const ocupada = () => dialogo.open || Boolean(datos && proyectosCambiados().length);

export async function cargarBecarios() {
  if (cargando || ocupada()) return;
  cargando = true;
  const desde = version;
  fichas.setAttribute('aria-busy', 'true');
  try {
    const nuevos = await api('/api/becarios');
    // Mientras llegaba se ha podido empezar a editar o guardar algo: entonces se descarta.
    if (desde !== version || ocupada()) return;
    avisos.innerHTML = (nuevos.avisos || []).map((a) => `<div class="aviso"><strong>Notion:</strong> ${escapar(a)}</div>`).join('');
    // Si en Notion no ha cambiado nada, no se repinta: así no se pierde el foco ni la posición en la tabla.
    if (datos && JSON.stringify(nuevos) === JSON.stringify(datos)) return;
    datos = nuevos;
    ponerAvatares(datos.becarios);
    marcadas = new Map(datos.proyectos.map((p) => [p.id, new Set(p.equipo)]));
    pintarFichas();
    pintarOficinas();
  } catch (error) {
    avisos.innerHTML = `<div class="aviso"><strong>No se han podido cargar los becarios.</strong> ${escapar(error.message)}</div>`;
    if (!datos) fichas.innerHTML = '';
  } finally {
    cargando = false;
    fichas.setAttribute('aria-busy', 'false');
  }
}

// Departamentos en el orden del panel, con sus becarios: el elegido en el filtro o todos.
const todosLosDepartamentos = () => (datos.departamentos || [{ id: null, nombre: 'Becarios' }]).map((d) => ({
  ...d,
  becarios: datos.becarios.filter((b) => !d.id || b.departamento === d.id),
})).filter((d) => d.becarios.length);
const porDepartamento = () => {
  const lista = todosLosDepartamentos();
  const elegido = lista.filter((d) => d.id === departamentoVisto);
  return departamentoVisto === 'todos' || !elegido.length ? lista : elegido;
};

function pintarFiltro() {
  const lista = todosLosDepartamentos();
  if (lista.length < 2) { filtroDep.innerHTML = ''; return; }
  const visto = departamentoVisto === 'todos' || lista.some((d) => d.id === departamentoVisto) ? departamentoVisto : 'todos';
  const boton = (id, texto, n) => `<button type="button" class="filtro-departamentos__boton" data-ver-departamento="${escapar(id)}" aria-pressed="${visto === id}">${escapar(texto)}<span>${n}</span></button>`;
  filtroDep.innerHTML = lista.map((d) => boton(d.id, d.nombre, d.becarios.length)).join('') + boton('todos', 'Todos', datos.becarios.length);
}

function pintarFichas() {
  pintarFiltro();
  fichas.innerHTML = porDepartamento().map((d) => `<li class="fichas__grupo"><h2>${escapar(d.nombre)}</h2>${d.papel ? `<p>${escapar(d.papel)}</p>` : ''}</li>${htmlFichas(d.becarios)}`).join('');
}

function htmlFichas(becarios) {
  return becarios.map((b) => {
    const oficinas = datos.proyectos.filter((p) => p.equipo.includes(b.id)).length;
    const etiquetas = [
      `<span class="etiqueta${b.modelo || b.esfuerzo ? ' etiqueta--elegida' : ''}" title="Modelo y esfuerzo">${escapar(comoTrabaja(b))}</span>`,
      `<span class="etiqueta">${oficinas} ${oficinas === 1 ? 'oficina' : 'oficinas'}</span>`,
      b.instrucciones ? '<span class="etiqueta">Con instrucciones</span>' : '',
    ].join('');
    return `<li class="ficha${b.pausado ? ' ficha--pausada' : ''}">
      <div class="ficha__cabeza">${sprite(b.id, { dormido: b.pausado })}
        <div><h2 class="ficha__nombre">${escapar(b.nombre)}</h2><p class="ficha__id">${escapar(b.id)}</p></div>
        <span class="estado ${b.pausado ? 'estado--pausado' : 'estado--activo'}">${b.pausado ? 'Pausado' : 'Activo'}</span></div>
      <p class="ficha__papel">${escapar(b.papel)}</p>
      <div class="etiquetas">${etiquetas}</div>
      <button type="button" class="btn btn--ghost ficha__boton" data-editar="${escapar(b.id)}">Configurar</button></li>`;
  }).join('');
}

// Las dos tablas de oficinas (por equipos y becario a becario) comparten lo marcado sin guardar.
function pintarOficinas() {
  pintarEquipos();
  pintarMatriz();
}

const miembros = (dep) => datos.becarios.filter((b) => b.departamento === dep).map((b) => b.id);

// Oficinas × departamentos: cada casilla mete o saca a todo el departamento. A medias si solo
// están algunos de sus becarios.
function pintarEquipos() {
  if (!datos.proyectos.length) {
    equipos.innerHTML = '<p class="dialogo__nota">No se encuentra la base «Proyectos» de Notion, así que aún no se pueden elegir equipos.</p>';
    return;
  }
  const deps = datos.departamentos || [];
  const cabecera = `<th scope="col"><span class="sr-only">Oficina</span></th><th scope="col">Producto</th>${deps.map((d) => `<th scope="col">${escapar(d.nombre)}</th>`).join('')}`;
  const filas = datos.proyectos.map((p) => {
    const marcados = marcadas.get(p.id);
    const celdas = deps.map((d) => {
      const suyos = miembros(d.id);
      const dentro = suyos.filter((id) => marcados.has(id)).length;
      const antes = suyos.filter((id) => p.equipo.includes(id)).length;
      const todos = dentro === suyos.length && dentro > 0;
      return `<td class="${dentro !== antes ? 'cambiada' : ''}"><label class="celda-equipo">
        <input type="checkbox" data-equipo-celda="${escapar(p.id)}|${escapar(d.id)}"${todos ? ' checked' : ''}${dentro && !todos ? ' data-medio="1"' : ''}
          aria-label="${escapar(d.nombre)} en ${escapar(p.nombre)}${dentro && !todos ? ` (${dentro} de ${suyos.length})` : ''}">
        <span class="celda-equipo__num">${dentro}/${suyos.length}</span></label></td>`;
    }).join('');
    return `<tr><th scope="row">${escapar(p.nombre)}</th><td class="celda-fija" title="Producto está siempre en todas las oficinas"><span aria-hidden="true">✓</span><span class="sr-only">Siempre</span></td>${celdas}</tr>`;
  }).join('');
  equipos.innerHTML = `<table class="tabla-equipos"><thead><tr>${cabecera}</tr></thead><tbody>${filas}</tbody></table>`;
  equipos.querySelectorAll('[data-medio]').forEach((c) => { c.indeterminate = true; });
}

// La subpestaña sale del enlace (#becarios/equipos) o de la última que se usó.
function leerSub() {
  const [vistaHash, sub] = location.hash.slice(1).split('/');
  if (vistaHash === 'becarios' && SUBPESTANAS.includes(sub)) return sub;
  try { return SUBPESTANAS.includes(localStorage.getItem(CLAVE_SUB)) ? localStorage.getItem(CLAVE_SUB) : 'fichas'; } catch { return 'fichas'; }
}

export function mostrarSubBecarios(sub = leerSub(), enfocar = false) {
  subpestanas.querySelectorAll('[data-sub-becarios]').forEach((b) => {
    const activa = b.dataset.subBecarios === sub;
    b.setAttribute('aria-selected', String(activa));
    b.tabIndex = activa ? 0 : -1;
    if (activa && enfocar) b.focus();
  });
  vista.querySelectorAll('[data-subpanel-becarios]').forEach((panel) => { panel.hidden = panel.dataset.subpanelBecarios !== sub; });
  // El filtro por departamento sirve para Fichas y «Becario a becario», no para la tabla de equipos.
  filtroDep.hidden = sub === 'equipos';
  // Guardar y deshacer valen para las dos tablas de oficinas.
  pieOficinas.hidden = sub === 'fichas';
  try { localStorage.setItem(CLAVE_SUB, sub); } catch {}
  if (location.hash.slice(1).split('/')[0] === 'becarios') history.replaceState(null, '', `#becarios/${sub}`);
}

function pintarMatriz() {
  if (!datos.proyectos.length) {
    matriz.innerHTML = '<p class="dialogo__nota">No se encuentra la base «Proyectos» de Notion, así que aún no se pueden elegir oficinas.</p>';
    actualizarPie();
    return;
  }
  const cabecera = datos.proyectos.map((p) => `<th scope="col">${escapar(p.nombre)}</th>`).join('');
  const fila = (b) => {
    const celdas = datos.proyectos.map((p) => {
      const marcada = marcadas.get(p.id).has(b.id);
      const cambiada = marcada !== p.equipo.includes(b.id);
      return `<td class="${cambiada ? 'cambiada' : ''}"><input type="checkbox" data-celda="${escapar(p.id)}|${escapar(b.id)}"${marcada ? ' checked' : ''}
        aria-label="${escapar(b.nombre)} trabaja en ${escapar(p.nombre)}"></td>`;
    }).join('');
    return `<tr${b.pausado ? ' class="pausado"' : ''}><th scope="row"><span class="matriz__becario">${sprite(b.id, { dormido: b.pausado })}${escapar(b.nombre)}${b.pausado ? '<small>Pausado</small>' : ''}</span></th>${celdas}</tr>`;
  };
  const filas = porDepartamento().map((d) => `<tr class="matriz__grupo"><th scope="rowgroup" colspan="${datos.proyectos.length + 1}">${escapar(d.nombre)}</th></tr>${d.becarios.map(fila).join('')}`).join('');
  matriz.innerHTML = `<table><thead><tr><th scope="col"><span class="sr-only">Becario</span></th>${cabecera}</tr></thead><tbody>${filas}</tbody></table>`;
  actualizarPie();
}

function actualizarPie() {
  const n = datos?.proyectos.length ? proyectosCambiados().length : 0;
  numCambios.hidden = !n;
  numCambios.textContent = n || '';
  numCambios.title = n ? 'Oficinas con cambios sin guardar' : '';
  cambiosMatriz.textContent = n ? `${n} ${n === 1 ? 'oficina cambiada' : 'oficinas cambiadas'}` : '';
  deshacer.disabled = !n;
  guardarMatriz.disabled = !n;
  // Un departamento con gente pero sin su entrada no puede recibir tareas.
  const sinEntrada = [];
  for (const p of datos?.proyectos || []) {
    const marcados = marcadas.get(p.id);
    for (const d of datos.departamentos || []) {
      const conGente = datos.becarios.some((b) => b.departamento === d.id && marcados.has(b.id));
      if (conGente && !marcados.has(d.entrada)) sinEntrada.push(`${p.nombre} (${d.nombre})`);
    }
  }
  avisoMatriz.hidden = !sinEntrada.length;
  avisoMatriz.textContent = sinEntrada.length ? `Sin su entrada: ${sinEntrada.join(', ')}. A esos departamentos no se les pueden pasar tareas.` : '';
}

async function guardarOficinas() {
  const cambiados = proyectosCambiados();
  if (!cambiados.length) return;
  guardarMatriz.disabled = true;
  deshacer.disabled = true;
  errorMatriz.hidden = true;
  version++;
  let hechos = 0;
  try {
    // De uno en uno: Notion limita a unas 3 peticiones por segundo.
    for (const p of cambiados) {
      const equipo = datos.becarios.map((b) => b.id).filter((id) => marcadas.get(p.id).has(id));
      await api('/api/equipos', { method: 'PUT', body: { proyectoId: p.id, equipo } });
      p.equipo = equipo;
      hechos++;
    }
  } catch (error) {
    errorMatriz.textContent = `Se han guardado ${hechos} de ${cambiados.length}. ${error.message}`;
    errorMatriz.hidden = false;
  }
  pintarFichas();
  pintarOficinas();
  document.dispatchEvent(new CustomEvent('oficina:recargar'));
}

// Editor de un becario

const leerAvatar = () => ({
  peinado: form.querySelector('input[name="peinado"]:checked')?.value || 'corto',
  accesorios: [...form.querySelectorAll('input[name="accesorio"]:checked')].map((c) => c.value),
  piel: form.elements.piel.value,
  pelo: form.elements.pelo.value,
  ropa: form.elements.ropa.value,
  detalle: form.elements.detalle.value,
});

// Cada opción enseña el becario con esa opción puesta, con sus colores actuales.
function pintarOpciones(avatar) {
  dialogo.querySelector('[data-peinados]').innerHTML = PEINADOS.map((p) => `<label class="opcion-avatar">
    <input type="radio" name="peinado" value="${p}"${avatar.peinado === p ? ' checked' : ''}>${spriteAvatar({ ...avatar, peinado: p })}<span>${nombrePeinado[p]}</span></label>`).join('');
  dialogo.querySelector('[data-accesorios]').innerHTML = ACCESORIOS.map((a) => {
    const puesto = avatar.accesorios.includes(a);
    const muestra = { ...avatar, accesorios: puesto ? avatar.accesorios : [...avatar.accesorios, a] };
    return `<label class="opcion-avatar">
      <input type="checkbox" name="accesorio" value="${a}"${puesto ? ' checked' : ''}>${spriteAvatar(muestra)}<span>${nombreAccesorio[a]}</span></label>`;
  }).join('');
}

function refrescarVista({ opciones = false } = {}) {
  const avatar = leerAvatar();
  dialogo.querySelector('[data-vista-previa]').innerHTML = spriteAvatar(avatar, { dormido: form.elements.pausado.checked });
  dialogo.querySelector('[data-vista-nombre]').textContent = form.elements.nombre.value.trim() || '—';
  dialogo.querySelector('[data-contador]').textContent = `${form.elements.instrucciones.value.length} / 6000`;
  if (opciones) {
    // Al repintar las opciones se pierde el foco: se devuelve a la que se estaba usando.
    const activo = document.activeElement;
    const clave = activo?.name ? `${activo.name}:${activo.value}` : null;
    pintarOpciones(avatar);
    if (clave) form.querySelector(`input[name="${clave.split(':')[0]}"][value="${clave.split(':')[1]}"]`)?.focus();
  }
}

function abrirEditor(id) {
  const b = datos.becarios.find((x) => x.id === id);
  dialogo.dataset.becario = id;
  dialogo.querySelector('[data-titulo]').textContent = `Configurar · ${b.nombre}`;
  form.elements.nombre.value = b.nombre;
  form.elements.papel.value = b.papel;
  form.elements.pausado.checked = b.pausado;
  form.elements.instrucciones.value = b.instrucciones;
  for (const c of ['piel', 'pelo', 'ropa', 'detalle']) form.elements[c].value = b.avatar[c];
  const plugin = b.plugin || { modelo: null, esfuerzo: null };
  form.elements.modelo.innerHTML = `<option value="">Como en el plugin (${MODELOS[plugin.modelo] || 'el de la sesión'})</option>`
    + Object.entries(MODELOS).map(([id, nombre]) => `<option value="${id}">${nombre} — ${USO_MODELO[id]}</option>`).join('');
  form.elements.esfuerzo.innerHTML = `<option value="">Como en el plugin (${plugin.esfuerzo ? ESFUERZOS[plugin.esfuerzo] : 'el de la sesión'})</option>`
    + Object.entries(ESFUERZOS).map(([id, nombre]) => `<option value="${id}">${nombre[0].toUpperCase()}${nombre.slice(1)}</option>`).join('');
  form.elements.modelo.value = b.modelo || '';
  form.elements.esfuerzo.value = b.esfuerzo || '';
  dialogo.querySelector('[data-ritmo-defecto]').textContent = `${MODELOS[plugin.modelo] || 'Modelo de la sesión'} · ${textoEsfuerzo(plugin.esfuerzo)}`;
  marcarRitmo();
  const entradaDe = (datos.departamentos || []).find((d) => d.entrada === id);
  dialogo.querySelector('[data-ayuda-pausa]').textContent = entradaDe
    ? `Las tareas de ${entradaDe.nombre} entran por su mesa: si lo pausas, no se le pueden pasar tareas de ${entradaDe.nombre} a ninguna oficina.`
    : 'No sale en las oficinas (salvo donde aún tenga tareas abiertas) y no se pone a trabajar.';
  const nota = dialogo.querySelector('[data-nota]');
  nota.hidden = datos.fichasGuardables;
  nota.textContent = datos.fichasGuardables ? '' : 'El panel no puede leer la base «Becarios» de Notion: puedes probar cambios, pero no guardarlos.';
  dialogo.querySelector('[data-guardar-becario]').disabled = !datos.fichasGuardables;
  dialogo.querySelector('[data-error-becario]').hidden = true;
  pintarOpciones(b.avatar);
  refrescarVista();
  dialogo.showModal();
}

// Los atajos (Rápido, Equilibrado, A fondo) rellenan modelo y esfuerzo; si se cambian a mano
// y no coinciden con ninguno, no queda ninguno marcado.
function marcarRitmo() {
  const ritmo = ritmoDe(form.elements.modelo.value || null, form.elements.esfuerzo.value || null);
  form.querySelectorAll('input[name="ritmo"]').forEach((r) => { r.checked = r.value === ritmo; });
}

function elegirRitmo(ritmo) {
  form.elements.modelo.value = RITMOS[ritmo].modelo || '';
  form.elements.esfuerzo.value = RITMOS[ritmo].esfuerzo || '';
}

async function guardarBecario(e) {
  e.preventDefault();
  const boton = dialogo.querySelector('[data-guardar-becario]');
  const error = dialogo.querySelector('[data-error-becario]');
  const cuerpo = {
    id: dialogo.dataset.becario,
    nombre: form.elements.nombre.value,
    papel: form.elements.papel.value,
    pausado: form.elements.pausado.checked,
    instrucciones: form.elements.instrucciones.value,
    modelo: form.elements.modelo.value || null,
    esfuerzo: form.elements.esfuerzo.value || null,
    avatar: leerAvatar(),
  };
  boton.disabled = true;
  error.hidden = true;
  try {
    const { becario } = await api('/api/becarios', { method: 'PUT', body: cuerpo });
    version++;
    datos.becarios = datos.becarios.map((b) => (b.id === becario.id ? becario : b));
    ponerAvatares(datos.becarios);
    dialogo.close();
    pintarFichas();
    pintarMatriz();
    document.dispatchEvent(new CustomEvent('oficina:recargar'));
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
  } finally {
    boton.disabled = false;
  }
}

export function iniciarBecarios() {
  fichas.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-editar]');
    if (boton) abrirEditor(boton.dataset.editar);
  });
  matriz.addEventListener('change', (e) => {
    const celda = e.target.closest('[data-celda]');
    if (!celda) return;
    const [proyecto, becario] = celda.dataset.celda.split('|');
    const conjunto = marcadas.get(proyecto);
    if (celda.checked) conjunto.add(becario);
    else conjunto.delete(becario);
    const original = datos.proyectos.find((p) => p.id === proyecto).equipo.includes(becario);
    celda.parentElement.classList.toggle('cambiada', celda.checked !== original);
    pintarEquipos();
    actualizarPie();
  });
  equipos.addEventListener('change', (e) => {
    const celda = e.target.closest('[data-equipo-celda]');
    if (!celda) return;
    const [proyecto, dep] = celda.dataset.equipoCelda.split('|');
    const conjunto = marcadas.get(proyecto);
    for (const id of miembros(dep)) {
      if (celda.checked) conjunto.add(id);
      else conjunto.delete(id);
    }
    pintarOficinas();
    actualizarPie();
    equipos.querySelector(`[data-equipo-celda="${CSS.escape(celda.dataset.equipoCelda)}"]`)?.focus();
  });
  filtroDep.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-ver-departamento]');
    if (!boton) return;
    departamentoVisto = boton.dataset.verDepartamento;
    try { localStorage.setItem(CLAVE_DEP, departamentoVisto); } catch {}
    pintarFichas();
    pintarMatriz();
    filtroDep.querySelector(`[data-ver-departamento="${CSS.escape(departamentoVisto)}"]`)?.focus();
  });
  subpestanas.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-sub-becarios]');
    if (boton) mostrarSubBecarios(boton.dataset.subBecarios, true);
  });
  subpestanas.addEventListener('keydown', (e) => {
    const actual = SUBPESTANAS.indexOf(subpestanas.querySelector('[aria-selected="true"]')?.dataset.subBecarios);
    const paso = { ArrowRight: 1, ArrowLeft: -1, Home: -actual, End: SUBPESTANAS.length - 1 - actual }[e.key];
    if (paso === undefined) return;
    e.preventDefault();
    mostrarSubBecarios(SUBPESTANAS[(actual + paso + SUBPESTANAS.length) % SUBPESTANAS.length], true);
  });
  deshacer.addEventListener('click', () => {
    marcadas = new Map(datos.proyectos.map((p) => [p.id, new Set(p.equipo)]));
    errorMatriz.hidden = true;
    pintarOficinas();
  });
  guardarMatriz.addEventListener('click', guardarOficinas);
  form.addEventListener('submit', guardarBecario);
  form.addEventListener('input', (e) => {
    if (e.target.name === 'ritmo') return elegirRitmo(e.target.value);
    if (e.target.name === 'modelo' || e.target.name === 'esfuerzo') return marcarRitmo();
    refrescarVista({ opciones: ['piel', 'pelo', 'ropa', 'detalle', 'peinado', 'accesorio'].includes(e.target.name) });
  });
  dialogo.addEventListener('click', (e) => {
    if (e.target === dialogo || e.target.closest('[data-cerrar]')) dialogo.close();
  });
  // Se refresca con la oficina (cada minuto), pero solo mientras se está mirando.
  document.addEventListener('oficina:datos', () => {
    if (!vista.hidden) cargarBecarios();
  });
}
