import { IDS_BECARIOS } from '../lib/becarios.js';
import { ErrorPeticion, json, leerJson, rutaPanel } from '../lib/http.js';
import { guardarEquipo } from '../lib/notion.js';

export default rutaPanel({
  async PUT(request) {
    const { proyectoId, equipo } = await leerJson(request);
    if (typeof proyectoId !== 'string' || !/^[0-9a-f-]{32,36}$/i.test(proyectoId)) throw new ErrorPeticion('Falta el proyecto.');
    if (!Array.isArray(equipo) || equipo.some((id) => !IDS_BECARIOS.includes(id))) throw new ErrorPeticion('El equipo tiene becarios desconocidos.');
    await guardarEquipo(proyectoId, [...new Set(equipo)]);
    return json({ ok: true });
  },
});
