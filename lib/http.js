// Utilidades compartidas por las funciones de /api.
import { leerSesion } from './sesion.js';

export class ErrorConfiguracion extends Error {}

export class ErrorPeticion extends Error {
  constructor(mensaje, estado = 400) {
    super(mensaje);
    this.estado = estado;
  }
}

export function json(datos, estado = 200, cabeceras = {}) {
  return Response.json(datos, { status: estado, headers: { 'Cache-Control': 'no-store', ...cabeceras } });
}

export async function leerJson(request) {
  if (!(request.headers.get('content-type') || '').includes('application/json')) {
    throw new ErrorPeticion('La petición tiene que ser JSON.', 415);
  }
  try {
    return await request.json();
  } catch {
    throw new ErrorPeticion('El cuerpo de la petición no es JSON válido.');
  }
}

// Envuelve un manejador de /api: exige sesión, filtra el método y convierte los errores en JSON.
export function rutaPanel(metodos) {
  return {
    async fetch(request) {
      const manejador = metodos[request.method];
      if (!manejador) return json({ error: 'Método no permitido.' }, 405, { Allow: Object.keys(metodos).join(', ') });
      const sesion = await leerSesion(request);
      if (!sesion) return json({ error: 'Tu sesión ha caducado. Vuelve a entrar.' }, 401);
      try {
        return await manejador(request, sesion);
      } catch (error) {
        if (error instanceof ErrorPeticion) return json({ error: error.message }, error.estado);
        if (error instanceof ErrorConfiguracion) return json({ error: error.message, configuracion: true }, 503);
        console.error(error);
        return json({ error: error.message || 'Error inesperado.' }, 502);
      }
    },
  };
}
