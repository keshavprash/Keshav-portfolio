/* Neon signage, drawn to canvas textures: vertical street signs and wide billboards. */
import * as THREE from '../../vendor/three.custom.min.js';

function neonPass(g, color, draw) {
  g.fillStyle = color;
  g.shadowColor = color;
  g.shadowBlur = 26;
  draw();
  g.shadowBlur = 8;
  g.fillStyle = '#ffffff';
  draw();
  g.shadowBlur = 0;
}

/** Vertical sign with stacked letters. Also returns its height as a multiple of its width. */
function verticalTexture(ctx, text, color) {
  const cell = 104, width = 168, pad = 22;
  const chars = [...text];
  const height = chars.reduce((h, c) => h + (c === ' ' ? cell / 2 : cell), pad * 2);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  g.fillStyle = '#04050d';
  g.fillRect(0, 0, width, height);
  g.strokeStyle = color; g.lineWidth = 3; g.globalAlpha = 0.5;
  g.strokeRect(7, 7, width - 14, height - 14);
  g.globalAlpha = 1;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '800 88px "Archivo Expanded", Arial, sans-serif';
  neonPass(g, color, () => {
    let y = pad;
    chars.forEach((c) => {
      if (c !== ' ') g.fillText(c, width / 2, y + cell / 2);
      y += c === ' ' ? cell / 2 : cell;
    });
  });
  return { map: ctx.texture(canvas), ratio: height / width };
}

/** LED panel for billboards. */
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

  const vertical = (text, color, x, y, z, w, ry, power) => {
    const { map, ratio } = verticalTexture(ctx, text, color);
    return sign(map, x, y, z, w, w * ratio, ry, power);
  };

  // rooftop towers either side of the hero view (positions follow LANDMARKS in city.js)
  await vertical('FULL STACK', VIOLET, -22.3, 15, -16.4, 2.3, 0, 2.9);
  await vertical('CODE', CYAN, 24.3, 12, -20, 2.7, 0, 2.6);
  await vertical('NEON', AMBER, 33, 7, -19.9, 2.4, 0, 2.2);
  await sign(textTexture(ctx, ['</>'], CYAN, { width: 512, height: 256, size: 130 }), -33, 27, -16.4, 11, 5.5, 0, 2.8, 0.1);
  await vertical('DEV', BLUE, 29, 3, -19.9, 1.7, 0, 2.2);
  await sign(textTexture(ctx, ['MERN', 'STACK'], AMBER, { width: 512, height: 512, size: 92 }), 40, 34, -44.4, 11, 11, 0, 1.9, 0.08);
  await vertical('BUILD', CYAN, -37, 9, -44.4, 3, 0, 2.5);

  // the canyon: one billboard per project, passed during the Projects section
  await sign(textTexture(ctx, ['AI INTERVIEW', 'PLATFORM'], CYAN, { width: 1024, height: 512, size: 96 }), -25.4, 3, -84, 13, 6.5, Math.PI / 2, 2.8, 0.08);
  await sign(textTexture(ctx, ['SPACE', 'SHOOTER'], AMBER, { width: 1024, height: 512, size: 116 }), -14.4, 1, -114, 13, 6.5, -Math.PI / 2, 2.5, 0.08);
  await sign(textTexture(ctx, ['TASK', 'MANAGEMENT'], VIOLET, { width: 1024, height: 512, size: 104 }), -25.9, -3, -138, 13, 6.5, Math.PI / 2, 2.7, 0.08);
  await vertical('FULL STACK', AMBER, -13.2, 6, -86, 2.05, -Math.PI / 2, 2.4);
  await vertical('CODE', VIOLET, -26.4, -6, -110, 2.55, Math.PI / 2, 2.6);
  await vertical('NEON', CYAN, -12.2, 8, -142, 2.55, -Math.PI / 2, 2.6);

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
