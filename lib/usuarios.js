// Usuarios del panel. Viven en la variable de entorno PANEL_USUARIOS de Vercel,
// nunca en el repositorio (es público): `Miguel:contraseña,Pablo:contraseña`.
import { createHash, timingSafeEqual } from 'node:crypto';

export function leerUsuarios(valor = '') {
  const usuarios = new Map();
  for (const entrada of valor.split(',')) {
    const i = entrada.indexOf(':');
    if (i < 1) continue;
    const nombre = entrada.slice(0, i).trim();
    const contrasena = entrada.slice(i + 1);
    if (nombre && contrasena) usuarios.set(nombre.toLowerCase(), { nombre, contrasena });
  }
  return usuarios;
}

const huella = (texto) => createHash('sha256').update(String(texto)).digest();

// Devuelve el nombre tal como está escrito en PANEL_USUARIOS (p. ej. «Pablo») o null.
export function comprobarCredenciales(usuario, contrasena, valor = process.env.PANEL_USUARIOS) {
  const encontrado = leerUsuarios(valor).get(String(usuario || '').trim().toLowerCase());
  // Se compara siempre, aunque el usuario no exista, para no revelar cuáles existen por el tiempo de respuesta.
  const esperada = huella(encontrado ? encontrado.contrasena : '\0sin-usuario');
  const iguales = timingSafeEqual(esperada, huella(contrasena ?? ''));
  return encontrado && iguales ? encontrado.nombre : null;
}
