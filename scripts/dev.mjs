// Servidor local que imita lo que hace Vercel con este proyecto: sirve site/ con URLs limpias,
// pasa por middleware.js y ejecuta las funciones de api/. Lee las variables de .env.local.
//   npm run dev            → http://localhost:3000
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const sitio = join(raiz, 'site');
const puerto = Number(process.env.PORT) || 3000;

const entorno = join(raiz, '.env.local');
if (existsSync(entorno)) {
  for (const linea of readFileSync(entorno, 'utf8').split('\n')) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const { default: middleware, config } = await import(pathToFileURL(join(raiz, 'middleware.js')));
const protegidas = config.matcher.map((p) => new RegExp(`^${p}$`));

const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' };

async function estatico(ruta) {
  const limpia = normalize(decodeURIComponent(ruta)).replace(/^(\.\.[/\\])+/, '');
  for (const candidata of [limpia === '/' ? '/index.html' : limpia, `${limpia}.html`]) {
    const fichero = join(sitio, candidata);
    if (!fichero.startsWith(sitio)) break;
    try {
      if ((await stat(fichero)).isFile()) {
        return new Response(await readFile(fichero), { headers: { 'Content-Type': TIPOS[extname(fichero)] || 'application/octet-stream' } });
      }
    } catch {}
  }
  return new Response('No encontrado', { status: 404 });
}

async function responder(request) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) {
    const nombre = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, '');
    const fichero = join(raiz, 'api', `${nombre}.js`);
    if (!existsSync(fichero)) return new Response('No encontrado', { status: 404 });
    const { default: funcion } = await import(pathToFileURL(fichero));
    return funcion.fetch(request);
  }
  let cabeceras = new Headers();
  if (protegidas.some((r) => r.test(url.pathname))) {
    const salida = await middleware(request);
    if (salida.headers.get('x-middleware-next') !== '1') return salida;
    cabeceras = salida.headers;
  }
  const respuesta = await estatico(url.pathname);
  cabeceras.forEach((valor, clave) => {
    if (!clave.startsWith('x-middleware')) respuesta.headers.set(clave, valor);
  });
  return respuesta;
}

createServer(async (req, res) => {
  try {
    const trozos = [];
    for await (const trozo of req) trozos.push(trozo);
    const request = new Request(`http://${req.headers.host}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(trozos),
    });
    const respuesta = await responder(request);
    const cabeceras = Object.fromEntries(respuesta.headers);
    // Object.fromEntries junta las Set-Cookie en una sola; se pasan como lista.
    if (respuesta.headers.getSetCookie().length) cabeceras['set-cookie'] = respuesta.headers.getSetCookie();
    res.writeHead(respuesta.status, cabeceras);
    res.end(Buffer.from(await respuesta.arrayBuffer()));
  } catch (error) {
    console.error(error);
    res.writeHead(500).end('Error del servidor local');
  }
}).listen(puerto, () => console.log(`Panel en http://localhost:${puerto}`));
