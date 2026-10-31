import { json } from '../lib/http.js';
import { cookieSesion, firmar } from '../lib/sesion.js';
import { comprobarCredenciales } from '../lib/usuarios.js';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export default {
  async fetch(request) {
    if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405, { Allow: 'POST' });
    const secreto = process.env.SESION_SECRETO;
    if (!secreto || !process.env.PANEL_USUARIOS) {
      return json({ error: 'El panel aún no está configurado: faltan PANEL_USUARIOS o SESION_SECRETO en Vercel.' }, 503);
    }
    const datos = await request.json().catch(() => ({}));
    const usuario = comprobarCredenciales(datos.usuario, datos.contrasena);
    if (!usuario) {
      // Frena los intentos a ciegas sin necesidad de guardar estado.
      await esperar(600);
      return json({ error: 'Usuario o contraseña incorrectos.' }, 401);
    }
    return json({ usuario }, 200, { 'Set-Cookie': cookieSesion(await firmar(usuario, secreto)) });
  },
};
