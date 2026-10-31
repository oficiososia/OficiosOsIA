// Los becarios son los agentes de IA del plugin «becarios», que corren en el ordenador.
// Los ids coinciden con las opciones de la propiedad «Becario» de la base Oficios OS de Notion.
// Esto es lo que se usa por defecto; cada becario se puede personalizar desde la pestaña
// «Becarios» del panel, que lo guarda en la base «Becarios» de Notion.
export const PEINADOS = ['corto', 'largo', 'rizado', 'mono', 'gorra', 'gorro'];
export const ACCESORIOS = ['gafas', 'cascos', 'barba', 'corbata', 'placa'];
export const LIMITES = { nombre: 40, papel: 120, instrucciones: 6000 };

const avatar = (peinado, accesorios, piel, pelo, ropa, detalle = '#ffb000') => ({ peinado, accesorios, piel, pelo, ropa, detalle });

export const BECARIOS = [
  { id: 'cto', nombre: 'CTO', papel: 'Historia, plan técnico, reparto y revisión del PR', avatar: avatar('corto', ['gafas', 'corbata'], '#e0ac69', '#2b2b2b', '#7d5fc9') },
  { id: 'frontend', nombre: 'Frontend', papel: 'Interfaces, responsive e integración con la API', avatar: avatar('rizado', ['cascos'], '#8d5524', '#1c1c1c', '#3f7fd6') },
  { id: 'backend-datos', nombre: 'Backend · datos', papel: 'Modelos, migraciones, consultas y permisos', avatar: avatar('corto', ['barba'], '#f1c27d', '#6b3e1f', '#3e9b62') },
  { id: 'backend-servicios', nombre: 'Backend · servicios', papel: 'Lógica de negocio, endpoints e integraciones', avatar: avatar('gorro', [], '#c68642', '#3b2414', '#8a6343', '#d9473b') },
  { id: 'qa-funcional', nombre: 'QA funcional', papel: 'Recorridos de usuario y criterios de aceptación', avatar: avatar('mono', ['placa'], '#ffdbac', '#b5562b', '#d6b13a', '#18191b') },
  { id: 'qa-tecnico', nombre: 'QA técnico', papel: 'Pruebas de integración, API y regresión', avatar: avatar('largo', ['gafas'], '#e0ac69', '#121212', '#c9473f') },
  { id: 'delivery', nombre: 'Delivery', papel: 'Despliegues a DEMO y PROD y registro en Notion', avatar: avatar('gorra', ['placa'], '#a86b3c', '#2b2b2b', '#e07b2a', '#18191b') },
].map((b) => ({ ...b, pausado: false, instrucciones: '', notionId: null, url: null }));

export const IDS_BECARIOS = BECARIOS.map((b) => b.id);

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
  const { id, nombre, papel, pausado, instrucciones, avatar: a } = cuerpo || {};
  if (!IDS_BECARIOS.includes(id)) return { error: 'Becario desconocido.' };
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > LIMITES.nombre) return { error: `El nombre es obligatorio y como mucho de ${LIMITES.nombre} caracteres.` };
  if (typeof papel !== 'string' || papel.trim().length > LIMITES.papel) return { error: `El papel es como mucho de ${LIMITES.papel} caracteres.` };
  if (typeof instrucciones !== 'string' || instrucciones.length > LIMITES.instrucciones) return { error: `Las instrucciones son como mucho de ${LIMITES.instrucciones} caracteres.` };
  if (typeof pausado !== 'boolean') return { error: 'Falta decir si está pausado.' };
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
