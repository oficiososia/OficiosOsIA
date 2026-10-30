import { ErrorConfiguracion, json, rutaPanel } from '../lib/http.js';
import { ErrorNotion, leerProyectos, tareasAbiertas } from '../lib/notion.js';
import { construirOficina } from '../lib/oficina.js';

// Si Notion falla o falta configurarlo, la oficina se pinta igual (vacía) con un aviso,
// para que el panel siga sirviendo para el equipo de producto.
const avisoDe = (resultado) => {
  if (resultado.status === 'fulfilled') return null;
  const error = resultado.reason;
  if (error instanceof ErrorConfiguracion || error instanceof ErrorNotion) return error.message;
  throw error;
};

export default rutaPanel({
  async GET(_request, { usuario }) {
    const [tareas, proyectos] = await Promise.allSettled([tareasAbiertas(), leerProyectos()]);
    const avisos = [...new Set([avisoDe(tareas), avisoDe(proyectos)].filter(Boolean))];
    const oficina = construirOficina({
      tareas: tareas.status === 'fulfilled' ? tareas.value : [],
      proyectosNotion: proyectos.status === 'fulfilled' ? proyectos.value : null,
    });
    return json({ usuario, avisos, ...oficina });
  },
});
