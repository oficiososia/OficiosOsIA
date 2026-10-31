// Utilidades del panel compartidas por la oficina y el equipo de producto.

export async function api(ruta, { method = 'GET', body } = {}) {
  const respuesta = await fetch(ruta, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (respuesta.status === 401) {
    location.assign(`/login?volver=${encodeURIComponent(location.pathname + location.hash)}`);
    throw new Error('Tu sesión ha caducado.');
  }
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(datos.error || `El servidor respondió ${respuesta.status}.`);
    error.datos = datos;
    throw error;
  }
  return datos;
}

const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapar = (texto) => String(texto ?? '').replace(/[&<>"']/g, (c) => ENTIDADES[c]);

// Solo enlaces http(s): los datos vienen de Notion y del navegador.
export const enlace = (url) => (typeof url === 'string' && /^https?:\/\//i.test(url) ? escapar(url) : null);

export const hora = () => new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

// Igual que en lib/oficina.js: sin tildes, sin mayúsculas y sin espacios de más.
export const normalizar = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
