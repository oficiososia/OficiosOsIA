// Lanzar tareas en la nube con la suscripción de Claude de quien las lanza.
//
// Cada persona crea en claude.ai/code/routines, con su cuenta, una tarea programada de Claude
// Code por proyecto (repositorio, entorno con sus tokens de Vercel y Supabase, conector de
// Notion y el prompt de oficiososia/becarios) y le añade un disparador por API. El panel guarda
// la URL y el token de ese disparador (cifrado) y, al lanzar una tarea, le manda el encargo. La
// sesión corre en la nube de Anthropic, gasta la suscripción de esa persona y termina en un PR.
// El panel no usa nunca la API de pago de Claude.

import { ErrorPeticion } from './http.js';

export const VERSION_ENCARGO = 'ENCARGO OFICIOSOSIA v1';
// Solo se dispara contra la API de Claude Code: así un token no puede acabar en otro sitio.
const DISPARADOR = /^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/trig_[A-Za-z0-9]{6,64}\/fire$/;
const MAX_NOTA = 500;

export function validarConexion({ disparador, token } = {}) {
  const url = typeof disparador === 'string' ? disparador.trim() : '';
  const llave = typeof token === 'string' ? token.trim() : '';
  if (!DISPARADOR.test(url)) return { error: 'La URL tiene que ser la del disparador por API de tu tarea programada: https://api.anthropic.com/v1/claude_code/routines/trig_…/fire' };
  if (!/^sk-ant-[A-Za-z0-9_-]{16,400}$/.test(llave)) return { error: 'El token no tiene buena pinta: es el que da claude.ai al generar el disparador por API (empieza por sk-ant-).' };
  return { conexion: { disparador: url, token: llave, pista: `…${llave.slice(-4)}` } };
}

// Una línea por dato: lo que va dentro se limpia de saltos de línea para que nadie cuele otra
// clave (por ejemplo, un título de tarea con «repositorio: …» dentro).
const linea = (valor) => String(valor ?? '').replace(/[\r\n]+/g, ' ').trim();

export function textoEncargo({ tarea, sala, departamento, equipo, usuario, nota = '' }) {
  return [
    VERSION_ENCARGO,
    `tarea: ${linea(tarea.url)}`,
    `tarea_id: ${linea(tarea.id)}`,
    `titulo: ${linea(tarea.titulo)}`,
    `proyecto: ${linea(tarea.proyecto || sala.clave)}`,
    `repositorio: ${linea(sala.repo || '')}`,
    `departamento: ${departamento.id}`,
    `entrada: ${departamento.entrada}`,
    `equipo: ${equipo.join(', ')}`,
    `lanzada_por: ${linea(usuario)}`,
    `nota: ${linea(String(nota || '').slice(0, MAX_NOTA))}`,
  ].join('\n');
}

// Nunca con estado 401: el panel lo entendería como sesión caducada y mandaría al login.
export class ErrorNube extends ErrorPeticion {
  constructor(mensaje, estado = 502) {
    super(mensaje, estado);
  }
}

function motivo(estado, datos, cabeceras) {
  const detalle = datos?.error?.message ? ` (${datos.error.message})` : '';
  if (estado === 401) return 'El token no vale para esa tarea programada. Genera uno nuevo en claude.ai/code/routines y pégalo en «Conexiones».';
  if (estado === 403) return `Tu cuenta de Claude no puede lanzar tareas programadas (hace falta Pro, Max, Team o Enterprise con Claude Code en la nube)${detalle}.`;
  if (estado === 404) return 'Esa tarea programada ya no existe en tu cuenta de Claude. Revisa la URL en «Conexiones».';
  if (estado === 429) {
    const espera = Number(cabeceras.get('retry-after'));
    return `Has llegado al límite de lanzamientos por hora de Claude${espera ? `: vuelve a probar en ${Math.ceil(espera / 60)} min` : ''}.`;
  }
  if (estado === 400) return `Claude no ha aceptado el encargo${detalle}. ¿Está en pausa la tarea programada?`;
  return `Claude no está disponible ahora mismo (${estado}). Prueba en un rato.`;
}

// Lanza la tarea programada. No se reintenta: cada llamada que llega crea una sesión nueva.
export async function disparar({ disparador, token, texto }) {
  if (!DISPARADOR.test(disparador || '')) throw new ErrorNube('La conexión no tiene una URL de disparador válida.', 400);
  let respuesta;
  try {
    respuesta = await fetch(disparador, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: texto }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new ErrorNube(`No se ha podido hablar con Claude (${error.name === 'TimeoutError' ? 'tarda demasiado' : error.message}).`);
  }
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new ErrorNube(motivo(respuesta.status, datos, respuesta.headers), respuesta.status === 429 ? 429 : 502);
  const sesionUrl = datos.claude_code_session_url;
  if (typeof sesionUrl !== 'string' || !/^https:\/\/claude\.ai\//.test(sesionUrl)) throw new ErrorNube('Claude ha aceptado el encargo pero no ha devuelto la sesión.');
  return { sesionId: datos.claude_code_session_id || null, sesionUrl };
}
