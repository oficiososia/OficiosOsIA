// Aspecto de cada oficina: color, suelo, mesas, decoración pixel-art y logo en la pared.
// El color y el logo se pueden cambiar desde Notion (columnas «Color» y «Logo» de Proyectos).
import { enlace, escapar } from './util.js';

const PALETA_BASE = { s: '#5c5f66', k: '#3b3e44', w: '#e8e4dc', f: '#8b8f96', g: '#2f5d3a', r: '#7a2032', o: '#e0b33a', x: '#a8801f', c: '#9fd3e6', h: '#eaf7fb', l: '#6bd17a', b: '#5b8bd9', y: '#f2d264', p: '#e58bb5', t: '#9ad4bd', m: '#6b4a2b' };

// Objetos dibujados píxel a píxel; «a» es el color de la oficina.
const OBJETOS = {
  mancuernas: [
    'aa........aa',
    'aassssssssaa',
    'aa........aa',
    '............',
    'aa........aa',
    'aassssssssaa',
    'aa........aa',
    '.k........k.',
    '.k........k.',
    'kkkkkkkkkkkk',
  ],
  kettlebell: ['..sss..', '.s...s.', '.aaaaa.', 'aaaaaaa', 'aaaaaaa', 'aaaaaaa', '.aaaaa.'],
  botellero: [
    'mmmmmmmmmmmmmm',
    'm.g.r.g.r.g.rm',
    'm.g.r.g.r.g.rm',
    'm.g.r.g.r.g.rm',
    'mmmmmmmmmmmmmm',
    'm.r.g.r.g.r.gm',
    'm.r.g.r.g.r.gm',
    'm.r.g.r.g.r.gm',
    'mmmmmmmmmmmmmm',
  ],
  olla: ['.ssssss.', 'ssssssss', '.aaaaaa.', 'saaaaaas', '.aaaaaa.', '.aaaaaa.', '..kkkk..'],
  medalla: ['a.....a', '.a...a.', '..a.a..', '...a...', '..ooo..', '.ooooo.', '.ooxoo.', '.ooooo.', '..ooo..'],
  crono: ['...kk...', '..wwww..', '.wwwwww.', 'wwwwkwww', 'wwwwkwww', 'wwwkkwww', '.wwwwww.', '..wwww..'],
  bidon: ['..kk..', '.aaaa.', '.wwww.', '.aaaa.', '.aaaa.', '.aaaa.', '.aaaa.', '.aaaa.'],
  camilla: ['....wwwww.......', 'tttttttttttttttt', 'tttttttttttttttt', '.s............s.', '.s............s.', '.s............s.', 'ss............ss'],
  columna: ['..ww..', '.wwww.', '..ww..', '.wwww.', '..ww..', '.wwww.', '..ww..', '.wwww.', '..ww..'],
  cristales: [
    'fffffff.ffffff',
    'fcccchf.fccchf',
    'fccchcf.fcchcf',
    'fcchccf.fchccf',
    'fchcccf.fhcccf',
    'fhccccf.fccccf',
    'fcccccf.fccccf',
    'fffffff.ffffff',
  ],
  servidor: ['kkkkkkkk', 'kssssslk', 'kkkkkkkk', 'kssssslk', 'kkkkkkkk', 'ksssssak', 'kkkkkkkk', 'kssssslk', 'kkkkkkkk', 'k......k', 'kkkkkkkk'],
  pizarra: [
    'ffffffffffffffff',
    'fwwwwwwwwwwwwwwf',
    'fwaaawwwbbbbwwwf',
    'fwwwwwwwwwwwwwwf',
    'fwbbbbbwwaaawwwf',
    'fwwwwwwwwwwwwwwf',
    'fwaawwwbbbwwwwwf',
    'fwwwwwwwwwwwwwwf',
    'ffffffffffffffff',
    '......f..f......',
  ],
  notas: ['yy.pp.aa', 'yy.pp.aa', '........', 'aa.yy.pp', 'aa.yy.pp'],
  planta: ['...gg...', '.gg..gg.', 'gggggggg', '.gggggg.', '..gggg..', '.mmmmmm.', '.mmmmmm.', '..mmmm..'],
};

const TEMAS = {
  energym: { acento: '#ff5a4e', pared: '#2b2526', suelo: 'goma', mesa: ['#45474d', '#61646b'], paredObjetos: ['mancuernas'], sueloObjetos: ['kettlebell', 'kettlebell'], sector: 'Gimnasio' },
  'casa-tomas': { acento: '#d4a574', pared: '#2e2924', suelo: 'terracota', mesa: ['#6b4a2b', '#8a6238'], logo: 'proyectos/casa-tomas.png', placaClara: true, paredObjetos: ['botellero'], sueloObjetos: ['olla', 'planta'], sector: 'Restaurante' },
  nexo: { acento: '#2ec4b6', pared: '#1f2a2c', suelo: 'pista', mesa: ['#3f4a52', '#56636c'], paredObjetos: ['medalla', 'crono'], sueloObjetos: ['bidon', 'bidon'], sector: 'Entrenos · triatlón' },
  jpr: { acento: '#7fc8a9', pared: '#232b28', suelo: 'clinica', mesa: ['#8a7a62', '#a8977c'], paredObjetos: ['columna'], sueloObjetos: ['camilla', 'planta'], sector: 'Fisioterapia' },
  cristaleria: { acento: '#7ec8e3', pared: '#222a30', suelo: 'baldosa', mesa: ['#4d5660', '#67727d'], paredObjetos: ['cristales'], sueloObjetos: ['cristales'], sector: 'Cristalería' },
  interno: { acento: '#ffb000', pared: '#2c2e32', suelo: 'moqueta', mesa: ['#5a3d24', '#7a5634'], logo: 'logo/oficiososia-horizontal-noche.svg', logoMini: 'logo/oficiososia-icono-app.svg', paredObjetos: ['pizarra'], sueloObjetos: ['servidor', 'planta'], sector: 'OficiosOsIA' },
  producto: { acento: '#e58bb5', pared: '#2a2430', suelo: 'moqueta', mesa: ['#5a3d24', '#7a5634'], logo: 'logo/oficiososia-horizontal-noche.svg', logoMini: 'logo/oficiososia-icono-app.svg', paredObjetos: ['pizarra', 'notas'], sueloObjetos: ['planta'], sector: 'Sala de producto' },
  generico: { acento: '#9b9a97', pared: '#2c2e32', suelo: 'madera', mesa: ['#6b4a2b', '#8a6238'], paredObjetos: [], sueloObjetos: ['planta'], sector: '' },
};

const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function claveTema(sala) {
  const texto = normalizar([sala.nombre, ...(sala.claves || [])].join(' '));
  if (sala.producto) return 'producto';
  if (texto.includes('energym')) return 'energym';
  if (texto.includes('casa tomas')) return 'casa-tomas';
  if (texto.includes('nexo') || texto.includes('atletas')) return 'nexo';
  if (texto.includes('jpr')) return 'jpr';
  if (texto.includes('cristaler')) return 'cristaleria';
  if (texto.includes('oficiosos') || texto.includes('interno')) return 'interno';
  return 'generico';
}

export function temaDe(sala) {
  const id = claveTema(sala);
  const tema = { id, ...TEMAS[id] };
  if (/^#[0-9a-f]{6}$/i.test(sala.color || '')) tema.acento = sala.color;
  if (enlace(sala.logo)) {
    tema.logo = sala.logo;
    tema.logoMini = null;
    tema.placaClara = true;
  }
  return tema;
}

export function estiloTema(tema) {
  return `--acento:${tema.acento};--pared:${tema.pared};--madera:${tema.mesa[0]};--madera-borde:${tema.mesa[1]}`;
}

function objeto(nombre, acento) {
  const mapa = OBJETOS[nombre];
  const paleta = { ...PALETA_BASE, a: acento };
  const rects = [];
  mapa.forEach((fila, y) => {
    for (let x = 0; x < fila.length; ) {
      const letra = fila[x];
      let ancho = 1;
      while (fila[x + ancho] === letra) ancho++;
      if (letra !== '.' && paleta[letra]) rects.push(`<rect x="${x}" y="${y}" width="${ancho}" height="1" fill="${paleta[letra]}"/>`);
      x += ancho;
    }
  });
  const ancho = Math.max(...mapa.map((f) => f.length));
  return `<svg class="objeto objeto--${nombre}" style="--w:${ancho};--h:${mapa.length}" viewBox="0 0 ${ancho} ${mapa.length}" shape-rendering="crispEdges" aria-hidden="true">${rects.join('')}</svg>`;
}

// Pared: logo (o cartel con el nombre), ventanas y objetos. Suelo: objetos en la esquina.
export function decorado(sala, tema) {
  const rotulo = tema.logo
    ? `<span class="rotulo rotulo--logo${tema.placaClara ? ' rotulo--claro' : ''}"><img src="${escapar(tema.logo)}" alt="Logo de ${escapar(sala.nombre)}"></span>`
    : `<span class="rotulo"><strong>${escapar(sala.nombre)}</strong>${tema.sector ? `<small>${escapar(tema.sector)}</small>` : ''}</span>`;
  return `<div class="pared" aria-hidden="false">${rotulo}<span class="ventanas" aria-hidden="true"></span>
    <span class="pared__objetos" aria-hidden="true">${tema.paredObjetos.map((o) => objeto(o, tema.acento)).join('')}</span></div>
    <div class="esquina" aria-hidden="true">${tema.sueloObjetos.map((o) => objeto(o, tema.acento)).join('')}</div>`;
}

export function logoPequeno(sala, tema) {
  if (tema.logoMini) return `<span class="sala__logo sala__logo--icono"><img src="${escapar(tema.logoMini)}" alt=""></span>`;
  return tema.logo
    ? `<span class="sala__logo${tema.placaClara ? ' sala__logo--claro' : ''}"><img src="${escapar(tema.logo)}" alt=""></span>`
    : `<span class="sala__logo sala__logo--inicial" aria-hidden="true">${escapar(sala.nombre.slice(0, 1))}</span>`;
}
