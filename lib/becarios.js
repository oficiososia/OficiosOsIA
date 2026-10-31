// Los becarios son los agentes de IA de los plugins del marketplace oficiososia/becarios: corren en
// Claude Code (en el ordenador o en la nube, con la suscripción de quien los lanza).
// Los ids coinciden con las opciones de la propiedad «Becario» de la base Oficios OS de Notion.
// Esto es lo que se usa por defecto; cada becario se puede personalizar desde la pestaña
// «Becarios» del panel, que lo guarda en la base «Becarios» de Notion.
export const PEINADOS = ['corto', 'largo', 'rizado', 'mono', 'gorra', 'gorro'];
export const ACCESORIOS = ['gafas', 'cascos', 'barba', 'corbata', 'placa'];
export const LIMITES = { nombre: 40, papel: 120, instrucciones: 6000 };
// Cómo trabaja cada becario en Claude Code: el modelo y el esfuerzo con que se lanza. Vacío
// (null) es lo que diga la cabecera de su fichero en el plugin, que se recoge en `plugin`.
export const MODELOS = ['haiku', 'sonnet', 'opus', 'fable'];
export const ESFUERZOS = ['low', 'medium', 'high', 'xhigh', 'max'];
const enPlugin = (modelo, esfuerzo = null) => ({ modelo, esfuerzo });

const avatar = (peinado, accesorios, piel, pelo, ropa, detalle = '#ffb000') => ({ peinado, accesorios, piel, pelo, ropa, detalle });

// Departamentos de cada oficina. Producto está siempre (es el de /producto, ver
// .claude/); estos se añaden a cada oficina desde el botón «Equipo». Toda tarea entra a
// un departamento por su `entrada`, que hace el plan y decide quién sigue. `fases` son los
// valores de «Fase» en Notion por los que pasa una tarea de ese departamento hasta el PR (y,
// en desarrollo, hasta producción).
export const DEPARTAMENTOS = [
  {
    id: 'arranque',
    nombre: 'Arranque',
    entrada: 'ar-lead',
    papel: 'Montan un proyecto nuevo desde cero: arquitectura, base de código, entornos y calidad',
    fases: ['Preparación', 'Cimientos', 'PR y revisión'],
  },
  {
    id: 'desarrollo',
    nombre: 'Desarrollo',
    entrada: 'cto',
    papel: 'Diseñan, programan, prueban y despliegan',
    fases: ['Preparación', 'Desarrollo y unitarias', 'Despliegue DEMO', 'QA DEMO', 'PR y revisión', 'Despliegue PROD', 'QA PROD'],
  },
  {
    id: 'seguridad',
    nombre: 'Ciberseguridad',
    entrada: 'sec-lead',
    papel: 'Riesgos, aplicaciones, nube y datos, pentesting, dependencias, RGPD e incidentes',
    fases: ['Preparación', 'Auditoría', 'PR y revisión'],
  },
  {
    id: 'marketing',
    nombre: 'Marketing',
    entrada: 'mk-lead',
    papel: 'Posicionamiento, SEO, contenidos, redes sociales y analítica',
    fases: ['Preparación', 'Producción', 'PR y revisión'],
  },
  {
    id: 'soporte',
    nombre: 'Soporte IT',
    entrada: 'it-lead',
    papel: 'Infraestructura, sistemas, comunicaciones, conectividad y soporte a usuarios',
    fases: ['Preparación', 'Intervención', 'PR y revisión'],
  },
];
export const IDS_DEPARTAMENTOS = DEPARTAMENTOS.map((d) => d.id);
export const departamento = (id) => DEPARTAMENTOS.find((d) => d.id === id) || null;

export const BECARIOS = [
  // Arranque: el equipo completo para cuando un proyecto empieza de cero (plugin «arranque»).
  { id: 'ar-lead', departamento: 'arranque', nombre: 'Jefatura de arranque', papel: 'Descubrimiento técnico, arquitectura, plan de arranque y revisión', plugin: enPlugin('opus', 'high'), avatar: avatar('corto', ['gafas', 'corbata'], '#f1c27d', '#3b2414', '#6b5b2f', '#ffb000') },
  { id: 'ar-analisis', departamento: 'arranque', nombre: 'Análisis y alcance', papel: 'Alcance del MVP, mapa de la web, contenidos y lo que hay que pedir al cliente', avatar: avatar('largo', ['gafas'], '#e0ac69', '#5a3a22', '#2f9c95') },
  { id: 'ar-plataforma', departamento: 'arranque', nombre: 'Plataforma y DevOps', papel: 'Repositorio, entornos, CI/CD, Vercel y Supabase desde cero', avatar: avatar('gorro', ['barba'], '#c68642', '#1c1c1c', '#3a3a3a', '#3f7fd6') },
  { id: 'ar-diseno', departamento: 'arranque', nombre: 'Sistema de diseño', papel: 'Marca aplicada, tokens, componentes base y accesibilidad', avatar: avatar('mono', [], '#ffdbac', '#c05b8f', '#d94f8a', '#eeece8') },
  { id: 'ar-frontend', departamento: 'arranque', nombre: 'Frontend base', papel: 'Esqueleto de la app, rutas, páginas base, SEO y rendimiento', avatar: avatar('rizado', ['cascos'], '#8d5524', '#121212', '#3f7fd6', '#ffb000') },
  { id: 'ar-backend', departamento: 'arranque', nombre: 'Backend base', papel: 'Esquema de datos, autenticación, permisos (RLS) y API inicial', avatar: avatar('corto', [], '#a86b3c', '#2b2b2b', '#3e9b62') },
  { id: 'ar-calidad', departamento: 'arranque', nombre: 'Calidad desde el día 1', papel: 'Pruebas, linters, controles de calidad en CI y accesibilidad automática', avatar: avatar('gorra', ['placa'], '#e0ac69', '#6b3e1f', '#d6b13a', '#18191b') },
  { id: 'ar-documentacion', departamento: 'arranque', nombre: 'Documentación y traspaso', papel: 'README, CLAUDE.md, decisiones de arquitectura y traspaso a desarrollo', avatar: avatar('largo', ['gafas'], '#f1c27d', '#2b1a10', '#7d5fc9', '#eeece8') },
  // Desarrollo: el plugin «becarios» de siempre, más diseño e IA (plugins/desarrollo del marketplace).
  { id: 'cto', departamento: 'desarrollo', nombre: 'CTO', papel: 'Historia, plan técnico, reparto y revisión del PR', plugin: enPlugin('opus', 'high'), avatar: avatar('corto', ['gafas', 'corbata'], '#e0ac69', '#2b2b2b', '#7d5fc9') },
  { id: 'diseno', departamento: 'desarrollo', nombre: 'Diseño UX/UI', papel: 'Pantallas, prototipos, sistema de diseño y accesibilidad', avatar: avatar('mono', ['gafas'], '#f1c27d', '#c05b8f', '#e07b2a', '#18191b') },
  { id: 'frontend', departamento: 'desarrollo', nombre: 'Frontend', papel: 'Interfaces, responsive e integración con la API', avatar: avatar('rizado', ['cascos'], '#8d5524', '#1c1c1c', '#3f7fd6') },
  { id: 'backend-datos', departamento: 'desarrollo', nombre: 'Backend · datos', papel: 'Modelos, migraciones, consultas y permisos', avatar: avatar('corto', ['barba'], '#f1c27d', '#6b3e1f', '#3e9b62') },
  { id: 'backend-servicios', departamento: 'desarrollo', nombre: 'Backend · servicios', papel: 'Lógica de negocio, endpoints e integraciones', avatar: avatar('gorro', [], '#c68642', '#3b2414', '#8a6343', '#d9473b') },
  { id: 'ia-automatizacion', departamento: 'desarrollo', nombre: 'IA y automatizaciones', papel: 'Chatbots, integraciones con Claude, automatizaciones y WhatsApp', avatar: avatar('rizado', ['cascos'], '#c68642', '#2b1a10', '#2f9c95', '#ffb000') },
  { id: 'qa-funcional', departamento: 'desarrollo', nombre: 'QA funcional', papel: 'Recorridos de usuario y criterios de aceptación', avatar: avatar('mono', ['placa'], '#ffdbac', '#b5562b', '#d6b13a', '#18191b') },
  { id: 'qa-tecnico', departamento: 'desarrollo', nombre: 'QA técnico', papel: 'Pruebas de integración, API y regresión', avatar: avatar('largo', ['gafas'], '#e0ac69', '#121212', '#c9473f') },
  { id: 'delivery', departamento: 'desarrollo', nombre: 'Delivery', papel: 'Despliegues a DEMO y PROD y registro en Notion', avatar: avatar('gorra', ['placa'], '#a86b3c', '#2b2b2b', '#e07b2a', '#18191b') },
  // Ciberseguridad: auditan, prueban y protegen (plugin «seguridad» del marketplace oficiososia/becarios).
  { id: 'sec-lead', departamento: 'seguridad', nombre: 'Responsable de seguridad', papel: 'Riesgos, prioridad, reparto y veredicto de seguridad', plugin: enPlugin('opus', 'high'), avatar: avatar('corto', ['gafas', 'corbata'], '#c68642', '#1c1c1c', '#2b2f36', '#d9473b') },
  { id: 'sec-aplicaciones', departamento: 'seguridad', nombre: 'Seguridad de aplicaciones', papel: 'OWASP, autenticación, sesiones, inyecciones, XSS y control de acceso', avatar: avatar('rizado', ['gafas'], '#8d5524', '#121212', '#3e9b62') },
  { id: 'sec-nube', departamento: 'seguridad', nombre: 'Nube y datos', papel: 'Supabase (RLS), Vercel, cabeceras, WAF, cifrado, secretos y copias', avatar: avatar('largo', [], '#f1c27d', '#3b2414', '#3f7fd6') },
  { id: 'sec-pentest', departamento: 'seguridad', nombre: 'Pentesting', papel: 'Pruebas de intrusión autorizadas sobre DEMO y preview', avatar: avatar('gorro', ['cascos'], '#a86b3c', '#121212', '#1f1f23', '#3e9b62') },
  { id: 'sec-dependencias', departamento: 'seguridad', nombre: 'Dependencias y secretos', papel: 'Librerías vulnerables, cadena de suministro, SBOM y secretos filtrados', avatar: avatar('mono', ['gafas'], '#ffdbac', '#6b3e1f', '#d6b13a', '#18191b') },
  { id: 'sec-cumplimiento', departamento: 'seguridad', nombre: 'Cumplimiento y privacidad', papel: 'RGPD, cookies, NIS2, brechas de datos, políticas y concienciación', avatar: avatar('corto', ['corbata'], '#e0ac69', '#5a3a22', '#7d5fc9', '#eeece8') },
  // Marketing: posicionamiento, SEO, contenidos y redes (plugin «marketing» del mismo marketplace).
  { id: 'mk-lead', departamento: 'marketing', nombre: 'Dirección de marketing', papel: 'Posicionamiento, plan de marketing, reparto y revisión', plugin: enPlugin('opus', 'high'), avatar: avatar('corto', ['corbata'], '#c68642', '#2b2b2b', '#c05b8f', '#ffb000') },
  { id: 'mk-seo', departamento: 'marketing', nombre: 'SEO técnico', papel: 'Indexación, metadatos, datos estructurados, sitemap y velocidad', avatar: avatar('corto', ['gafas'], '#ffdbac', '#6b3e1f', '#3f7fd6') },
  { id: 'mk-contenidos', departamento: 'marketing', nombre: 'Contenidos', papel: 'Textos de la web, blog, palabras clave y publicaciones', avatar: avatar('rizado', [], '#e0ac69', '#5a3a22', '#e07b2a') },
  { id: 'mk-rrss', departamento: 'marketing', nombre: 'Redes sociales', papel: 'Calendario y publicaciones para Instagram, Facebook, LinkedIn y TikTok', avatar: avatar('mono', ['cascos'], '#8d5524', '#1c1c1c', '#d94f8a', '#eeece8') },
  { id: 'mk-local', departamento: 'marketing', nombre: 'SEO local', papel: 'Google Business Profile, reseñas, mapas y directorios locales', avatar: avatar('gorra', ['barba'], '#f1c27d', '#3b2414', '#3e9b62', '#ffb000') },
  { id: 'mk-analitica', departamento: 'marketing', nombre: 'Analítica', papel: 'Medición, conversiones, UTM e informes (con RGPD)', avatar: avatar('largo', ['gafas'], '#a86b3c', '#2b1a10', '#2f9c95') },
  // Soporte IT: infraestructura, sistemas, comunicaciones y conectividad (plugin «soporte»).
  { id: 'it-lead', departamento: 'soporte', nombre: 'Jefatura de soporte IT', papel: 'Diagnóstico, prioridad, reparto y revisión de cada incidencia', plugin: enPlugin('opus', 'high'), avatar: avatar('corto', ['gafas', 'cascos'], '#e0ac69', '#3a3a3a', '#2c5f8a', '#ffb000') },
  { id: 'it-soporte', departamento: 'soporte', nombre: 'Soporte IT', papel: 'Incidencias de usuarios, dudas, guías paso a paso y documentación', avatar: avatar('mono', ['cascos'], '#f1c27d', '#6b3e1f', '#4a90c2', '#18191b') },
  { id: 'it-infraestructura', departamento: 'soporte', nombre: 'Infraestructura', papel: 'Hosting, Vercel, Supabase, dominios, DNS, SSL, CDN y copias de seguridad', avatar: avatar('gorro', ['barba'], '#c68642', '#2b2b2b', '#4b5d6b', '#e07b2a') },
  { id: 'it-sistemas', departamento: 'soporte', nombre: 'Sistemas', papel: 'Equipos, sistemas operativos, cuentas y permisos, actualizaciones y monitorización', avatar: avatar('corto', ['gafas'], '#8d5524', '#121212', '#5a6e3a') },
  { id: 'it-comunicaciones', departamento: 'soporte', nombre: 'Comunicaciones', papel: 'Correo (SPF, DKIM, DMARC), notificaciones, telefonía, VoIP y WhatsApp Business', avatar: avatar('largo', ['cascos'], '#ffdbac', '#3b2414', '#8a5a9e', '#eeece8') },
  { id: 'it-conectividad', departamento: 'soporte', nombre: 'Conectividad', papel: 'Redes, wifi, VPN, routers, firewall, TPV y dispositivos conectados', avatar: avatar('gorra', [], '#a86b3c', '#1c1c1c', '#c9a23a', '#2c5f8a') },
].map((b) => ({ plugin: enPlugin('sonnet'), ...b, modelo: null, esfuerzo: null, pausado: false, instrucciones: '', notionId: null, url: null }));

export const IDS_BECARIOS = BECARIOS.map((b) => b.id);

// Departamento de un becario (null si no es de ninguno).
export const departamentoDe = (id) => BECARIOS.find((b) => b.id === id)?.departamento || null;
export const miembrosDe = (dep) => BECARIOS.filter((b) => b.departamento === dep).map((b) => b.id);

const COLOR = /^#[0-9a-f]{6}$/i;
const COLORES = ['piel', 'pelo', 'ropa', 'detalle'];

// Ficha completa de cada becario: lo que haya en Notion encima de lo de por defecto. Lo que
// falte o no valga (un color mal escrito, un peinado que no existe) se queda como estaba.
export function combinarBecarios(filas = []) {
  const porId = new Map((filas || []).filter((f) => IDS_BECARIOS.includes(f.id)).map((f) => [f.id, f]));
  return BECARIOS.map((base) => {
    const f = porId.get(base.id);
    if (!f) return base;
    const a = f.avatar || {};
    const accesorios = Array.isArray(a.accesorios) ? a.accesorios.filter((x) => ACCESORIOS.includes(x)) : null;
    return {
      ...base,
      nombre: f.nombre?.trim() || base.nombre,
      papel: f.papel?.trim() || base.papel,
      pausado: Boolean(f.pausado),
      instrucciones: f.instrucciones || '',
      modelo: MODELOS.includes(f.modelo) ? f.modelo : null,
      esfuerzo: ESFUERZOS.includes(f.esfuerzo) ? f.esfuerzo : null,
      notionId: f.notionId || null,
      url: f.url || null,
      avatar: {
        peinado: PEINADOS.includes(a.peinado) ? a.peinado : base.avatar.peinado,
        accesorios: accesorios ?? base.avatar.accesorios,
        ...Object.fromEntries(COLORES.map((c) => [c, COLOR.test(a[c] || '') ? a[c].toLowerCase() : base.avatar[c]])),
      },
    };
  });
}

// Comprueba lo que llega del panel para guardar un becario. Devuelve la ficha limpia o el motivo del rechazo.
export function validarBecario(cuerpo) {
  const { id, nombre, papel, pausado, instrucciones, avatar: a, modelo = null, esfuerzo = null } = cuerpo || {};
  if (!IDS_BECARIOS.includes(id)) return { error: 'Becario desconocido.' };
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > LIMITES.nombre) return { error: `El nombre es obligatorio y como mucho de ${LIMITES.nombre} caracteres.` };
  if (typeof papel !== 'string' || papel.trim().length > LIMITES.papel) return { error: `El papel es como mucho de ${LIMITES.papel} caracteres.` };
  if (typeof instrucciones !== 'string' || instrucciones.length > LIMITES.instrucciones) return { error: `Las instrucciones son como mucho de ${LIMITES.instrucciones} caracteres.` };
  if (typeof pausado !== 'boolean') return { error: 'Falta decir si está pausado.' };
  if (modelo !== null && !MODELOS.includes(modelo)) return { error: 'Modelo desconocido.' };
  if (esfuerzo !== null && !ESFUERZOS.includes(esfuerzo)) return { error: 'Esfuerzo desconocido.' };
  if (!a || !PEINADOS.includes(a.peinado)) return { error: 'Peinado desconocido.' };
  if (!Array.isArray(a.accesorios) || a.accesorios.some((x) => !ACCESORIOS.includes(x))) return { error: 'Accesorio desconocido.' };
  if (COLORES.some((c) => !COLOR.test(a[c] || ''))) return { error: 'Los colores van en formato #rrggbb.' };
  return {
    becario: {
      id,
      nombre: nombre.trim(),
      papel: papel.trim(),
      pausado,
      instrucciones: instrucciones.trim(),
      modelo,
      esfuerzo,
      avatar: { peinado: a.peinado, accesorios: [...new Set(a.accesorios)], ...Object.fromEntries(COLORES.map((c) => [c, a[c].toLowerCase()])) },
    },
  };
}

// Proyectos con los que se arranca mientras no exista la base «Proyectos» en Notion.
// `clave` es el texto exacto de «Proyecto relacionado» en las tareas de Oficios OS; si son
// varios, van separados por comas y el primero es el que se usa para las tareas nuevas.
export const PROYECTOS_POR_DEFECTO = [
  { nombre: 'Energym', clave: 'Energym', repo: 'https://github.com/oficiososia/energym-demo' },
  { nombre: 'Casa Tomás', clave: 'Casa Tomás', repo: 'https://github.com/restcasatomascrevillent/web-casatomas' },
  // Nexo es el proyecto que en las tareas aparece como «Atletas».
  { nombre: 'Nexo', clave: 'Atletas, Nexo', repo: 'https://github.com/oficiososia/entrenos-atleta' },
  { nombre: 'JPR', clave: 'JPR', repo: 'https://github.com/oficiososia/jprfisio' },
  { nombre: 'Cristalería BV', clave: 'Cristalería', repo: null },
  { nombre: 'OficiosOS · Interno', clave: 'OficiosOS — Interno', repo: 'https://github.com/oficiososia/OficiosOsIA' },
];
