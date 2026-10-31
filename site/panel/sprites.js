// Avatares pixel-art propios (16×16) de los becarios y del equipo de producto.
// Cada letra del mapa es un color de la paleta del personaje; «.» es transparente.

const CARA = [
  '................',
  '................',
  '................',
  '................',
  '...ssssssssss...',
  '...ssessssess...',
  '...ssssssssss...',
  '...ssssmmssss...',
  '....ssssssss....',
  '......ssss......',
  '...cccccccccc...',
  '..cccccccccccc..',
  '.cccccccccccccc.',
  '.sccccccccccccs.',
  '.sccccccccccccs.',
  '..cccccccccccc..',
];

// Peinados y accesorios: se pintan encima de la cara, fila a fila.
const CAPAS = {
  corto: [
    '................',
    '.....hhhhhh.....',
    '....hhhhhhhh....',
    '...hhhhhhhhhh...',
    '...hh......hh...',
  ],
  largo: [
    '................',
    '.....hhhhhh.....',
    '....hhhhhhhh....',
    '...hhhhhhhhhh...',
    '..hhh......hhh..',
    '..hh........hh..',
    '..hh........hh..',
    '..hh........hh..',
    '..hhh......hhh..',
    '...hh......hh...',
  ],
  rizado: [
    '....h.hh.hh.....',
    '...hhhhhhhhhh...',
    '..hhhhhhhhhhhh..',
    '..hhhhhhhhhhhh..',
    '..hh........hh..',
    '..h..........h..',
  ],
  mono: [
    '......hhhh......',
    '......hhhh......',
    '....hhhhhhhh....',
    '...hhhhhhhhhh...',
    '...hh......hh...',
  ],
  gorra: [
    '................',
    '.....aaaaaa.....',
    '....aaaaaaaa....',
    '...aaaaaaaaaaaa.',
    '...hh......hh...',
  ],
  gorro: [
    '.......aa.......',
    '.....aaaaaa.....',
    '....aaaaaaaa....',
    '...aaaaaaaaaa...',
    '...hh......hh...',
  ],
  gafas: ['', '', '', '', '', '...gggg..gggg...', '....gg....gg....'],
  cascos: ['', '', '....aaaaaaaa....', '...a........a...', '...a........a...', '..aa........aa..', '..aa........aa..'],
  barba: ['', '', '', '', '', '', '...h........h...', '...hhhhmmhhhh...', '....hhhhhhhh....', '......hhhh......'],
  corbata: ['', '', '', '', '', '', '', '', '', '', '.......tt.......', '.......tt.......', '......tttt......', '.......tt.......', '.......tt.......'],
  placa: ['', '', '', '', '', '', '', '', '', '', '', '', '...aa...........', '...aa...........'],
};

const PERSONAJES = {
  cto: { capas: ['corto', 'gafas', 'corbata'], s: '#e0ac69', h: '#2b2b2b', c: '#7d5fc9', a: '#ffb000', g: '#eeece8', t: '#ffb000' },
  frontend: { capas: ['rizado', 'cascos'], s: '#8d5524', h: '#1c1c1c', c: '#3f7fd6', a: '#ffb000' },
  'backend-datos': { capas: ['corto', 'barba'], s: '#f1c27d', h: '#6b3e1f', c: '#3e9b62' },
  'backend-servicios': { capas: ['gorro'], s: '#c68642', h: '#3b2414', c: '#8a6343', a: '#d9473b' },
  'qa-funcional': { capas: ['mono', 'placa'], s: '#ffdbac', h: '#b5562b', c: '#d6b13a', a: '#18191b' },
  'qa-tecnico': { capas: ['largo', 'gafas'], s: '#e0ac69', h: '#121212', c: '#c9473f', g: '#eeece8' },
  delivery: { capas: ['gorra', 'placa'], s: '#a86b3c', h: '#2b2b2b', c: '#e07b2a', a: '#18191b' },
  po: { capas: ['largo'], s: '#f1c27d', h: '#5a3a22', c: '#c05b8f' },
  pm: { capas: ['corto', 'gafas'], s: '#8d5524', h: '#3a3a3a', c: '#2f9c95', g: '#eeece8' },
};

const OSCURO = { e: '#18191b', m: '#7a3b2e' };

// Opciones del editor de avatares (pestaña «Becarios»). El orden de los accesorios es el orden
// en que se pintan: las gafas debajo de los cascos, la corbata y la placa sobre la ropa.
export const PEINADOS = ['corto', 'largo', 'rizado', 'mono', 'gorra', 'gorro'];
export const ACCESORIOS = ['gafas', 'cascos', 'barba', 'corbata', 'placa'];

const desdeAvatar = (a) => ({
  capas: [a.peinado, ...ACCESORIOS.filter((x) => a.accesorios.includes(x))],
  s: a.piel, h: a.pelo, c: a.ropa, a: a.detalle, t: a.detalle, g: '#eeece8',
});

// Los avatares guardados en Notion sustituyen a los de por defecto.
export function ponerAvatares(becarios) {
  for (const b of becarios || []) if (b.avatar && CAPAS[b.avatar.peinado]) PERSONAJES[b.id] = desdeAvatar(b.avatar);
  cache.clear();
}

// Ojos cerrados: se tapan los ojos con piel y se dibuja una línea debajo. Va antes que
// los accesorios para que las gafas sigan encima.
const DORMIDO = ['', '', '', '', '', '.....s....s.....', '....mm....mm....'];

function mapa(personaje, dormido) {
  const filas = CARA.map((f) => f.split(''));
  const capas = (dormido ? [DORMIDO] : []).concat(personaje.capas.map((nombre) => CAPAS[nombre]));
  for (const capa of capas) {
    capa.forEach((fila, y) => {
      [...fila].forEach((letra, x) => {
        if (letra !== '.') filas[y][x] = letra;
      });
    });
  }
  return filas;
}

const cache = new Map();

function dibujar(personaje, dormido) {
  const colores = { ...OSCURO, ...personaje };
  const rects = [];
  mapa(personaje, dormido).forEach((fila, y) => {
    // Agrupa píxeles seguidos del mismo color en un solo rectángulo.
    for (let x = 0; x < fila.length; ) {
      const letra = fila[x];
      let ancho = 1;
      while (fila[x + ancho] === letra) ancho++;
      if (letra !== '.' && colores[letra]) rects.push(`<rect x="${x}" y="${y}" width="${ancho}" height="1" fill="${colores[letra]}"/>`);
      x += ancho;
    }
  });
  return rects.join('');
}

const svg = (contenido, titulo) => {
  const etiqueta = titulo ? ` role="img" aria-label="${titulo}"` : ' aria-hidden="true"';
  return `<svg class="sprite" viewBox="0 0 16 16" shape-rendering="crispEdges"${etiqueta}>${contenido}</svg>`;
};

export function sprite(id, { titulo = '', dormido = false } = {}) {
  const clave = `${id}${dormido ? ':dormido' : ''}`;
  if (!cache.has(clave)) cache.set(clave, dibujar(PERSONAJES[id] || PERSONAJES.cto, dormido));
  return svg(cache.get(clave), titulo);
}

// Para la vista previa del editor: un avatar que aún no está guardado.
export function spriteAvatar(avatar, { titulo = '', dormido = false } = {}) {
  return svg(dibujar(desdeAvatar(avatar), dormido), titulo);
}
