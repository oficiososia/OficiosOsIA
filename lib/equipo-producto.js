// Equipo de producto: PO, PM y CTO convierten una petición en texto plano en tickets para Notion.
// Cada rol es una llamada a Claude con salida JSON estructurada; el navegador las encadena
// para que se vea quién está trabajando y ninguna petición dure demasiado.
import Anthropic from '@anthropic-ai/sdk';
import { BECARIOS, IDS_BECARIOS } from './becarios.js';
import { ErrorConfiguracion, ErrorPeticion } from './http.js';
import { normalizar } from './oficina.js';
import { combinar, PRIORIDADES, TIPOS } from './tickets.js';

const MODELO = 'claude-opus-5-5';

const objeto = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const lista = (items) => ({ type: 'array', items });
const texto = { type: 'string' };
const entero = { type: 'integer' };

const ESQUEMAS = {
  po: objeto({
    historias: lista(
      objeto({
        titulo: texto,
        historia: texto,
        criterios: lista(objeto({ titulo: texto, detalle: texto })),
        fuera_de_alcance: lista(texto),
        suposiciones: lista(texto),
      }),
    ),
    preguntas: lista(texto),
  }),
  pm: objeto({
    planificacion: lista(
      objeto({
        historia: entero,
        prioridad: { type: 'string', enum: PRIORIDADES },
        tipo: { type: 'string', enum: TIPOS },
        estimacion_horas: { type: 'number' },
        orden: entero,
        depende_de: lista(entero),
        posible_duplicado: texto,
        motivo: texto,
      }),
    ),
    resumen: texto,
  }),
  cto: objeto({
    planes: lista(
      objeto({
        historia: entero,
        notas_tecnicas: texto,
        riesgos: lista(texto),
        becarios: lista({ type: 'string', enum: IDS_BECARIOS }),
        becario_inicial: { type: 'string', enum: IDS_BECARIOS },
      }),
    ),
    comentario: texto,
  }),
};

const CONTEXTO = `Formáis el equipo de producto de OficiosOsIA, una empresa pequeña (Miguel y Pablo) que hace software a medida para comercios locales y profesionales de oficios.
El desarrollo lo hace un equipo de agentes de IA, los «becarios»:
${BECARIOS.map((b) => `- ${b.id}: ${b.papel}`).join('\n')}
Cada tarea vive en la base «Oficios OS» de Notion y recorre estas fases: Preparación → Desarrollo y unitarias → Despliegue DEMO → QA DEMO → PR y revisión → Despliegue PROD → QA PROD → Cerrada.
Escribe en castellano de España, claro y concreto, para que un becario pueda empezar sin preguntar.`;

const SISTEMA = {
  po: `${CONTEXTO}

Eres la Product Owner. Conviertes la petición en texto plano en historias de usuario listas para los becarios.
- Una historia por resultado que se pueda entregar y probar por separado; si la petición es una sola cosa, una sola historia. Como mucho cinco.
- \`titulo\`: corto, como el de una tarea («Botones de acción en las tarjetas de novedades»).
- \`historia\`: «Como <quién> quiero <qué> para <para qué>», en una o dos frases.
- \`criterios\`: de tres a ocho criterios de aceptación que QA pueda comprobar, cada uno con un título corto y el detalle. Si hay interfaz, cubre móvil y escritorio, errores y validaciones.
- Si la petición deja algo abierto, decide lo más razonable y apúntalo en \`suposiciones\`. Usa \`preguntas\` solo para lo que, si la suposición falla, cambia mucho el trabajo.
- \`fuera_de_alcance\`: lo que alguien podría esperar y no entra.`,

  pm: `${CONTEXTO}

Eres el Project Manager. La PO ya ha escrito las historias de usuario; planifícalas, una entrada por historia y referida por su número:
- \`prioridad\`: Alta, Media o Baja, según el impacto para el negocio y la urgencia que se deduzca de la petición.
- \`tipo\`: Profunda (desarrollo que pasa por todas las fases), Rápida (cambio pequeño, menos de unas dos horas) o Administrativa (sin código).
- \`estimacion_horas\`: horas de trabajo de los becarios de principio a fin, con pruebas y despliegue.
- \`orden\` de ejecución (1 = primero) y \`depende_de\` con los números de las historias que tienen que ir antes.
- \`posible_duplicado\`: el título de la tarea abierta del proyecto que ya cubra lo mismo, o cadena vacía.
- \`motivo\`: una frase que justifique la prioridad.
En \`resumen\`, dos o tres frases con el plan para Miguel y Pablo.`,

  cto: `${CONTEXTO}

Eres el CTO. Tienes las historias de la PO y la planificación del PM. Para cada historia, referida por su número:
- \`notas_tecnicas\`: el enfoque técnico en Markdown: qué partes toca (datos, servicios, interfaz, despliegue), en qué orden trabajan los becarios y qué hay que probar. No ves el código: no inventes nombres de ficheros, tablas ni rutas; si das alguno por supuesto, márcalo como suposición.
- \`riesgos\`: los riesgos o dudas técnicas que más pueden cambiar el trabajo.
- \`becarios\`: los becarios que intervienen.
- \`becario_inicial\`: quien coge la tarea primero; normalmente cto, que prepara el plan.
En \`comentario\`, una frase con lo más importante para Miguel y Pablo.`,
};

let cliente;
function claude() {
  if (!process.env.ANTHROPIC_API_KEY) throw new ErrorConfiguracion('Falta ANTHROPIC_API_KEY en Vercel: el equipo de producto no puede trabajar.');
  cliente ??= new Anthropic();
  return cliente;
}

async function preguntar(paso, mensaje) {
  const respuesta = await claude().beta.messages.create({
    model: MODELO,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: ESQUEMAS[paso] } },
    system: SISTEMA[paso],
    messages: [{ role: 'user', content: mensaje }],
  });
  if (respuesta.stop_reason === 'refusal') throw new ErrorPeticion('Claude no ha querido tratar esta petición. Reformúlala.', 422);
  if (respuesta.stop_reason === 'max_tokens') throw new ErrorPeticion('La respuesta se ha quedado a medias. Prueba a dividir la petición.', 422);
  const bloque = respuesta.content.find((b) => b.type === 'text');
  if (!bloque) throw new Error('Claude no ha devuelto ninguna respuesta.');
  return JSON.parse(bloque.text);
}

export function mensajeUsuario({ paso, proyecto, peticion, usuario, abiertas, historias, planificacion }) {
  const partes = [
    `Proyecto: ${proyecto.nombre} (en Notion, «${proyecto.clave}»)`,
    `Repositorio: ${proyecto.repo || 'sin repositorio conocido'}`,
  ];
  if (abiertas) {
    partes.push(
      `Tareas abiertas de este proyecto en Notion:\n${abiertas.length ? abiertas.map((t) => `- ${t.titulo} (${t.estado}${t.fase ? ` · ${t.fase}` : ''})`).join('\n') : '- Ninguna'}`,
    );
  }
  partes.push(`Petición de ${usuario}:\n"""\n${peticion}\n"""`);
  if (paso !== 'po') partes.push(`Historias de la PO:\n${JSON.stringify(historias.map((h, i) => ({ numero: i + 1, ...h })), null, 2)}`);
  if (paso === 'cto') partes.push(`Planificación del PM:\n${JSON.stringify(planificacion, null, 2)}`);
  return partes.join('\n\n');
}

export function validarEntrada(datos) {
  const { paso, peticion, proyecto } = datos || {};
  if (!['po', 'pm', 'cto'].includes(paso)) throw new ErrorPeticion('Paso desconocido.');
  if (typeof peticion !== 'string' || !peticion.trim()) throw new ErrorPeticion('Escribe qué necesitas.');
  if (peticion.length > 8000) throw new ErrorPeticion('La petición es demasiado larga (máximo 8000 caracteres).');
  if (!proyecto || typeof proyecto.nombre !== 'string' || typeof proyecto.clave !== 'string') throw new ErrorPeticion('Elige un proyecto.');
  if (paso !== 'po' && (!Array.isArray(datos.historias) || !datos.historias.length)) throw new ErrorPeticion('Faltan las historias de la PO.');
  if (paso === 'cto' && !Array.isArray(datos.planificacion)) throw new ErrorPeticion('Falta la planificación del PM.');
  const objetos = (v, max) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object' && !Array.isArray(x)).slice(0, max) : []);
  return {
    paso,
    peticion: peticion.trim(),
    proyecto: { nombre: proyecto.nombre.slice(0, 120), clave: proyecto.clave.slice(0, 120), repo: typeof proyecto.repo === 'string' ? proyecto.repo.slice(0, 300) : null },
    historias: objetos(datos.historias, 5),
    planificacion: objetos(datos.planificacion, 5),
  };
}

// `leerAbiertas` se inyecta para poder probar sin Notion.
export async function ejecutarPaso(datos, { usuario, leerAbiertas }) {
  const entrada = validarEntrada(datos);
  let abiertas = null;
  if (entrada.paso !== 'cto') {
    try {
      abiertas = (await leerAbiertas()).filter((t) => normalizar(t.proyecto) === normalizar(entrada.proyecto.clave));
    } catch {
      abiertas = null; // Sin Notion, el equipo trabaja igual, solo que sin ver duplicados.
    }
  }
  const resultado = await preguntar(entrada.paso, mensajeUsuario({ ...entrada, usuario, abiertas }));
  if (entrada.paso !== 'cto') return { paso: entrada.paso, resultado };
  return { paso: 'cto', resultado, tickets: combinar(entrada.historias, entrada.planificacion, resultado.planes) };
}
