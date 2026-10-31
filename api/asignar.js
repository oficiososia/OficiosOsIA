// Pasa tareas por hacer al equipo de becarios desde la oficina. Siempre entran por el CTO,
// en Preparación: él hace el plan y decide qué becario sigue (ver lib/notion.js).
import { ErrorPeticion, json, leerJson, rutaPanel } from '../lib/http.js';
import { leerBecarios, pasarAlEquipo } from '../lib/notion.js';

const ID = /^[0-9a-f-]{32,36}$/i;

export default rutaPanel({
  async PUT(request) {
    const { tareas } = await leerJson(request);
    if (!Array.isArray(tareas) || !tareas.length) throw new ErrorPeticion('No hay tareas que pasar al equipo.');
    if (tareas.length > 40) throw new ErrorPeticion('Como mucho 40 tareas de una vez.');
    if (tareas.some((id) => typeof id !== 'string' || !ID.test(id))) throw new ErrorPeticion('Hay una tarea sin identificar.');
    // Las tareas entran por el CTO: si está pausado, no se le pasa nada. Si no se pueden leer
    // las fichas de los becarios, no se bloquea el trabajo por eso.
    const cto = (await leerBecarios().catch(() => [])).find((b) => b.id === 'cto');
    if (cto?.pausado) throw new ErrorPeticion('El CTO está pausado y las tareas entran por él. Reactívalo en la pestaña «Becarios».', 409);
    const hechas = [];
    // De una en una: Notion limita a unas 3 peticiones por segundo.
    for (const id of new Set(tareas)) {
      try {
        await pasarAlEquipo(id);
        hechas.push(id);
      } catch (error) {
        console.error(error);
        return json({ hechas, error: `Se han pasado ${hechas.length} de ${tareas.length}. Falló una tarea: ${error.message}` }, 502);
      }
    }
    return json({ hechas });
  },
});
