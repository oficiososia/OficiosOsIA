// Pestaña «Conexiones»: la tarea programada de Claude Code de cada persona en cada proyecto.
// Cada uno ve y toca solo las suyas (las de la sesión). El token nunca vuelve al navegador:
// se guarda cifrado en Notion y solo se descifra en el servidor al lanzar una tarea.
import { cifradoListo, cifrar } from '../lib/cifrado.js';
import { ErrorConfiguracion, ErrorPeticion, json, leerJson, rutaPanel } from '../lib/http.js';
import { conexionDe } from '../lib/lanzar.js';
import { borrarConexion, ErrorNotion, guardarConexion, leerConexiones, leerProyectos } from '../lib/notion.js';
import { validarConexion } from '../lib/nube.js';
import { proyectosBase } from '../lib/oficina.js';

const ID = /^[0-9a-f-]{32,36}$/i;

const motivo = (resultado) => {
  if (resultado.status === 'fulfilled') return null;
  const error = resultado.reason;
  if (error instanceof ErrorConfiguracion || error instanceof ErrorNotion) return error.message;
  throw error;
};

async function proyectoDe(proyectoId) {
  if (typeof proyectoId !== 'string' || !ID.test(proyectoId)) throw new ErrorPeticion('Falta el proyecto.');
  const proyecto = proyectosBase((await leerProyectos()) || []).find((p) => p.id && p.id.replace(/-/g, '') === proyectoId.replace(/-/g, ''));
  if (!proyecto) throw new ErrorPeticion('Ese proyecto no está en la base «Proyectos».', 404);
  return proyecto;
}

export default rutaPanel({
  async GET(_request, { usuario }) {
    const [proyectos, conexiones] = await Promise.allSettled([leerProyectos(), leerConexiones(usuario)]);
    const avisos = [];
    if (!cifradoListo()) avisos.push('Falta CONEXIONES_SECRETO en Vercel: hasta que esté, no se pueden guardar conexiones ni lanzar tareas en la nube.');
    const sinProyectos = motivo(proyectos);
    if (sinProyectos) avisos.push(`No se leen los proyectos: ${sinProyectos}`);
    const sinConexiones = motivo(conexiones);
    if (sinConexiones) avisos.push(`No se lee la base «Conexiones» de Notion: ${sinConexiones}`);
    const mias = conexiones.status === 'fulfilled' ? conexiones.value : [];
    const lista = proyectos.status === 'fulfilled' ? proyectosBase(proyectos.value || []).filter((p) => p.id) : [];
    return json({
      usuario,
      guardable: cifradoListo() && !sinConexiones,
      avisos,
      proyectos: lista.map((p) => {
        const c = conexionDe(mias, p.id);
        return {
          id: p.id,
          nombre: p.nombre,
          repo: p.repo,
          conexion: c ? { disparador: c.disparador, pista: c.pista, actualizada: c.actualizada } : null,
        };
      }),
    });
  },

  async PUT(request, { usuario }) {
    const cuerpo = await leerJson(request);
    const { conexion, error } = validarConexion(cuerpo);
    if (error) throw new ErrorPeticion(error);
    const proyecto = await proyectoDe(cuerpo.proyectoId);
    const token = await cifrar(conexion.token, { usuario, proyectoId: proyecto.id });
    const guardada = await guardarConexion({ usuario, proyectoId: proyecto.id, nombreProyecto: proyecto.nombre, disparador: conexion.disparador, token, pista: conexion.pista });
    return json({ conexion: { disparador: guardada.disparador, pista: guardada.pista, actualizada: guardada.actualizada } });
  },

  async DELETE(request, { usuario }) {
    const { proyectoId } = await leerJson(request);
    const proyecto = await proyectoDe(proyectoId);
    return json({ borrada: await borrarConexion(usuario, proyecto.id) });
  },
});
