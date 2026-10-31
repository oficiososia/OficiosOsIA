// Lanza una tarea de Notion en la nube con la tarea programada de quien la lanza (lib/nube.js).
// Comprueba antes todo lo que haría fallar la sesión: que la tarea esté en un departamento, que
// el proyecto tenga repositorio, que su entrada esté en el equipo y sin pausar y que la persona
// tenga conexión para ese proyecto.
import { combinarBecarios, departamento as buscarDepartamento } from './becarios.js';
import { descifrar } from './cifrado.js';
import { ErrorPeticion } from './http.js';
import { anotarLanzamiento, leerBecarios, leerConexiones, leerProyectos } from './notion.js';
import { disparar, textoEncargo } from './nube.js';
import { departamentoDeTarea, normalizar, proyectosBase } from './oficina.js';

const sinGuiones = (id) => String(id || '').replace(/-/g, '').toLowerCase();

// Lo que hace falta para lanzar, leído una sola vez aunque se lancen varias tareas.
export async function contextoLanzamiento(usuario) {
  const [proyectos, fichas, conexiones] = await Promise.all([leerProyectos(), leerBecarios().catch(() => []), leerConexiones(usuario)]);
  return { usuario, salas: proyectosBase(proyectos || []), becarios: combinarBecarios(fichas), conexiones };
}

export const salaDeTarea = (salas, tarea) => salas.find((s) => s.claves.some((c) => normalizar(c) === normalizar(tarea.proyecto))) || null;

export const conexionDe = (conexiones, proyectoId) => conexiones.find((c) => sinGuiones(c.proyectoId) === sinGuiones(proyectoId)) || null;

// Becarios del departamento que trabajan en la sala y no están pausados.
export const equipoDe = (sala, dep, becarios) => becarios.filter((b) => b.departamento === dep.id && sala.equipo.includes(b.id) && !b.pausado).map((b) => b.id);

export async function lanzarTarea(tarea, ctx, { nota = '' } = {}) {
  if (tarea.estado === 'Hecha') throw new ErrorPeticion(`«${tarea.titulo}» ya está hecha.`, 409);
  const sala = salaDeTarea(ctx.salas, tarea);
  if (!sala?.id) throw new ErrorPeticion(`«${tarea.proyecto || 'Sin proyecto'}» no está en la base «Proyectos» de Notion: añádelo para poder lanzar sus tareas.`, 409);
  if (!sala.repo) throw new ErrorPeticion(`${sala.nombre} no tiene «Repositorio» en la base «Proyectos»: la sesión no sabría dónde trabajar.`, 409);
  const dep = buscarDepartamento(departamentoDeTarea(tarea));
  if (!dep) throw new ErrorPeticion(`«${tarea.titulo}» aún no está en ningún departamento: pásala primero con «Asignar tareas».`, 409);
  const entrada = ctx.becarios.find((b) => b.id === dep.entrada);
  if (entrada?.pausado) throw new ErrorPeticion(`${entrada.nombre} está en pausa y las tareas de ${dep.nombre} entran por su mesa. Reactívalo en «Becarios».`, 409);
  const equipo = equipoDe(sala, dep, ctx.becarios);
  if (!equipo.includes(dep.entrada)) throw new ErrorPeticion(`${sala.nombre} no tiene a ${entrada?.nombre || dep.entrada} en ${dep.nombre}: añádelo con «Equipo».`, 409);
  const conexion = conexionDe(ctx.conexiones, sala.id);
  if (!conexion) throw new ErrorPeticion(`No tienes conexión con Claude para ${sala.nombre}. Configúrala en la pestaña «Conexiones».`, 409);
  const token = await descifrar(conexion.token, { usuario: ctx.usuario, proyectoId: sala.id });
  if (!token) throw new ErrorPeticion(`No se puede leer tu token de ${sala.nombre} (¿ha cambiado CONEXIONES_SECRETO en Vercel?). Vuelve a pegarlo en «Conexiones».`, 409);

  const { sesionUrl } = await disparar({ disparador: conexion.disparador, token, texto: textoEncargo({ tarea, sala, departamento: dep, equipo, usuario: ctx.usuario, nota }) });
  // La sesión ya está en marcha: si falla la nota en Notion, se avisa pero no se lanza otra vez.
  try {
    await anotarLanzamiento(tarea.id, { usuario: ctx.usuario, sesionUrl, departamento: dep.nombre });
    return { id: tarea.id, sesionUrl };
  } catch (error) {
    console.error(error);
    return { id: tarea.id, sesionUrl, aviso: `Lanzada, pero no se ha podido anotar en Notion (${error.message}).` };
  }
}
