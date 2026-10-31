// Asigna tareas por hacer a los becarios desde la oficina: cambia «Becario» en Notion.
import { IDS_BECARIOS } from '../lib/becarios.js';
import { ErrorPeticion, json, leerJson, rutaPanel } from '../lib/http.js';
import { asignarTarea } from '../lib/notion.js';

const ID = /^[0-9a-f-]{32,36}$/i;

export default rutaPanel({
  async PUT(request) {
    const { cambios } = await leerJson(request);
    if (!Array.isArray(cambios) || !cambios.length) throw new ErrorPeticion('No hay asignaciones que guardar.');
    if (cambios.length > 40) throw new ErrorPeticion('Como mucho 40 tareas de una vez.');
    for (const c of cambios) {
      if (typeof c?.tareaId !== 'string' || !ID.test(c.tareaId)) throw new ErrorPeticion('Hay una tarea sin identificar.');
      if (c.becario !== null && !IDS_BECARIOS.includes(c.becario)) throw new ErrorPeticion('Hay un becario desconocido.');
    }
    const hechas = [];
    // De una en una: Notion limita a unas 3 peticiones por segundo.
    for (const c of cambios) {
      try {
        await asignarTarea(c.tareaId, c.becario);
        hechas.push(c.tareaId);
      } catch (error) {
        console.error(error);
        return json({ hechas, error: `Se han guardado ${hechas.length} de ${cambios.length}. Falló una tarea: ${error.message}` }, 502);
      }
    }
    return json({ hechas });
  },
});
