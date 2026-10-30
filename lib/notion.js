// Cliente mínimo de la API de Notion (versión 2026-03-11) para el panel.
import { ErrorConfiguracion } from './http.js';

const API = 'https://api.notion.com/v1';
const VERSION = '2026-03-11';

// Base «Oficios OS», donde viven las tareas de todos los proyectos.
export const TAREAS_DS = process.env.NOTION_TAREAS_DS || '2ad3221d-8eb7-8065-904d-000b57a0fe2a';
// Base «Proyectos» (página «Panel OficiosOsIA»), con el equipo de becarios de cada proyecto.
export const PROYECTOS_DS = process.env.NOTION_PROYECTOS_DS || 'c295eb77-c4a5-4c32-8027-f06f4412bf7d';

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
  };
}

export async function tareasAbiertas() {
  const paginas = await consultar(TAREAS_DS, { filter: { property: 'Estado', status: { does_not_equal: 'Hecha' } } });
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

// `ticket` ya viene normalizado por lib/tickets.js.
export async function crearTarea(ticket, markdown, usuario) {
  const propiedades = {
    'Título de la tarea': { title: textoRico(ticket.titulo) },
    'Proyecto relacionado': { rich_text: textoRico(ticket.proyecto) },
    Estado: { status: { name: 'Inbox' } },
    Fase: { select: { name: 'Preparación' } },
    Becario: { select: { name: ticket.becarioInicial } },
    Prioridad: { select: { name: ticket.prioridad } },
    'Tipo de tarea': { select: { name: ticket.tipo } },
    Área: { select: { name: 'Producto' } },
    Notas: { rich_text: textoRico(`Creada desde el panel por ${usuario} con el equipo de producto (PO, PM y CTO).`) },
  };
  if (ticket.horas != null) propiedades['Estimación (horas)'] = { number: ticket.horas };
  const pagina = await notion('/pages', {
    method: 'POST',
    body: { parent: { type: 'data_source_id', data_source_id: TAREAS_DS }, properties: propiedades, markdown },
  });
  return { id: pagina.id, url: pagina.url, titulo: ticket.titulo };
}
