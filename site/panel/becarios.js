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
const dialogo = document.querySelector('[data-dialogo-becario]');
const form = dialogo.querySelector('[data-form-becario]');

let datos = null;
// Oficinas marcadas en la tabla, aún sin guardar: id del proyecto → Set de becarios.
let marcadas = new Map();

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

export async function cargarBecarios() {
  // Si hay cambios sin guardar en la tabla, no se pisan al volver a la pestaña.
  if (datos && proyectosCambiados().length) return;
  fichas.setAttribute('aria-busy', 'true');
  try {
    datos = await api('/api/becarios');
    ponerAvatares(datos.becarios);
    marcadas = new Map(datos.proyectos.map((p) => [p.id, new Set(p.equipo)]));
    avisos.innerHTML = (datos.avisos || []).map((a) => `<div class="aviso"><strong>Notion:</strong> ${escapar(a)}</div>`).join('');
    pintarFichas();
    pintarMatriz();
  } catch (error) {
    avisos.innerHTML = `<div class="aviso"><strong>No se han podido cargar los becarios.</strong> ${escapar(error.message)}</div>`;
    if (!datos) fichas.innerHTML = '';
  } finally {
    fichas.setAttribute('aria-busy', 'false');
  }
}

function pintarFichas() {
  fichas.innerHTML = datos.becarios.map((b) => {
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

function pintarMatriz() {
  if (!datos.proyectos.length) {
    matriz.innerHTML = '<p class="dialogo__nota">No se encuentra la base «Proyectos» de Notion, así que aún no se pueden elegir oficinas.</p>';
    actualizarPie();
    return;
  }
  const cabecera = datos.proyectos.map((p) => `<th scope="col">${escapar(p.nombre)}</th>`).join('');
  const filas = datos.becarios.map((b) => {
    const celdas = datos.proyectos.map((p) => {
      const marcada = marcadas.get(p.id).has(b.id);
      const cambiada = marcada !== p.equipo.includes(b.id);
      return `<td class="${cambiada ? 'cambiada' : ''}"><input type="checkbox" data-celda="${escapar(p.id)}|${escapar(b.id)}"${marcada ? ' checked' : ''}
        aria-label="${escapar(b.nombre)} trabaja en ${escapar(p.nombre)}"></td>`;
    }).join('');
    return `<tr${b.pausado ? ' class="pausado"' : ''}><th scope="row"><span class="matriz__becario">${sprite(b.id, { dormido: b.pausado })}${escapar(b.nombre)}${b.pausado ? '<small>Pausado</small>' : ''}</span></th>${celdas}</tr>`;
  }).join('');
  matriz.innerHTML = `<table><thead><tr><th scope="col"><span class="sr-only">Becario</span></th>${cabecera}</tr></thead><tbody>${filas}</tbody></table>`;
  actualizarPie();
}

function actualizarPie() {
  const n = datos?.proyectos.length ? proyectosCambiados().length : 0;
  cambiosMatriz.textContent = n ? `${n} ${n === 1 ? 'oficina cambiada' : 'oficinas cambiadas'}` : '';
  deshacer.disabled = !n;
  guardarMatriz.disabled = !n;
  const sinCto = (datos?.proyectos || []).filter((p) => !marcadas.get(p.id).has('cto')).map((p) => p.nombre);
  avisoMatriz.hidden = !sinCto.length;
  avisoMatriz.textContent = sinCto.length ? `Sin CTO: ${sinCto.join(', ')}. A esas oficinas no se les pueden pasar tareas.` : '';
}

async function guardarOficinas() {
  const cambiados = proyectosCambiados();
  if (!cambiados.length) return;
  guardarMatriz.disabled = true;
  deshacer.disabled = true;
  errorMatriz.hidden = true;
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
  pintarMatriz();
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
  dialogo.querySelector('[data-ayuda-pausa]').textContent = id === 'cto'
    ? 'Las tareas entran por el CTO: si lo pausas, no se le pueden pasar tareas a ninguna oficina.'
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
    actualizarPie();
  });
  deshacer.addEventListener('click', () => {
    marcadas = new Map(datos.proyectos.map((p) => [p.id, new Set(p.equipo)]));
    errorMatriz.hidden = true;
    pintarMatriz();
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
}
