import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BECARIOS, combinarBecarios, DEPARTAMENTOS, departamentoDe, IDS_BECARIOS, IDS_DEPARTAMENTOS, miembrosDe, validarBecario } from '../lib/becarios.js';

test('sin fichas en Notion, los becarios son los de por defecto', () => {
  assert.deepEqual(combinarBecarios([]), BECARIOS);
  assert.deepEqual(combinarBecarios().filter((b) => b.departamento === 'desarrollo').map((b) => b.id), ['cto', 'diseno', 'frontend', 'backend-datos', 'backend-servicios', 'ia-automatizacion', 'qa-funcional', 'qa-tecnico', 'delivery']);
  assert.deepEqual(miembrosDe('seguridad'), ['sec-lead', 'sec-aplicaciones', 'sec-nube', 'sec-pentest', 'sec-dependencias', 'sec-cumplimiento']);
  assert.deepEqual(miembrosDe('qa'), [], 'ya no hay departamento de QA (los dos QA de desarrollo siguen)');
  assert.deepEqual(miembrosDe('marketing'), ['mk-lead', 'mk-seo', 'mk-contenidos', 'mk-rrss', 'mk-local', 'mk-analitica']);
  assert.deepEqual(miembrosDe('soporte'), ['it-lead', 'it-soporte', 'it-infraestructura', 'it-sistemas', 'it-comunicaciones', 'it-conectividad']);
});

test('cada departamento entra por uno de los suyos y todos los becarios tienen departamento', () => {
  assert.deepEqual(DEPARTAMENTOS.map((d) => [d.id, d.entrada]), [['desarrollo', 'cto'], ['seguridad', 'sec-lead'], ['marketing', 'mk-lead'], ['soporte', 'it-lead']]);
  for (const d of DEPARTAMENTOS) {
    assert.equal(departamentoDe(d.entrada), d.id);
    assert.equal(d.fases[0], 'Preparación', 'todos empiezan en Preparación');
    assert.ok(d.fases.includes('PR y revisión'), 'y todos pasan por el PR');
  }
  assert.ok(BECARIOS.every((b) => IDS_DEPARTAMENTOS.includes(b.departamento)));
  assert.equal(new Set(IDS_BECARIOS).size, IDS_BECARIOS.length, 'sin ids repetidos');
  assert.equal(departamentoDe('inventado'), null);
});

test('la ficha de Notion manda, pero lo que no vale se queda como estaba', () => {
  const [cto, frontend] = combinarBecarios([
    { id: 'cto', notionId: 'n1', url: 'u', nombre: ' Jefa técnica ', papel: '', pausado: true, instrucciones: 'Tests primero', avatar: { peinado: 'largo', accesorios: ['gafas', 'capa'], piel: '#FFAA00', pelo: 'negro', ropa: '', detalle: null } },
    { id: 'becario-falso', nombre: 'No existe' },
  ]);
  assert.equal(cto.nombre, 'Jefa técnica');
  assert.equal(cto.papel, BECARIOS[0].papel, 'sin papel, el de por defecto');
  assert.equal(cto.pausado, true);
  assert.equal(cto.instrucciones, 'Tests primero');
  assert.equal(cto.notionId, 'n1');
  assert.deepEqual(cto.avatar, { peinado: 'largo', accesorios: ['gafas'], piel: '#ffaa00', pelo: BECARIOS[0].avatar.pelo, ropa: BECARIOS[0].avatar.ropa, detalle: BECARIOS[0].avatar.detalle });
  assert.deepEqual(frontend, BECARIOS[1]);
});

const valida = { id: 'frontend', nombre: 'Front', papel: 'Interfaces', pausado: false, instrucciones: ' Usa TypeScript ', avatar: { peinado: 'rizado', accesorios: ['cascos', 'cascos'], piel: '#8D5524', pelo: '#1c1c1c', ropa: '#3f7fd6', detalle: '#ffb000' } };

test('validarBecario limpia una ficha correcta', () => {
  const { becario, error } = validarBecario(valida);
  assert.equal(error, undefined);
  assert.equal(becario.instrucciones, 'Usa TypeScript');
  assert.deepEqual(becario.avatar.accesorios, ['cascos']);
  assert.equal(becario.avatar.piel, '#8d5524');
});

test('validarBecario rechaza lo que no se puede guardar', () => {
  const casos = [
    [{ id: 'jefe' }, /desconocido/],
    [{ nombre: '  ' }, /nombre/],
    [{ nombre: 'x'.repeat(41) }, /nombre/],
    [{ papel: 'x'.repeat(121) }, /papel/],
    [{ instrucciones: 'x'.repeat(6001) }, /instrucciones/],
    [{ pausado: 'no' }, /pausado/],
    [{ avatar: { ...valida.avatar, peinado: 'cresta' } }, /Peinado/],
    [{ avatar: { ...valida.avatar, accesorios: ['capa'] } }, /Accesorio/],
    [{ avatar: { ...valida.avatar, ropa: 'rojo' } }, /colores/],
  ];
  for (const [cambio, motivo] of casos) assert.match(validarBecario({ ...valida, ...cambio }).error, motivo, JSON.stringify(cambio));
  assert.ok(validarBecario(null).error);
});

test('modelo y esfuerzo: vacíos manda el plugin, y solo valen los de Claude Code', () => {
  const fichas = combinarBecarios([{ id: 'frontend', modelo: 'haiku', esfuerzo: 'low' }, { id: 'backend-datos', modelo: 'gpt-5', esfuerzo: 'turbo' }]);
  const [cto, frontend, datos] = ['cto', 'frontend', 'backend-datos'].map((id) => fichas.find((b) => b.id === id));
  assert.deepEqual([cto.modelo, cto.esfuerzo, cto.plugin], [null, null, { modelo: 'opus', esfuerzo: 'high' }]);
  assert.deepEqual([frontend.modelo, frontend.esfuerzo, frontend.plugin], ['haiku', 'low', { modelo: 'sonnet', esfuerzo: null }]);
  assert.deepEqual([datos.modelo, datos.esfuerzo], [null, null], 'lo desconocido se ignora');
  assert.equal(validarBecario({ ...valida, modelo: 'fable', esfuerzo: 'max' }).becario.modelo, 'fable');
  assert.equal(validarBecario(valida).becario.esfuerzo, null, 'sin modelo ni esfuerzo, null');
  assert.match(validarBecario({ ...valida, modelo: 'gpt-5' }).error, /Modelo/);
  assert.match(validarBecario({ ...valida, esfuerzo: 'turbo' }).error, /Esfuerzo/);
});
