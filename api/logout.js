import { json } from '../lib/http.js';
import { cookieBorrada } from '../lib/sesion.js';

export default {
  fetch(request) {
    if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405, { Allow: 'POST' });
    return json({ ok: true }, 200, { 'Set-Cookie': cookieBorrada() });
  },
};
