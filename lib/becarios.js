// Los becarios son los agentes de IA del plugin «becarios», que corren en el ordenador.
// Los ids coinciden con las opciones de la propiedad «Becario» de la base Oficios OS de Notion.
export const BECARIOS = [
  { id: 'cto', nombre: 'CTO', papel: 'Historia, plan técnico, reparto y revisión del PR' },
  { id: 'frontend', nombre: 'Frontend', papel: 'Interfaces, responsive e integración con la API' },
  { id: 'backend-datos', nombre: 'Backend · datos', papel: 'Modelos, migraciones, consultas y permisos' },
  { id: 'backend-servicios', nombre: 'Backend · servicios', papel: 'Lógica de negocio, endpoints e integraciones' },
  { id: 'qa-funcional', nombre: 'QA funcional', papel: 'Recorridos de usuario y criterios de aceptación' },
  { id: 'qa-tecnico', nombre: 'QA técnico', papel: 'Pruebas de integración, API y regresión' },
  { id: 'delivery', nombre: 'Delivery', papel: 'Despliegues a DEMO y PROD y registro en Notion' },
];

export const IDS_BECARIOS = BECARIOS.map((b) => b.id);

// Proyectos con los que se arranca mientras no exista la base «Proyectos» en Notion.
// `clave` es el texto exacto de «Proyecto relacionado» en las tareas de Oficios OS.
export const PROYECTOS_POR_DEFECTO = [
  { nombre: 'Energym', clave: 'Energym', repo: 'https://github.com/oficiososia/energym-demo' },
  { nombre: 'Casa Tomás', clave: 'Casa Tomás', repo: 'https://github.com/restcasatomascrevillent/web-casatomas' },
  { nombre: 'Nexo', clave: 'Nexo', repo: null },
  { nombre: 'JPR', clave: 'JPR', repo: 'https://github.com/oficiososia/jprfisio' },
  { nombre: 'Cristalería BV', clave: 'Cristalería', repo: null },
  { nombre: 'Atletas', clave: 'Atletas', repo: 'https://github.com/oficiososia/entrenos-atleta' },
  { nombre: 'OficiosOS · Interno', clave: 'OficiosOS — Interno', repo: 'https://github.com/oficiososia/OficiosOsIA' },
];
