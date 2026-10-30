// Junta lo que proponen PO, PM y CTO en tickets, los valida y los pasa al Markdown de Notion.
// El formato del cuerpo sigue el de las tareas que ya escriben los becarios en «Oficios OS».
import { IDS_BECARIOS } from './becarios.js';

export const PRIORIDADES = ['Alta', 'Media', 'Baja'];
export const TIPOS = ['Profunda', 'Rápida', 'Administrativa'];

const cadena = (v, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const cadenas = (v, max = 20) => (Array.isArray(v) ? v.map((x) => cadena(x, 1000)).filter(Boolean).slice(0, max) : []);

export function combinar(historias = [], planificacion = [], planes = []) {
  const plan = new Map(planificacion.map((p) => [p.historia, p]));
  const tecnica = new Map(planes.map((p) => [p.historia, p]));
  const tickets = historias.map((h, i) => {
    const numero = i + 1;
    const pm = plan.get(numero) || {};
    const cto = tecnica.get(numero) || {};
    return {
      numero,
      titulo: h.titulo,
      historia: h.historia,
      criterios: h.criterios,
      fueraDeAlcance: h.fuera_de_alcance,
      suposiciones: h.suposiciones,
      prioridad: pm.prioridad,
      tipo: pm.tipo,
      horas: pm.estimacion_horas,
      orden: Number.isInteger(pm.orden) ? pm.orden : numero,
      dependeDe: (pm.depende_de || []).map((n) => historias[n - 1]?.titulo).filter(Boolean),
      posibleDuplicado: pm.posible_duplicado,
      motivo: pm.motivo,
      notasTecnicas: cto.notas_tecnicas,
      riesgos: cto.riesgos,
      becarios: cto.becarios,
      becarioInicial: cto.becario_inicial,
    };
  });
  return tickets.sort((a, b) => a.orden - b.orden || a.numero - b.numero).map(normalizarTicket);
}

// Lo que llega del navegador no se da por bueno: se recorta y se fuerzan los valores que acepta Notion.
export function normalizarTicket(t = {}) {
  const horas = Number(t.horas);
  const becarios = cadenas(t.becarios, IDS_BECARIOS.length).filter((b) => IDS_BECARIOS.includes(b));
  return {
    titulo: cadena(t.titulo, 200) || 'Tarea sin título',
    historia: cadena(t.historia),
    criterios: (Array.isArray(t.criterios) ? t.criterios : [])
      .map((c) => ({ titulo: cadena(c?.titulo, 200), detalle: cadena(c?.detalle, 1500) }))
      .filter((c) => c.titulo || c.detalle)
      .slice(0, 15),
    fueraDeAlcance: cadenas(t.fueraDeAlcance),
    suposiciones: cadenas(t.suposiciones),
    prioridad: PRIORIDADES.includes(t.prioridad) ? t.prioridad : 'Media',
    tipo: TIPOS.includes(t.tipo) ? t.tipo : 'Profunda',
    horas: Number.isFinite(horas) && horas > 0 && horas < 1000 ? Math.round(horas * 2) / 2 : null,
    dependeDe: cadenas(t.dependeDe, 10),
    posibleDuplicado: cadena(t.posibleDuplicado, 300),
    motivo: cadena(t.motivo, 500),
    notasTecnicas: cadena(t.notasTecnicas, 8000),
    riesgos: cadenas(t.riesgos, 10),
    becarios: [...new Set(becarios)],
    becarioInicial: IDS_BECARIOS.includes(t.becarioInicial) ? t.becarioInicial : 'cto',
  };
}

const vinetas = (lista) => lista.map((x) => `- ${x}`).join('\n');
const cita = (texto) => texto.split('\n').map((l) => `> ${l}`).join('\n');

export function markdownTicket(t, { peticion, usuario }) {
  const partes = [];
  if (t.historia) partes.push(t.historia);
  if (t.criterios.length) {
    partes.push('## Criterios de aceptación');
    partes.push(t.criterios.map((c, i) => `- [ ] **${i + 1} · ${c.titulo}.** ${c.detalle}`.trim()).join('\n'));
  }
  if (t.fueraDeAlcance.length) partes.push('## Fuera de alcance', vinetas(t.fueraDeAlcance));
  if (t.suposiciones.length) partes.push('## Suposiciones', vinetas(t.suposiciones));

  const plan = [`- Prioridad: ${t.prioridad}${t.motivo ? ` — ${t.motivo}` : ''}`, `- Tipo: ${t.tipo}`];
  if (t.horas != null) plan.push(`- Estimación: ${t.horas} h`);
  if (t.dependeDe.length) plan.push(`- Depende de: ${t.dependeDe.map((d) => `«${d}»`).join(', ')}`);
  if (t.posibleDuplicado) plan.push(`- Posible duplicado de: «${t.posibleDuplicado}»`);
  partes.push('## Planificación', plan.join('\n'));

  const tecnica = [];
  if (t.notasTecnicas) tecnica.push(t.notasTecnicas);
  if (t.becarios.length) tecnica.push(`**Becarios que intervienen:** ${t.becarios.join(', ')}. Empieza ${t.becarioInicial}.`);
  if (t.riesgos.length) tecnica.push('**Riesgos**', t.riesgos.map((r, i) => `${i + 1}. ${r}`).join('\n'));
  if (tecnica.length) partes.push('## Dependencias y notas técnicas', ...tecnica);

  partes.push('## Origen', `Creada por el equipo de producto (PO, PM y CTO) desde el panel, a petición de ${usuario}, a partir de:`);
  if (peticion) partes.push(cita(cadena(peticion, 8000)));
  return partes.join('\n\n');
}
