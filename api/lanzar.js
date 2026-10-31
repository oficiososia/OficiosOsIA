// Lanza en la nube una tarea que ya está en un departamento, con la tarea programada de Claude
// Code de quien está en el panel (su suscripción). La sesión trabaja hasta abrir el PR.
import { ErrorPeticion, json, leerJson, rutaPanel } from '../lib/http.js';
import { contextoLanzamiento, lanzarTarea } from '../lib/lanzar.js';
import { leerTarea } from '../lib/notion.js';

const ID = /^[0-9a-f-]{32,36}$/i;

export default rutaPanel({
  async POST(request, { usuario }) {
    const { tareaId, nota = '' } = await leerJson(request);
    if (typeof tareaId !== 'string' || !ID.test(tareaId)) throw new ErrorPeticion('Falta la tarea.');
    if (typeof nota !== 'string' || nota.length > 500) throw new ErrorPeticion('La nota es como mucho de 500 caracteres.');
    const [tarea, ctx] = await Promise.all([leerTarea(tareaId), contextoLanzamiento(usuario)]);
    return json(await lanzarTarea(tarea, ctx, { nota }));
  },
});
