// Chat con el equipo de producto sobre cómo van las tareas. El panel solo guarda los
// mensajes en Notion; contesta el equipo (PO, PM, CTO) cuando se ejecuta /producto en
// Claude Code, con la suscripción de Claude.
import { ErrorPeticion, json, leerJson, rutaPanel } from '../lib/http.js';
import { escribirMensaje, leerChat } from '../lib/notion.js';

export const MAXIMO = 2000;

export default rutaPanel({
  async GET() {
    const mensajes = await leerChat();
    return json({ mensajes, pendientes: mensajes.filter((m) => !m.deEquipo && m.estado === 'Pendiente').length });
  },

  async POST(request, { usuario }) {
    const { texto, proyecto } = await leerJson(request);
    if (typeof texto !== 'string' || !texto.trim()) throw new ErrorPeticion('Escribe un mensaje.');
    if (texto.length > MAXIMO) throw new ErrorPeticion(`El mensaje es demasiado largo (máximo ${MAXIMO} caracteres).`);
    if (proyecto != null && typeof proyecto !== 'string') throw new ErrorPeticion('Proyecto no válido.');
    const mensaje = await escribirMensaje({ textoMensaje: texto.trim(), usuario, proyecto: (proyecto || '').trim().slice(0, 120) });
    return json({ mensaje }, 201);
  },
});
