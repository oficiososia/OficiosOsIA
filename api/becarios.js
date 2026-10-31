// La pestaña «Becarios»: la ficha de cada becario (base «Becarios» de Notion) y en qué
// oficinas trabaja (columna «Becarios» de la base «Proyectos», que guarda /api/equipos).
import { combinarBecarios, validarBecario } from '../lib/becarios.js';
import { ErrorConfiguracion, ErrorPeticion, json, leerJson, rutaPanel } from '../lib/http.js';
import { ErrorNotion, guardarBecario, leerBecarios, leerProyectos } from '../lib/notion.js';
import { proyectosBase } from '../lib/oficina.js';

const motivo = (resultado) => {
  if (resultado.status === 'fulfilled') return null;
  const error = resultado.reason;
  if (error instanceof ErrorConfiguracion || error instanceof ErrorNotion) return error.message;
  throw error;
};

export default rutaPanel({
  async GET() {
    const [fichas, proyectos] = await Promise.allSettled([leerBecarios(), leerProyectos()]);
    const avisos = [];
    const sinFichas = motivo(fichas);
    const sinProyectos = motivo(proyectos);
    if (sinFichas) avisos.push(`No se pueden leer ni guardar las fichas: ${sinFichas}`);
    if (sinProyectos && sinProyectos !== sinFichas) avisos.push(`No se pueden leer ni guardar las oficinas: ${sinProyectos}`);
    const lista = proyectos.status === 'fulfilled' && Array.isArray(proyectos.value) ? proyectosBase(proyectos.value) : [];
    return json({
      becarios: combinarBecarios(fichas.status === 'fulfilled' ? fichas.value : []),
      proyectos: lista.map(({ id, nombre, equipo }) => ({ id, nombre, equipo })),
      fichasGuardables: !sinFichas,
      avisos,
    });
  },

  async PUT(request) {
    const { becario, error } = validarBecario(await leerJson(request));
    if (error) throw new ErrorPeticion(error);
    const guardado = await guardarBecario(becario);
    return json({ becario: combinarBecarios([guardado]).find((b) => b.id === becario.id) });
  },
});
