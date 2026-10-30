// Sesión del panel: cookie HttpOnly con `usuario.caducidad` firmado con HMAC-SHA256.
// Sin base de datos: la firma con SESION_SECRETO es lo que impide falsificarla.

export const COOKIE = 'panel_sesion';
export const DURACION_S = 7 * 24 * 60 * 60;

const codificador = new TextEncoder();

function aBase64url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

async function clave(secreto) {
  return crypto.subtle.importKey('raw', codificador.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function firmar(usuario, secreto, ahora = Date.now()) {
  const carga = aBase64url(codificador.encode(JSON.stringify({ u: usuario, exp: Math.floor(ahora / 1000) + DURACION_S })));
  const firma = await crypto.subtle.sign('HMAC', await clave(secreto), codificador.encode(carga));
  return `${carga}.${aBase64url(new Uint8Array(firma))}`;
}

// Devuelve el nombre de usuario si el token es válido y no ha caducado; si no, null.
export async function verificar(token, secreto, ahora = Date.now()) {
  if (!token || !secreto) return null;
  const [carga, firma, sobra] = token.split('.');
  if (!carga || !firma || sobra !== undefined) return null;
  const valida = await crypto.subtle.verify('HMAC', await clave(secreto), Buffer.from(firma, 'base64url'), codificador.encode(carga));
  if (!valida) return null;
  try {
    const { u, exp } = JSON.parse(Buffer.from(carga, 'base64url').toString('utf8'));
    if (typeof u !== 'string' || typeof exp !== 'number' || exp * 1000 <= ahora) return null;
    return u;
  } catch {
    return null;
  }
}

export function leerCookie(request, nombre) {
  const cabecera = request.headers.get('cookie') || '';
  for (const trozo of cabecera.split(';')) {
    const i = trozo.indexOf('=');
    if (i > -1 && trozo.slice(0, i).trim() === nombre) return decodeURIComponent(trozo.slice(i + 1).trim());
  }
  return null;
}

export async function leerSesion(request) {
  const usuario = await verificar(leerCookie(request, COOKIE), process.env.SESION_SECRETO);
  return usuario ? { usuario } : null;
}

export function cookieSesion(token) {
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DURACION_S}`;
}

export function cookieBorrada() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
