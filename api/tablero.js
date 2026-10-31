import { json, rutaPanel } from '../lib/http.js';
import { leerProyectos, tareasTablero } from '../lib/notion.js';
import { mapaSalas } from '../lib/oficina.js';
import { construirTablero } from '../lib/tablero.js';
import { DEPARTAMENTOS } from '../lib/becarios.js';

export default rutaPanel({
  async GET() {
    // Si la base «Proyectos» no se puede leer, las tarjetas muestran el texto de la tarea tal cual.
    const [tareas, proyectos] = await Promise.all([tareasTablero(), leerProyectos().catch(() => null)]);
    return json({ ...construirTablero(tareas, mapaSalas(proyectos)), departamentos: DEPARTAMENTOS.map(({ id, nombre }) => ({ id, nombre })) });
  },
});
