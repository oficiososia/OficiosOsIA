// Pestaña «Conexiones»: la tarea programada de Claude Code de quien está en el panel, una por
// proyecto. Aquí se pega la URL del disparador por API y su token; el servidor lo guarda cifrado
// y nunca lo devuelve. Con ella, las tareas se lanzan en la nube con la suscripción de cada uno.
import { api, enlace, escapar } from './util.js';

const PROMPT = 'https://raw.githubusercontent.com/oficiososia/becarios/HEAD/plugins/oficina/rutina/prompt.md';
const vista = document.querySelector('[data-vista="conexiones"]');
const lista = vista.querySelector('[data-conexiones]');
const avisos = vista.querySelector('[data-avisos-conexiones]');
const copiado = vista.querySelector('[data-prompt-copiado]');

let datos = null;
let cargando = false;

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const repoCorto = (url) => String(url || '').replace(/^https?:\/\/(www\.)?github\.com\//i, '');
// Mientras se escribe en un formulario no se repinta (se perdería lo escrito).
const ocupada = () => [...lista.querySelectorAll('input')].some((c) => c.value && c.type !== 'hidden');

function htmlProyecto(p) {
  const c = p.conexion;
  const estado = c
    ? `<span class="estado estado--activo">Conectada</span>`
    : '<span class="estado estado--pausado">Sin conectar</span>';
  const detalle = c
    ? `<p class="conexion__detalle">Token ${escapar(c.pista)} · guardada el ${escapar(fecha(c.actualizada))}<br><code>${escapar(c.disparador.replace('https://api.anthropic.com/v1/claude_code/routines/', '…/'))}</code></p>`
    : `<p class="conexion__detalle">Aún no puedes lanzar sus tareas en la nube.${p.repo ? '' : ' <strong>Ojo:</strong> este proyecto no tiene «Repositorio» en Notion y la sesión no sabría dónde trabajar.'}</p>`;
  return `<li class="conexion" data-proyecto="${escapar(p.id)}">
    <div class="conexion__cabeza"><div><h2 class="conexion__nombre">${escapar(p.nombre)}</h2>
      ${enlace(p.repo) ? `<a class="conexion__repo" href="${enlace(p.repo)}" target="_blank" rel="noopener">${escapar(repoCorto(p.repo))}</a>` : ''}</div>${estado}</div>
    ${detalle}
    <form class="conexion__form" data-form-conexion>
      <label class="campo">URL del disparador<input name="disparador" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://api.anthropic.com/v1/claude_code/routines/trig_…/fire" required${datos.guardable ? '' : ' disabled'}></label>
      <label class="campo">Token<input name="token" type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-oat01-…" required${datos.guardable ? '' : ' disabled'}></label>
      <p class="error" data-error-conexion role="alert" hidden></p>
      <div class="conexion__botones">
        ${c ? '<button type="button" class="btn btn--ghost" data-borrar-conexion>Quitar</button>' : ''}
        <button type="submit" class="btn btn--amber"${datos.guardable ? '' : ' disabled'}>${c ? 'Cambiar' : 'Guardar'}</button>
      </div>
    </form></li>`;
}

function pintar() {
  avisos.innerHTML = (datos.avisos || []).map((a) => `<div class="aviso">${escapar(a)}</div>`).join('');
  lista.innerHTML = datos.proyectos.length
    ? datos.proyectos.map(htmlProyecto).join('')
    : '<li class="cargando">No hay proyectos en la base «Proyectos» de Notion.</li>';
}

export async function cargarConexiones() {
  if (cargando || (datos && ocupada())) return;
  cargando = true;
  lista.setAttribute('aria-busy', 'true');
  try {
    datos = await api('/api/conexiones');
    pintar();
  } catch (error) {
    avisos.innerHTML = `<div class="aviso"><strong>No se pueden leer tus conexiones.</strong> ${escapar(error.message)}</div>`;
    if (!datos) lista.innerHTML = '';
  } finally {
    cargando = false;
    lista.setAttribute('aria-busy', 'false');
  }
}

async function guardar(e) {
  const form = e.target.closest('[data-form-conexion]');
  if (!form) return;
  e.preventDefault();
  const item = form.closest('[data-proyecto]');
  const error = form.querySelector('[data-error-conexion]');
  const boton = form.querySelector('button[type="submit"]');
  error.hidden = true;
  boton.disabled = true;
  try {
    const { conexion } = await api('/api/conexiones', {
      method: 'PUT',
      body: { proyectoId: item.dataset.proyecto, disparador: form.elements.disparador.value, token: form.elements.token.value },
    });
    datos.proyectos = datos.proyectos.map((p) => (p.id === item.dataset.proyecto ? { ...p, conexion } : p));
    form.reset();
    pintar();
    document.dispatchEvent(new CustomEvent('oficina:recargar'));
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
    boton.disabled = false;
  }
}

async function borrar(e) {
  const boton = e.target.closest('[data-borrar-conexion]');
  if (!boton) return;
  const item = boton.closest('[data-proyecto]');
  const proyecto = datos.proyectos.find((p) => p.id === item.dataset.proyecto);
  if (!confirm(`¿Quitar tu conexión con ${proyecto.nombre}? Sus tareas dejarán de poder lanzarse en la nube con tu suscripción hasta que la vuelvas a poner.`)) return;
  const error = item.querySelector('[data-error-conexion]');
  boton.disabled = true;
  try {
    await api('/api/conexiones', { method: 'DELETE', body: { proyectoId: proyecto.id } });
    datos.proyectos = datos.proyectos.map((p) => (p.id === proyecto.id ? { ...p, conexion: null } : p));
    pintar();
    document.dispatchEvent(new CustomEvent('oficina:recargar'));
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
    boton.disabled = false;
  }
}

async function copiarPrompt() {
  copiado.hidden = false;
  try {
    const respuesta = await fetch(PROMPT, { cache: 'no-store' });
    if (!respuesta.ok) throw new Error(String(respuesta.status));
    // El fichero explica cómo usarlo; lo que se pega es solo el bloque de texto.
    const texto = await respuesta.text();
    const bloque = texto.match(/```text\n([\s\S]*?)\n```/);
    await navigator.clipboard.writeText(bloque ? bloque[1] : texto);
    copiado.textContent = 'Prompt copiado. Pégalo en las instrucciones de tu tarea programada.';
  } catch {
    copiado.innerHTML = `No se ha podido copiar. Ábrelo en <a href="${escapar(PROMPT)}" target="_blank" rel="noopener">GitHub</a> y cópialo de ahí.`;
  }
}

export function iniciarConexiones() {
  lista.addEventListener('submit', guardar);
  lista.addEventListener('click', borrar);
  vista.querySelector('[data-copiar-prompt]').addEventListener('click', copiarPrompt);
}
