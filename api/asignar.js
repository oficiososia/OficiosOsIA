// Pasa tareas por hacer a un departamento de la oficina. Siempre entran por su entrada (cto,
// sec-lead, mk-lead o it-lead), en Preparación: hace el plan y decide qué becario sigue (ver
// lib/notion.js). Con `lanzar`, además, se lanzan en la nube con la tarea programada de quien
// asigna (lib/lanzar.js), una sesión por tarea, que trabaja hasta el PR.
import { departamento as buscarDepartamento } from '../lib/becarios.js';
import { ErrorPeticion, json, leerJson, rutaPanel } from '../lib/http.js';
import { contextoLanzamiento, lanzarTarea } from '../lib/lanzar.js';
import { leerBecarios, pasarAlEquipo } from '../lib/notion.js';

const ID = /^[0-9a-f-]{32,36}$/i;

export default rutaPanel({
  async PUT(request, { usuario }) {
    const { tareas, departamento = 'desarrollo', lanzar = false, nota = '' } = await leerJson(request);
    if (!Array.isArray(tareas) || !tareas.length) throw new ErrorPeticion('No hay tareas que pasar al equipo.');
    if (tareas.length > 40) throw new ErrorPeticion('Como mucho 40 tareas de una vez.');
    if (tareas.some((id) => typeof id !== 'string' || !ID.test(id))) throw new ErrorPeticion('Hay una tarea sin identificar.');
    const dep = buscarDepartamento(departamento);
    if (!dep) throw new ErrorPeticion('Departamento desconocido.');
    if (typeof lanzar !== 'boolean') throw new ErrorPeticion('Falta decir si se lanzan en la nube.');
    if (lanzar && tareas.length > 10) throw new ErrorPeticion('Como mucho 10 tareas en la nube de una vez: cada una abre una sesión con tu suscripción.');
    if (typeof nota !== 'string' || nota.length > 500) throw new ErrorPeticion('La nota es como mucho de 500 caracteres.');
    // Las tareas entran por la entrada del departamento: si está pausada, no se le pasa nada. Si
    // no se pueden leer las fichas de los becarios, no se bloquea el trabajo por eso.
    const entrada = (await leerBecarios().catch(() => [])).find((b) => b.id === dep.entrada);
    if (entrada?.pausado) {
      const quien = dep.entrada === 'cto' ? 'El CTO' : `${entrada.nombre || dep.entrada}`;
      throw new ErrorPeticion(`${quien} está pausado y las tareas de ${dep.nombre} entran por él. Reactívalo en la pestaña «Becarios».`, 409);
    }
    // Antes de tocar nada, se comprueba que se puede lanzar (conexión, secreto, base de conexiones).
    const ctx = lanzar ? await contextoLanzamiento(usuario) : null;

    const hechas = [];
    const pasadas = [];
    // De una en una: Notion limita a unas 3 peticiones por segundo.
    for (const id of new Set(tareas)) {
      try {
        pasadas.push(await pasarAlEquipo(id, dep.entrada));
        hechas.push(id);
      } catch (error) {
        console.error(error);
        return json({ hechas, lanzadas: [], error: `Se han pasado ${hechas.length} de ${tareas.length}. Falló una tarea: ${error.message}` }, 502);
      }
    }
    if (!lanzar) return json({ hechas, lanzadas: [] });

    const lanzadas = [];
    for (const tarea of pasadas) {
      try {
        lanzadas.push(await lanzarTarea(tarea, ctx, { nota }));
      } catch (error) {
        console.error(error);
        return json({ hechas, lanzadas, error: `Se han pasado todas a ${dep.nombre} y se han lanzado ${lanzadas.length} de ${pasadas.length} en la nube. Falló «${tarea.titulo}»: ${error.message}` }, error.estado === 409 ? 409 : 502);
      }
    }
    return json({ hechas, lanzadas });
  },
});
