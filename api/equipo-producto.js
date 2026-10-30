import { ejecutarPaso } from '../lib/equipo-producto.js';
import { json, leerJson, rutaPanel } from '../lib/http.js';
import { tareasAbiertas } from '../lib/notion.js';

export default rutaPanel({
  async POST(request, { usuario }) {
    return json(await ejecutarPaso(await leerJson(request), { usuario, leerAbiertas: tareasAbiertas }));
  },
});
