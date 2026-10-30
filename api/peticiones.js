// Peticiones al equipo de producto. El panel solo las guarda en Notion; las procesa
// el skill /producto de Claude Code (PO, PM y CTO) con la suscripción de Claude.
import { ErrorPeticion, json, leerJson, rutaPanel } from '../lib/http.js';
import { crearPeticion, leerPeticiones } from '../lib/notion.js';

export default rutaPanel({
  async GET() {
    return json({ peticiones: await leerPeticiones() });
  },

  async POST(request, { usuario }) {
    const { proyecto, peticion } = await leerJson(request);
    const clave = typeof proyecto?.clave === 'string' ? proyecto.clave.trim().slice(0, 120) : '';
    if (!clave) throw new ErrorPeticion('Elige un proyecto.');
    if (typeof peticion !== 'string' || !peticion.trim()) throw new ErrorPeticion('Escribe qué necesitas.');
    if (peticion.length > 8000) throw new ErrorPeticion('La petición es demasiado larga (máximo 8000 caracteres).');
    return json({ peticion: await crearPeticion({ proyecto: clave, textoPeticion: peticion.trim(), usuario }) }, 201);
  },
});
