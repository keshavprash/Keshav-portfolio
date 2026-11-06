/* Neon signage. Katakana are defined here as stroke polylines rather than font glyphs, so they render
   identically on every device, including those without Japanese fonts installed. */
import * as THREE from '../../vendor/three.custom.min.js';

/* Each glyph is a list of polylines in a 0..1 cell. */
const KANA = {
  'コ': [[[.15,.2],[.85,.2],[.85,.8],[.15,.8]]],
  'ー': [[[.5,.12],[.5,.88]]],
  'ド': [[[.38,.1],[.38,.92]], [[.38,.42],[.78,.62]], [[.68,.1],[.76,.24]], [[.84,.06],[.92,.2]]],
  'ネ': [[[.5,.06],[.5,.18]], [[.2,.22],[.76,.22],[.28,.62]], [[.5,.5],[.5,.94]], [[.52,.52],[.82,.72]]],
  'オ': [[[.12,.34],[.88,.34]], [[.62,.08],[.62,.92],[.5,.86]], [[.58,.36],[.14,.8]]],
  'ン': [[[.2,.2],[.4,.34]], [[.16,.82],[.5,.72],[.84,.22]]],
  'ヨ': [[[.18,.16],[.82,.16],[.82,.86],[.18,.86]], [[.22,.5],[.82,.5]]],
  'ル': [[[.34,.14],[.34,.5],[.12,.86]], [[.6,.1],[.6,.8],[.9,.52]]],
  'フ': [[[.14,.2],[.84,.2],[.76,.52],[.36,.9]]],
  'ス': [[[.18,.18],[.78,.18],[.6,.52],[.14,.88]], [[.52,.6],[.88,.88]]],
  'タ': [[[.38,.08],[.16,.46]], [[.36,.22],[.82,.22],[.64,.62],[.2,.92]], [[.32,.48],[.72,.64]]],
  'ッ': [[[.2,.4],[.3,.58]], [[.46,.34],[.54,.54]], [[.78,.34],[.66,.66],[.4,.88]]],
  'ク': [[[.4,.08],[.14,.46]], [[.38,.22],[.84,.22],[.7,.6],[.3,.92]]],
  'カ': [[[.12,.3],[.84,.3],[.8,.86],[.62,.8]], [[.46,.08],[.42,.5],[.14,.9]]],
  'イ': [[[.8,.1],[.46,.46],[.12,.62]], [[.56,.4],[.56,.94]]],
  'ハ': [[[.36,.22],[.12,.78]], [[.62,.2],[.9,.78]]],
  'ツ': [[[.16,.22],[.28,.46]], [[.44,.16],[.54,.42]], [[.84,.16],[.7,.56],[.36,.9]]],
  'ラ': [[[.24,.12],[.76,.12]], [[.14,.34],[.84,.34],[.72,.64],[.34,.92]]],
  'メ': [[[.76,.12],[.66,.52],[.2,.9]], [[.26,.34],[.82,.82]]],
};

function strokeGlyph(g, char, x, y, size) {
  const strokes = KANA[char];
  if (!strokes) return;
  strokes.forEach((line) => {
    g.beginPath();
    line.forEach(([px, py], i) => {
      const X = x + px * size, Y = y + py * size;
      if (i) g.lineTo(X, Y); else g.moveTo(X, Y);
    });
    g.stroke();
  });
}

function neonPass(g, color, draw) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = color;
  g.fillStyle = color;
  g.shadowColor = color;
  g.shadowBlur = 26;
  draw();
  g.shadowBlur = 8;
  g.strokeStyle = '#ffffff';
  g.fillStyle = '#ffffff';
  draw();
  g.shadowBlur = 0;
}

/** Vertical katakana sign, the classic shape on a Japanese high street. */
export function kanaTexture(ctx, text, color) {
  const chars = [...text];
  const cell = 118;
  const canvas = document.createElement('canvas');
  canvas.width = 168;
  canvas.height = cell * chars.length + 44;
  const g = canvas.getContext('2d');
  g.fillStyle = '#04050d';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.strokeStyle = color; g.lineWidth = 3; g.globalAlpha = 0.5;
  g.strokeRect(7, 7, canvas.width - 14, canvas.height - 14);
  g.globalAlpha = 1;
  g.lineWidth = 8;
  neonPass(g, color, () => chars.forEach((c, i) => strokeGlyph(g, c, 28, 22 + i * cell, 112)));
  return ctx.texture(canvas);
}

/** Latin LED panel for billboards. */
export function textTexture(ctx, lines, color, opts = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = opts.width || 512;
  canvas.height = opts.height || 256;
  const g = canvas.getContext('2d');
  g.fillStyle = opts.bg || '#05060f';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.strokeStyle = color; g.globalAlpha = 0.55; g.lineWidth = 4;
  g.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  g.globalAlpha = 1;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const size = opts.size || 66;
  g.font = `800 ${size}px "Archivo Expanded", Arial, sans-serif`;
  const step = size * 1.2;
  const start = canvas.height / 2 - ((lines.length - 1) * step) / 2;
  neonPass(g, color, () => lines.forEach((l, i) => g.fillText(l, canvas.width / 2, start + i * step)));
  return ctx.texture(canvas);
}

const VIOLET = '#a784ff', CYAN = '#4feaff', AMBER = '#ffb648', BLUE = '#5d8bff';

export async function buildSigns(ctx) {
  const group = new THREE.Group();
  const flickers = [];
  const geo = new THREE.PlaneGeometry(1, 1);

  const sign = async (map, x, y, z, w, h, ry, power, flicker = 0.25) => {
    const mat = new THREE.MeshBasicMaterial({ map, side: THREE.FrontSide });
    mat.color.setScalar(power);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, 1);
    mesh.rotation.y = ry;
    group.add(mesh);
    flickers.push({ mat, power, flicker, seed: Math.random() * 100 });
    await ctx.pause(); // drawing glowing text to a canvas is slow: never do many in one go
  };

  const kana = (text, color) => kanaTexture(ctx, text, color);

  // rooftop towers either side of the hero view (positions follow LANDMARKS in city.js)
  await sign(kana('フルスタック', VIOLET), -22.3, 15, -16.4, 3.4, 14.2, 0, 2.9);
  await sign(kana('コード', CYAN), 24.3, 12, -20, 3.2, 7.4, 0, 2.6);
  await sign(kana('ネオン', AMBER), 33, 7, -19.9, 2.8, 6.6, 0, 2.2);
  await sign(textTexture(ctx, ['</>'], CYAN, { width: 512, height: 256, size: 130 }), -33, 27, -16.4, 11, 5.5, 0, 2.8, 0.1);
  await sign(kana('ヨル', BLUE), 29, 3, -19.9, 2.2, 3.6, 0, 2.2);
  await sign(textTexture(ctx, ['MERN', 'STACK'], AMBER, { width: 512, height: 512, size: 92 }), 40, 34, -44.4, 11, 11, 0, 1.9, 0.08);
  await sign(kana('カイハツ', CYAN), -37, 9, -44.4, 3.2, 10, 0, 2.5);

  // the canyon: one billboard per project, passed during the Projects section
  await sign(textTexture(ctx, ['AI INTERVIEW', 'PLATFORM'], CYAN, { width: 1024, height: 512, size: 96 }), -25.4, 3, -84, 13, 6.5, Math.PI / 2, 2.8, 0.08);
  await sign(textTexture(ctx, ['SPACE', 'SHOOTER'], AMBER, { width: 1024, height: 512, size: 116 }), -14.4, 1, -114, 13, 6.5, -Math.PI / 2, 2.5, 0.08);
  await sign(textTexture(ctx, ['TASK', 'MANAGEMENT'], VIOLET, { width: 1024, height: 512, size: 104 }), -25.9, -3, -138, 13, 6.5, Math.PI / 2, 2.7, 0.08);
  await sign(kana('フルスタック', AMBER), -13.2, 6, -86, 3, 12.6, -Math.PI / 2, 2.4);
  await sign(kana('コード', VIOLET), -26.4, -6, -110, 3, 7, Math.PI / 2, 2.6);
  await sign(kana('ネオン', CYAN), -12.2, 8, -142, 3, 7, -Math.PI / 2, 2.6);

  return {
    object: group,
    update(_dt, time) {
      for (let i = 0; i < flickers.length; i++) {
        const f = flickers[i];
        // mostly steady, with an occasional brief dip like a tired neon tube (never a rapid flash)
        const n = Math.sin(time * 0.7 + f.seed) * Math.sin(time * 1.9 + f.seed * 2.0);
        const dip = n > 0.82 ? 1 - f.flicker : 1;
        f.mat.color.setScalar(f.power * dip);
      }
    },
  };
}
