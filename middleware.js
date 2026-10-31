// Routing Middleware de Vercel: todo el sitio exige sesión salvo las rutas públicas.
// /entrenos y /legal siguen públicas porque son la «Website URL» y la política de privacidad
// que revisan intervals.icu y Garmin. Las funciones de /api comprueban la sesión por su cuenta.
import { next } from '@vercel/functions';
import { leerSesion } from './lib/sesion.js';

export const config = {
  matcher: ['/((?!api/|login|entrenos|legal|logo/|styles\\.css|favicon\\.ico|robots\\.txt).*)'],
};

export default async function middleware(request) {
  if (await leerSesion(request)) {
    return next({ headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
  }
  const url = new URL(request.url);
  const login = new URL('/login', url);
  if (url.pathname !== '/') login.searchParams.set('volver', url.pathname + url.search);
  return Response.redirect(login, 302);
}
