import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mensajeUsuario, validarEntrada } from '../lib/equipo-producto.js';
import { combinar, markdownTicket, normalizarTicket } from '../lib/tickets.js';

const historias = [
  { titulo: 'Reservar clases', historia: 'Como socio quiero reservar para no llamar.', criterios: [{ titulo: 'Reserva', detalle: 'Se reserva desde el móvil.' }], fuera_de_alcance: ['Pagos'], suposiciones: ['Hay horario'] },
  { titulo: 'Recordatorio', historia: 'Como socio quiero un aviso.', criterios: [], fuera_de_alcance: [], suposiciones: [] },
];
const planificacion = [
  { historia: 2, prioridad: 'Media', tipo: 'Rápida', estimacion_horas: 3, orden: 2, depende_de: [1], posible_duplicado: '', motivo: 'Mejora' },
  { historia: 1, prioridad: 'Alta', tipo: 'Profunda', estimacion_horas: 12.3, orden: 1, depende_de: [], posible_duplicado: 'Reservas v1', motivo: 'Lo piden todos' },
];
const planes = [{ historia: 1, notas_tecnicas: 'Tabla de reservas.', riesgos: ['Horarios'], becarios: ['cto', 'frontend', 'cto'], becario_inicial: 'cto' }];

test('combinar junta PO, PM y CTO por número de historia y ordena por el PM', () => {
  const [primera, segunda] = combinar(historias, planificacion, planes);
  assert.equal(primera.titulo, 'Reservar clases');
  assert.equal(primera.prioridad, 'Alta');
  assert.equal(primera.horas, 12.5, 'las horas se redondean a medias horas');
  assert.deepEqual(primera.becarios, ['cto', 'frontend']);
  assert.equal(primera.posibleDuplicado, 'Reservas v1');
  assert.equal(segunda.titulo, 'Recordatorio');
  assert.deepEqual(segunda.dependeDe, ['Reservar clases']);
  assert.equal(segunda.becarioInicial, 'cto', 'sin plan del CTO, empieza cto');
});

test('normalizarTicket no deja pasar valores que Notion rechazaría', () => {
  const t = normalizarTicket({ titulo: 'x'.repeat(300), prioridad: 'Urgente', tipo: 'Otra', horas: -2, becarioInicial: 'jefe', becarios: ['frontend', 'hacker'], criterios: [null, { titulo: 'Ok', detalle: 'Bien' }] });
  assert.equal(t.titulo.length, 200);
  assert.equal(t.prioridad, 'Media');
  assert.equal(t.tipo, 'Profunda');
  assert.equal(t.horas, null);
  assert.equal(t.becarioInicial, 'cto');
  assert.deepEqual(t.becarios, ['frontend']);
  assert.deepEqual(t.criterios, [{ titulo: 'Ok', detalle: 'Bien' }]);
});

test('el Markdown sigue el formato de las tareas de los becarios', () => {
  const [ticket] = combinar(historias, planificacion, planes);
  const md = markdownTicket(ticket, { peticion: 'Quiero reservas\ny avisos', usuario: 'Pablo' });
  assert.match(md, /^Como socio quiero reservar/);
  assert.match(md, /## Criterios de aceptación\n\n- \[ \] \*\*1 · Reserva\.\*\* Se reserva desde el móvil\./);
  assert.match(md, /## Fuera de alcance\n\n- Pagos/);
  assert.match(md, /- Prioridad: Alta — Lo piden todos/);
  assert.match(md, /Posible duplicado de: «Reservas v1»/);
  assert.match(md, /\*\*Becarios que intervienen:\*\* cto, frontend\. Empieza cto\./);
  assert.match(md, /a petición de Pablo, a partir de:\n\n> Quiero reservas\n> y avisos$/);
});

test('validarEntrada exige paso, petición, proyecto y lo que dejó el paso anterior', () => {
  const proyecto = { nombre: 'Energym', clave: 'Energym', repo: null };
  assert.throws(() => validarEntrada({ paso: 'jefe', peticion: 'x', proyecto }), /Paso/);
  assert.throws(() => validarEntrada({ paso: 'po', peticion: '  ', proyecto }), /Escribe/);
  assert.throws(() => validarEntrada({ paso: 'po', peticion: 'x' }), /proyecto/);
  assert.throws(() => validarEntrada({ paso: 'pm', peticion: 'x', proyecto }), /historias/);
  assert.throws(() => validarEntrada({ paso: 'cto', peticion: 'x', proyecto, historias }), /planificación/);
  const ok = validarEntrada({ paso: 'pm', peticion: ' x ', proyecto, historias: [historias[0], null, 'texto'] });
  assert.equal(ok.peticion, 'x');
  assert.equal(ok.historias.length, 1, 'se descarta lo que no son historias');
});

test('el mensaje al equipo lleva el proyecto, las tareas abiertas y lo anterior', () => {
  const texto = mensajeUsuario({
    paso: 'cto',
    proyecto: { nombre: 'Energym', clave: 'Energym', repo: 'https://github.com/oficiososia/energym-demo' },
    peticion: 'Reservas',
    usuario: 'Miguel',
    abiertas: [{ titulo: 'Login', estado: 'Inbox', fase: 'Preparación' }],
    historias,
    planificacion,
  });
  assert.match(texto, /Repositorio: https:\/\/github.com\/oficiososia\/energym-demo/);
  assert.match(texto, /- Login \(Inbox · Preparación\)/);
  assert.match(texto, /Petición de Miguel:/);
  assert.match(texto, /"numero": 1/);
  assert.match(texto, /Planificación del PM/);
});
