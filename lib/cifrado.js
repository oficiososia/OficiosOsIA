// Cifrado de los tokens de las conexiones (AES-256-GCM). La clave sale de CONEXIONES_SECRETO,
// que vive solo en Vercel: en Notion se guarda el texto cifrado, que sin esa clave no sirve.
// Cada token va atado a su persona y su proyecto (datos asociados), así que copiar la fila de
// otro no sirve para lanzar con su suscripción.
import { ErrorConfiguracion } from './http.js';

const VERSION = 'v1';
const codificador = new TextEncoder();
const decodificador = new TextDecoder();

export const cifradoListo = (secreto = process.env.CONEXIONES_SECRETO) => typeof secreto === 'string' && secreto.length >= 16;

async function clave(secreto) {
  if (!cifradoListo(secreto)) {
    throw new ErrorConfiguracion('Falta CONEXIONES_SECRETO en Vercel (un texto aleatorio de 32 caracteres o más): sin él no se pueden guardar ni usar las conexiones.');
  }
  const huella = await crypto.subtle.digest('SHA-256', codificador.encode(`conexiones:${secreto}`));
  return crypto.subtle.importKey('raw', huella, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

const asociados = (usuario, proyectoId) => codificador.encode(`${String(usuario).toLowerCase()}|${String(proyectoId).replace(/-/g, '').toLowerCase()}`);

export async function cifrar(texto, { usuario, proyectoId }, secreto = process.env.CONEXIONES_SECRETO) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: asociados(usuario, proyectoId) }, await clave(secreto), codificador.encode(texto));
  return `${VERSION}.${Buffer.from(iv).toString('base64url')}.${Buffer.from(cifrado).toString('base64url')}`;
}

// Devuelve el texto o null si no se puede descifrar (otra clave, otra persona u otro proyecto).
export async function descifrar(guardado, { usuario, proyectoId }, secreto = process.env.CONEXIONES_SECRETO) {
  const llave = await clave(secreto);
  const [version, iv, cifrado, sobra] = String(guardado || '').split('.');
  if (version !== VERSION || !iv || !cifrado || sobra !== undefined) return null;
  try {
    const claro = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: Buffer.from(iv, 'base64url'), additionalData: asociados(usuario, proyectoId) },
      llave,
      Buffer.from(cifrado, 'base64url'),
    );
    return decodificador.decode(claro);
  } catch {
    return null;
  }
}
