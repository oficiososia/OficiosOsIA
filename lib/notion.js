// Cliente mínimo de la API de Notion (versión 2026-03-11) para el panel.
import { ErrorConfiguracion } from './http.js';

const API = 'https://api.notion.com/v1';
const VERSION = '2026-03-11';

// Base «Oficios OS», donde viven las tareas de todos los proyectos.
export const TAREAS_DS = process.env.NOTION_TAREAS_DS || '2ad3221d-8eb7-8065-904d-000b57a0fe2a';
// Base «Proyectos» (página «Panel OficiosOsIA»), con el equipo de becarios de cada proyecto.
export const PROYECTOS_DS = process.env.NOTION_PROYECTOS_DS || 'c295eb77-c4a5-4c32-8027-f06f4412bf7d';
// Base «Peticiones» (página «Panel OficiosOsIA»): la cola que procesa /producto en Claude Code.
export const PETICIONES_DS = process.env.NOTION_PETICIONES_DS || '7faed1fa-0f84-4078-8800-9350d4746262';
// Base «Becarios» (página «Panel OficiosOsIA»): nombre, papel, avatar, instrucciones y pausa de cada becario.
export const BECARIOS_DS = process.env.NOTION_BECARIOS_DS || '7d90c32f-ede0-42ca-8732-2c80134f885b';
// Base «Chat» (página «Panel OficiosOsIA»): mensajes del panel al equipo de producto y sus respuestas.
export const CHAT_DS = process.env.NOTION_CHAT_DS || '5a4ba784-8970-49b7-a9cb-5125630cecb0';

export class ErrorNotion extends Error {
  constructor(estado, mensaje) {
    super(`Notion respondió ${estado}: ${mensaje}`);
    this.estado = estado;
  }
}

async function notion(ruta, { method = 'GET', body } = {}) {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new ErrorConfiguracion('Falta NOTION_TOKEN en Vercel: el panel no puede leer Notion.');
  const respuesta = await fetch(API + ruta, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': VERSION, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new ErrorNotion(respuesta.status, datos.message || respuesta.statusText);
  return datos;
}

async function consultar(dataSource, cuerpo, maxPaginas = 5) {
  const resultados = [];
  let cursor;
  for (let i = 0; i < maxPaginas; i++) {
    const pagina = await notion(`/data_sources/${dataSource}/query`, {
      method: 'POST',
      body: { page_size: 100, ...cuerpo, ...(cursor ? { start_cursor: cursor } : {}) },
    });
    resultados.push(...pagina.results);
    if (!pagina.has_more) break;
    cursor = pagina.next_cursor;
  }
  return resultados;
}

export function texto(propiedad) {
  if (!propiedad) return '';
  return (propiedad.title || propiedad.rich_text || []).map((t) => t.plain_text).join('').trim();
}

const textoRico = (contenido) => [{ text: { content: String(contenido).slice(0, 2000) } }];
// Notion corta cada trozo de texto en 2000 caracteres: los textos largos van en varios trozos.
const textoLargo = (contenido) => (String(contenido).match(/[\s\S]{1,2000}/g) || []).map((trozo) => ({ text: { content: trozo } }));

export function aTarea(pagina) {
  const p = pagina.properties || {};
  return {
    id: pagina.id,
    url: pagina.url,
    titulo: texto(p['Título de la tarea']) || 'Sin título',
    proyecto: texto(p['Proyecto relacionado']),
    becario: p.Becario?.select?.name || null,
    fase: p.Fase?.select?.name || null,
    estado: p.Estado?.status?.name || null,
    prioridad: p.Prioridad?.select?.name || null,
    bloqueo: texto(p.Bloqueo),
    editada: pagina.last_edited_time || null,
  };
}

export function aProyecto(pagina) {
  const p = pagina.properties || {};
  const nombre = texto(p.Nombre);
  return {
    id: pagina.id,
    url: pagina.url,
    nombre,
    clave: texto(p['Proyecto en tareas']) || nombre,
    equipo: (p.Becarios?.multi_select || []).map((o) => o.name),
    repo: p.Repositorio?.url || null,
    orden: p.Orden?.number ?? null,
    logo: p.Logo?.url || null,
    color: texto(p.Color) || null,
  };
}

export async function tareasAbiertas() {
  const paginas = await consultar(TAREAS_DS, { filter: { property: 'Estado', status: { does_not_equal: 'Hecha' } } });
  return paginas.map(aTarea);
}

// Para el kanban: las abiertas y las que se han tocado en el último mes (así salen las cerradas recientes).
export async function tareasTablero() {
  const paginas = await consultar(TAREAS_DS, {
    filter: {
      or: [
        { property: 'Estado', status: { does_not_equal: 'Hecha' } },
        { timestamp: 'last_edited_time', last_edited_time: { past_month: {} } },
      ],
    },
  });
  return paginas.map(aTarea);
}

// null cuando la base «Proyectos» no está configurada.
export async function leerProyectos() {
  if (!PROYECTOS_DS) return null;
  const paginas = await consultar(PROYECTOS_DS, {}, 2);
  return paginas.map(aProyecto).filter((p) => p.nombre);
}

export async function guardarEquipo(proyectoId, equipo) {
  if (!PROYECTOS_DS) {
    throw new ErrorConfiguracion('Para guardar los equipos falta la base «Proyectos» de Notion (NOTION_PROYECTOS_DS).');
  }
  const pagina = await notion(`/pages/${proyectoId}`);
  const padre = pagina.parent?.data_source_id?.replace(/-/g, '');
  if (padre !== PROYECTOS_DS.replace(/-/g, '')) throw new ErrorNotion(400, 'esa página no es un proyecto de la base «Proyectos»');
  await notion(`/pages/${proyectoId}`, {
    method: 'PATCH',
    body: { properties: { Becarios: { multi_select: equipo.map((name) => ({ name })) } } },
  });
}

// Pasa una tarea de OficiosOS al equipo de becarios. Entra por el principio del flujo:
// la recibe el CTO en Preparación y él decide quién la coge después. Si estaba en Inbox,
// pasa a «Por hacer». Una tarea que ya tiene becario está en el flujo y no se toca.
export async function pasarAlEquipo(tareaId) {
  const pagina = await notion(`/pages/${tareaId}`);
  if (pagina.parent?.data_source_id?.replace(/-/g, '') !== TAREAS_DS.replace(/-/g, '')) {
    throw new ErrorNotion(400, 'esa página no es una tarea de OficiosOS');
  }
  const p = pagina.properties || {};
  if (p.Becario?.select?.name) throw new ErrorNotion(409, `la tarea ya está en el flujo (la tiene ${p.Becario.select.name})`);
  const propiedades = { Becario: { select: { name: 'cto' } }, Fase: { select: { name: 'Preparación' } } };
  if (p.Estado?.status?.name === 'Inbox') propiedades.Estado = { status: { name: 'Por hacer' } };
  await notion(`/pages/${tareaId}`, { method: 'PATCH', body: { properties: propiedades } });
}

export function aBecario(pagina) {
  const p = pagina.properties || {};
  return {
    notionId: pagina.id,
    url: pagina.url,
    id: p.Id?.select?.name || null,
    nombre: texto(p.Nombre),
    papel: texto(p.Papel),
    pausado: Boolean(p.Pausado?.checkbox),
    instrucciones: (p.Instrucciones?.rich_text || []).map((t) => t.plain_text).join(''),
    modelo: p.Modelo?.select?.name || null,
    esfuerzo: p.Esfuerzo?.select?.name || null,
    avatar: {
      peinado: p.Peinado?.select?.name || null,
      accesorios: p.Accesorios ? (p.Accesorios.multi_select || []).map((o) => o.name) : null,
      piel: texto(p.Piel),
      pelo: texto(p.Pelo),
      ropa: texto(p.Ropa),
      detalle: texto(p.Detalle),
    },
  };
}

export async function leerBecarios() {
  const paginas = await consultar(BECARIOS_DS, {}, 1);
  return paginas.map(aBecario).filter((b) => b.id);
}

// Guarda la ficha de un becario en su fila de «Becarios» (la crea si aún no la tiene).
export async function guardarBecario(becario) {
  const { id, nombre, papel, pausado, instrucciones, avatar, modelo = null, esfuerzo = null } = becario;
  const propiedades = {
    Nombre: { title: textoRico(nombre) },
    Id: { select: { name: id } },
    Papel: { rich_text: papel ? textoRico(papel) : [] },
    Pausado: { checkbox: pausado },
    Instrucciones: { rich_text: textoLargo(instrucciones) },
    Modelo: { select: modelo ? { name: modelo } : null },
    Esfuerzo: { select: esfuerzo ? { name: esfuerzo } : null },
    Peinado: { select: { name: avatar.peinado } },
    Accesorios: { multi_select: avatar.accesorios.map((name) => ({ name })) },
    Piel: { rich_text: textoRico(avatar.piel) },
    Pelo: { rich_text: textoRico(avatar.pelo) },
    Ropa: { rich_text: textoRico(avatar.ropa) },
    Detalle: { rich_text: textoRico(avatar.detalle) },
  };
  const [fila] = await consultar(BECARIOS_DS, { page_size: 1, filter: { property: 'Id', select: { equals: id } } }, 1);
  const pagina = fila
    ? await notion(`/pages/${fila.id}`, { method: 'PATCH', body: { properties: propiedades } })
    : await notion('/pages', { method: 'POST', body: { parent: { type: 'data_source_id', data_source_id: BECARIOS_DS }, properties: propiedades } });
  return aBecario(pagina);
}

export function aPeticion(pagina) {
  const p = pagina.properties || {};
  return {
    id: pagina.id,
    url: pagina.url,
    titulo: texto(p['Petición']) || 'Sin título',
    proyecto: texto(p.Proyecto),
    estado: p.Estado?.status?.name || null,
    pedidaPor: texto(p['Pedida por']),
    resumen: texto(p.Resumen),
    tareas: (p.Tareas?.relation || []).length,
    creada: pagina.created_time || null,
  };
}

export async function leerPeticiones() {
  const paginas = await consultar(PETICIONES_DS, { page_size: 30, sorts: [{ timestamp: 'created_time', direction: 'descending' }] }, 1);
  return paginas.map(aPeticion);
}

// El título es la primera línea; el texto completo va en el cuerpo, que es lo que lee /producto.
export function tituloPeticion(textoPeticion) {
  const linea = textoPeticion.trim().split('\n')[0].trim();
  return linea.length > 90 ? `${linea.slice(0, 89).trimEnd()}…` : linea;
}

// `guardar`: queda en «Guardada» y /producto no la toca hasta que se envía al equipo.
export async function crearPeticion({ proyecto, textoPeticion, usuario, guardar = false }) {
  const pagina = await notion('/pages', {
    method: 'POST',
    body: {
      parent: { type: 'data_source_id', data_source_id: PETICIONES_DS },
      properties: {
        'Petición': { title: textoRico(tituloPeticion(textoPeticion)) },
        Proyecto: { rich_text: textoRico(proyecto) },
        'Pedida por': { rich_text: textoRico(usuario) },
        Estado: { status: { name: guardar ? 'Guardada' : 'Pendiente' } },
      },
      markdown: textoPeticion,
    },
  });
  return aPeticion(pagina);
}

// Pasa una petición guardada a «Pendiente» para que la recoja /producto.
export async function enviarPeticion(peticionId) {
  const pagina = await notion(`/pages/${peticionId}`);
  if (pagina.parent?.data_source_id?.replace(/-/g, '') !== PETICIONES_DS.replace(/-/g, '')) {
    throw new ErrorNotion(400, 'esa página no es una petición');
  }
  if (pagina.properties?.Estado?.status?.name !== 'Guardada') throw new ErrorNotion(409, 'la petición ya no está guardada');
  await notion(`/pages/${peticionId}`, { method: 'PATCH', body: { properties: { Estado: { status: { name: 'Pendiente' } } } } });
}

export function aMensaje(pagina) {
  const p = pagina.properties || {};
  return {
    id: pagina.id,
    url: pagina.url,
    texto: (p.Texto?.rich_text || []).map((t) => t.plain_text).join('') || texto(p.Mensaje),
    autor: texto(p.Autor),
    deEquipo: p.De?.select?.name === 'equipo',
    estado: p.Estado?.select?.name || null,
    proyecto: texto(p.Proyecto),
    tareas: (p.Tareas?.relation || []).map((r) => r.id),
    creado: pagina.created_time || null,
  };
}

// Los últimos mensajes del chat, del más antiguo al más nuevo.
export async function leerChat(cuantos = 60) {
  const paginas = await consultar(CHAT_DS, { page_size: cuantos, sorts: [{ timestamp: 'created_time', direction: 'descending' }] }, 1);
  return paginas.map(aMensaje).reverse();
}

// Un mensaje de Miguel o Pablo: queda «Pendiente» hasta que el equipo contesta con /producto.
export async function escribirMensaje({ textoMensaje, usuario, proyecto = '' }) {
  const pagina = await notion('/pages', {
    method: 'POST',
    body: {
      parent: { type: 'data_source_id', data_source_id: CHAT_DS },
      properties: {
        Mensaje: { title: textoRico(tituloPeticion(textoMensaje)) },
        Texto: { rich_text: textoLargo(textoMensaje) },
        Autor: { rich_text: textoRico(usuario) },
        De: { select: { name: 'persona' } },
        Estado: { select: { name: 'Pendiente' } },
        Proyecto: { rich_text: proyecto ? textoRico(proyecto) : [] },
      },
    },
  });
  return aMensaje(pagina);
}
