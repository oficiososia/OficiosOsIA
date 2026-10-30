import { ErrorPeticion, json, leerJson, rutaPanel } from '../lib/http.js';
import { crearTarea } from '../lib/notion.js';
import { markdownTicket, normalizarTicket } from '../lib/tickets.js';

export default rutaPanel({
  async POST(request, { usuario }) {
    const { proyecto, peticion, tickets } = await leerJson(request);
    const clave = typeof proyecto?.clave === 'string' ? proyecto.clave.trim().slice(0, 120) : '';
    if (!clave) throw new ErrorPeticion('Elige un proyecto.');
    if (!Array.isArray(tickets) || !tickets.length) throw new ErrorPeticion('No hay tareas que crear.');
    if (tickets.length > 10) throw new ErrorPeticion('Como mucho 10 tareas de una vez.');

    const creadas = [];
    // De una en una: Notion limita a unas 3 peticiones por segundo.
    for (const bruto of tickets) {
      const ticket = { ...normalizarTicket(bruto), proyecto: clave };
      try {
        creadas.push(await crearTarea(ticket, markdownTicket(ticket, { peticion: typeof peticion === 'string' ? peticion : '', usuario }), usuario));
      } catch (error) {
        console.error(error);
        return json({ creadas, error: `Se han creado ${creadas.length} de ${tickets.length}. Falló «${ticket.titulo}»: ${error.message}` }, 502);
      }
    }
    return json({ creadas });
  },
});
