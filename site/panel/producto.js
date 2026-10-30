// Equipo de producto: petición en texto plano → PO → PM → CTO → revisión → tareas en Notion.
import { sprite } from './sprites.js';
import { api, enlace, escapar } from './util.js';

const ROLES = [
  { id: 'po', nombre: 'Product Owner', papel: 'Historias y criterios de aceptación', pensando: 'Escribiendo las historias…' },
  { id: 'pm', nombre: 'Project Manager', papel: 'Prioridad, tiempos y orden', pensando: 'Planificando…' },
  { id: 'cto', nombre: 'CTO', papel: 'Plan técnico y becarios', pensando: 'Preparando el plan técnico…' },
];
const PRIORIDADES = ['Alta', 'Media', 'Baja'];
const TIPOS = ['Profunda', 'Rápida', 'Administrativa'];

const form = document.querySelector('[data-peticion]');
const selector = form.elements.proyecto;
const errorPeticion = document.querySelector('[data-error-peticion]');
const roles = document.querySelector('[data-roles]');
const preguntas = document.querySelector('[data-preguntas]');
const tickets = document.querySelector('[data-tickets]');

let proyectos = [];
let becarios = [];
let trabajo = null;
const estados = {};

function pintarRoles() {
  roles.innerHTML = ROLES.map((r) => {
    const e = estados[r.id] || { estado: 'espera', texto: '' };
    const etiqueta = { espera: 'En espera', pensando: 'Trabajando', listo: 'Listo', error: 'Atascado' }[e.estado];
    const reintentar = e.estado === 'error' ? `<button type="button" class="boton-texto" data-reintentar="${r.id}">Reintentar desde aquí</button>` : '';
    return `<li class="rol rol--${e.estado}">
      <div class="rol__cabeza">${sprite(r.id)}<div><p class="rol__nombre">${r.nombre}</p><p class="rol__papel">${r.papel}</p></div></div>
      <span class="rol__estado">${etiqueta}</span>
      ${e.texto ? `<p class="rol__texto">${escapar(e.texto)}</p>` : ''}${reintentar}</li>`;
  }).join('');
}

function marcar(id, estado, texto = '') {
  estados[id] = { estado, texto };
  pintarRoles();
}

function resumenDe(paso, r) {
  if (paso === 'po') {
    const n = r.historias.length;
    return `${n} ${n === 1 ? 'historia' : 'historias'}: ${r.historias.map((h) => `«${h.titulo}»`).join(', ')}.`;
  }
  if (paso === 'pm') return r.resumen;
  return r.comentario;
}

function ocupado(si) {
  form.querySelector('button[type="submit"]').disabled = si;
  document.dispatchEvent(new CustomEvent('producto:trabajando', { detail: si }));
}

async function ejecutar(desde) {
  const pasos = ROLES.map((r) => r.id);
  ocupado(true);
  for (const paso of pasos.slice(pasos.indexOf(desde))) {
    marcar(paso, 'pensando', ROLES.find((r) => r.id === paso).pensando);
    try {
      const r = await api('/api/equipo-producto', {
        method: 'POST',
        body: { paso, peticion: trabajo.peticion, proyecto: trabajo.proyecto, historias: trabajo.historias, planificacion: trabajo.planificacion },
      });
      if (paso === 'po') {
        trabajo.historias = r.resultado.historias;
        trabajo.preguntas = r.resultado.preguntas;
        pintarPreguntas();
      }
      if (paso === 'pm') trabajo.planificacion = r.resultado.planificacion;
      if (paso === 'cto') trabajo.tickets = r.tickets.map((t) => ({ ...t, incluir: true }));
      marcar(paso, 'listo', resumenDe(paso, r.resultado));
    } catch (error) {
      marcar(paso, 'error', error.message);
      ocupado(false);
      return;
    }
  }
  ocupado(false);
  pintarTickets();
}

function pintarPreguntas() {
  const lista = trabajo?.preguntas || [];
  preguntas.hidden = !lista.length;
  preguntas.innerHTML = lista.length
    ? `<h2>La PO tiene dudas</h2><p>Ha seguido con lo más razonable (lo verás en «Suposiciones»). Si alguna respuesta cambia el trabajo, corrige la petición y vuelve a pasarla.</p><ul>${lista.map((p) => `<li>${escapar(p)}</li>`).join('')}</ul>`
    : '';
}

const opciones = (valores, actual, etiquetas = valores) =>
  valores.map((v, i) => `<option value="${escapar(v)}"${v === actual ? ' selected' : ''}>${escapar(etiquetas[i])}</option>`).join('');

const lista = (items, ordenada = false) => (items.length ? `<${ordenada ? 'ol' : 'ul'}>${items.map((x) => `<li>${escapar(x)}</li>`).join('')}</${ordenada ? 'ol' : 'ul'}>` : '');

function htmlTicket(t, i) {
  const detalle = [
    t.historia && `<p>${escapar(t.historia)}</p>`,
    t.criterios.length && `<h3>Criterios de aceptación</h3><ol>${t.criterios.map((c) => `<li><strong>${escapar(c.titulo)}.</strong> ${escapar(c.detalle)}</li>`).join('')}</ol>`,
    t.fueraDeAlcance.length && `<h3>Fuera de alcance</h3>${lista(t.fueraDeAlcance)}`,
    t.suposiciones.length && `<h3>Suposiciones</h3>${lista(t.suposiciones)}`,
    `<h3>Planificación</h3><p>${escapar(t.motivo || '')}${t.dependeDe.length ? ` Depende de: ${t.dependeDe.map((d) => `«${escapar(d)}»`).join(', ')}.` : ''}${t.posibleDuplicado ? ` <strong>Posible duplicado de «${escapar(t.posibleDuplicado)}».</strong>` : ''}</p>`,
    t.notasTecnicas && `<h3>Notas técnicas</h3><pre class="ticket__tecnica">${escapar(t.notasTecnicas)}</pre>`,
    t.becarios.length && `<p><strong>Becarios:</strong> ${t.becarios.map(escapar).join(', ')}</p>`,
    t.riesgos.length && `<h3>Riesgos</h3>${lista(t.riesgos, true)}`,
  ].filter(Boolean).join('');
  return `<article class="ticket${t.incluir ? '' : ' ticket--descartado'}" data-ticket="${i}">
    <div class="ticket__fila">
      <input type="checkbox" data-campo="incluir" aria-label="Crear esta tarea"${t.incluir ? ' checked' : ''}>
      <label class="campo">Título<input data-campo="titulo" value="${escapar(t.titulo)}" maxlength="200"></label>
    </div>
    <div class="ticket__datos">
      <label class="campo">Prioridad<select data-campo="prioridad">${opciones(PRIORIDADES, t.prioridad)}</select></label>
      <label class="campo">Tipo<select data-campo="tipo">${opciones(TIPOS, t.tipo)}</select></label>
      <label class="campo">Horas<input data-campo="horas" type="number" min="0.5" step="0.5" value="${t.horas ?? ''}"></label>
      <label class="campo">Empieza<select data-campo="becarioInicial">${opciones(becarios.map((b) => b.id), t.becarioInicial, becarios.map((b) => b.nombre))}</select></label>
    </div>
    <details><summary>Ver historia, criterios y plan técnico</summary>${detalle}</details>
  </article>`;
}

function pintarTickets() {
  if (!trabajo?.tickets) {
    tickets.innerHTML = '';
    return;
  }
  const n = trabajo.tickets.filter((t) => t.incluir).length;
  tickets.innerHTML = `<h2>Tareas propuestas para ${escapar(trabajo.proyecto.nombre)}</h2>
    ${trabajo.tickets.map(htmlTicket).join('')}
    <div class="tickets__pie">
      <button type="button" class="btn btn--amber" data-crear${n ? '' : ' disabled'}>Crear ${n} ${n === 1 ? 'tarea' : 'tareas'} en Notion →</button>
      <span class="actualizado">Entran en «Oficios OS» en Inbox, fase Preparación.</span>
    </div>
    <p class="error" data-error-crear role="alert" hidden></p>`;
}

async function crear() {
  const boton = tickets.querySelector('[data-crear]');
  const error = tickets.querySelector('[data-error-crear]');
  boton.disabled = true;
  error.hidden = true;
  try {
    const r = await api('/api/tareas', {
      method: 'POST',
      body: { proyecto: trabajo.proyecto, peticion: trabajo.peticion, tickets: trabajo.tickets.filter((t) => t.incluir) },
    });
    mostrarCreadas(r.creadas);
  } catch (err) {
    if (err.datos?.creadas?.length) mostrarCreadas(err.datos.creadas, err.message);
    else {
      error.textContent = err.message;
      error.hidden = false;
      boton.disabled = false;
    }
  }
}

function mostrarCreadas(creadas, aviso = '') {
  tickets.innerHTML = `<div class="creadas"><h2>Tareas creadas en Notion</h2>
    <ul>${creadas.map((c) => `<li>${enlace(c.url) ? `<a href="${enlace(c.url)}" target="_blank" rel="noopener">${escapar(c.titulo)}</a>` : escapar(c.titulo)}</li>`).join('')}</ul>
    ${aviso ? `<p class="error">${escapar(aviso)}</p>` : ''}
    <p><button type="button" class="boton-texto" data-nueva>Nueva petición</button></p></div>`;
  trabajo = null;
  document.dispatchEvent(new CustomEvent('oficina:recargar'));
}

function reiniciar() {
  trabajo = null;
  for (const r of ROLES) delete estados[r.id];
  pintarRoles();
  pintarPreguntas();
  pintarTickets();
}

function actualizarProyectos(lista) {
  const anterior = selector.value ? proyectos[Number(selector.value)]?.clave : null;
  proyectos = lista;
  selector.innerHTML = proyectos.map((p, i) => `<option value="${i}"${p.clave === anterior ? ' selected' : ''}>${escapar(p.nombre)}</option>`).join('');
}

export function iniciarProducto() {
  pintarRoles();
  document.addEventListener('oficina:datos', (e) => {
    becarios = e.detail.becarios;
    actualizarProyectos(e.detail.proyectos);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorPeticion.hidden = true;
    const proyecto = proyectos[Number(selector.value)];
    const peticion = form.elements.peticion.value.trim();
    if (!proyecto || !peticion) {
      errorPeticion.textContent = !proyecto ? 'Todavía no hay proyectos: espera a que cargue la oficina.' : 'Escribe qué necesitas.';
      errorPeticion.hidden = false;
      return;
    }
    reiniciar();
    trabajo = { peticion, proyecto: { nombre: proyecto.nombre, clave: proyecto.clave, repo: proyecto.repo } };
    ejecutar('po');
  });

  roles.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-reintentar]');
    if (boton && trabajo) ejecutar(boton.dataset.reintentar);
  });

  tickets.addEventListener('input', (e) => {
    const campo = e.target.dataset.campo;
    const caja = e.target.closest('[data-ticket]');
    if (!campo || !caja || !trabajo?.tickets) return;
    const ticket = trabajo.tickets[Number(caja.dataset.ticket)];
    ticket[campo] = campo === 'incluir' ? e.target.checked : campo === 'horas' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value;
    if (campo === 'incluir') pintarTickets();
  });

  tickets.addEventListener('click', (e) => {
    if (e.target.closest('[data-crear]')) crear();
    if (e.target.closest('[data-nueva]')) {
      reiniciar();
      form.elements.peticion.value = '';
      form.elements.peticion.focus();
    }
  });
}
