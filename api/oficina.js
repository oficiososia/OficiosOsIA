import { ErrorConfiguracion, json, rutaPanel } from '../lib/http.js';
import { combinarBecarios } from '../lib/becarios.js';
import { ErrorNotion, leerBecarios, leerProyectos, tareasAbiertas } from '../lib/notion.js';
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
    const [tareas, proyectos, fichas] = await Promise.allSettled([tareasAbiertas(), leerProyectos(), leerBecarios()]);
    const avisos = [...new Set([avisoDe(tareas), avisoDe(proyectos)].filter(Boolean))];
    // Sin la base «Becarios», los becarios salen como vienen por defecto.
    const avisoFichas = avisoDe(fichas);
    if (avisoFichas && !avisos.length) avisos.push(`No se leen las fichas de los becarios (${avisoFichas}).`);
    const oficina = construirOficina({
      tareas: tareas.status === 'fulfilled' ? tareas.value : [],
      proyectosNotion: proyectos.status === 'fulfilled' ? proyectos.value : null,
      becarios: combinarBecarios(fichas.status === 'fulfilled' ? fichas.value : []),
    });
    return json({ usuario, avisos, ...oficina });
  },
});
