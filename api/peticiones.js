// Peticiones al equipo de producto. El panel solo las guarda en Notion; las procesa
// el skill /producto de Claude Code (PO, PM y CTO) con la suscripción de Claude.
import { ErrorPeticion, json, leerJson, rutaPanel } from '../lib/http.js';
import { crearPeticion, enviarPeticion, leerPeticiones } from '../lib/notion.js';

export default rutaPanel({
  async GET() {
    return json({ peticiones: await leerPeticiones() });
  },

  // `guardar: true` la deja en «Guardada» para más adelante; si no, va directa al equipo («Pendiente»).
  async POST(request, { usuario }) {
    const { proyecto, peticion, guardar } = await leerJson(request);
    const clave = typeof proyecto?.clave === 'string' ? proyecto.clave.trim().slice(0, 120) : '';
    if (!clave) throw new ErrorPeticion('Elige un proyecto.');
    if (typeof peticion !== 'string' || !peticion.trim()) throw new ErrorPeticion('Escribe qué necesitas.');
    if (peticion.length > 8000) throw new ErrorPeticion('La petición es demasiado larga (máximo 8000 caracteres).');
    const creada = await crearPeticion({ proyecto: clave, textoPeticion: peticion.trim(), usuario, guardar: guardar === true });
    return json({ peticion: creada }, 201);
  },

  // Envía al equipo una petición guardada.
  async PATCH(request) {
    const { id } = await leerJson(request);
    if (typeof id !== 'string' || !/^[0-9a-f-]{32,36}$/i.test(id)) throw new ErrorPeticion('Falta la petición.');
    await enviarPeticion(id);
    return json({ ok: true });
  },
});
