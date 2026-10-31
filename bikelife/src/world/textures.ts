// Textures procédurales du décor urbain (canvas → CanvasTexture).

import * as THREE from 'three';
import { rng } from '../core/math';

type Ctx = CanvasRenderingContext2D;

function mk(w: number, h: number, draw: (g: Ctx, w: number, h: number) => void, srgb = true, repeat = true): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function noise(g: Ctx, w: number, h: number, base: string, amp: number, n: number, seed: number, size = 2): void {
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const v = (r() - 0.5) * amp;
    g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    g.fillRect(r() * w, r() * h, size * (0.5 + r()), size * (0.5 + r()));
  }
}

export interface FacadeTex {
  map: THREE.Texture;
  emissive: THREE.Texture;
  /** taille d'une tuile en mètres (largeur, hauteur) */
  tileW: number;
  tileH: number;
}

export class WorldTextures {
  asphalt: THREE.Texture;
  road: THREE.Texture;
  roadMain: THREE.Texture;
  sidewalk: THREE.Texture;
  concrete: THREE.Texture;
  grass: THREE.Texture;
  dirt: THREE.Texture;
  roof: THREE.Texture;
  wood: THREE.Texture;
  metalSiding: THREE.Texture;
  parkingLines: THREE.Texture;
  lightPool: THREE.Texture;
  facades: Record<string, FacadeTex> = {};
  signAtlas: THREE.Texture;
  signCount = 1;
  containers: THREE.Texture[] = [];
  graffitiAtlas: THREE.Texture;
  graffitiCount = 1;

  constructor() {
    this.asphalt = mk(512, 512, (g, w, h) => {
      noise(g, w, h, '#3b3d40', 0.16, 26000, 11, 2);
      const r = rng(5);
      g.strokeStyle = 'rgba(20,20,20,0.35)';
      for (let i = 0; i < 6; i++) {
        g.lineWidth = 1 + r() * 2;
        g.beginPath();
        let x = r() * w, y = r() * h;
        g.moveTo(x, y);
        for (let k = 0; k < 8; k++) {
          x += (r() - 0.5) * 60;
          y += (r() - 0.5) * 60;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    });
    const roadDraw = (main: boolean) => (g: Ctx, w: number, h: number) => {
      noise(g, w, h, '#393b3e', 0.14, 14000, main ? 3 : 4, 2);
      // bords blancs continus
      g.fillStyle = '#e8e8e2';
      const edge = main ? 0.13 : 0.24;
      g.fillRect(w * edge - 3, 0, 5, h);
      g.fillRect(w * (1 - edge) - 2, 0, 5, h);
      if (main) {
        // terre-plein central + lignes de voies
        g.fillStyle = '#d9b33a';
        g.fillRect(w / 2 - 7, 0, 4, h);
        g.fillRect(w / 2 + 3, 0, 4, h);
        g.fillStyle = '#e8e8e2';
        for (const x of [0.315, 0.685]) for (let y = 0; y < h; y += 64) g.fillRect(w * x - 2, y, 4, 34);
      } else {
        g.fillStyle = '#e8e8e2';
        for (let y = 0; y < h; y += 64) g.fillRect(w / 2 - 2, y, 4, 36);
      }
      // traces de pneus
      g.fillStyle = 'rgba(15,15,15,0.18)';
      for (const x of main ? [0.2, 0.26, 0.4, 0.45, 0.55, 0.6, 0.74, 0.8] : [0.33, 0.4, 0.6, 0.67]) g.fillRect(w * x, 0, 10, h);
    };
    this.road = mk(256, 256, roadDraw(false));
    this.roadMain = mk(256, 256, roadDraw(true));
    this.sidewalk = mk(256, 256, (g, w, h) => {
      noise(g, w, h, '#a9a69e', 0.1, 6000, 21, 2);
      g.strokeStyle = 'rgba(60,60,60,0.45)';
      g.lineWidth = 2;
      for (let i = 0; i <= 4; i++) {
        g.beginPath();
        g.moveTo(0, (i * h) / 4);
        g.lineTo(w, (i * h) / 4);
        g.stroke();
        g.beginPath();
        g.moveTo((i * w) / 4, 0);
        g.lineTo((i * w) / 4, h);
        g.stroke();
      }
    });
    this.concrete = mk(256, 256, (g, w, h) => {
      noise(g, w, h, '#8f8e8a', 0.12, 9000, 31, 3);
      g.strokeStyle = 'rgba(40,40,40,0.35)';
      g.lineWidth = 2;
      g.strokeRect(0, 0, w, h);
    });
    this.grass = mk(256, 256, (g, w, h) => {
      noise(g, w, h, '#4a7a33', 0.22, 30000, 41, 2);
      const r = rng(9);
      for (let i = 0; i < 400; i++) {
        g.fillStyle = r() > 0.5 ? 'rgba(120,160,60,0.35)' : 'rgba(30,60,20,0.35)';
        g.fillRect(r() * w, r() * h, 1, 4 + r() * 6);
      }
    });
    this.dirt = mk(256, 256, (g, w, h) => {
      noise(g, w, h, '#8a6440', 0.22, 24000, 51, 3);
      const r = rng(19);
      for (let i = 0; i < 120; i++) {
        g.fillStyle = `rgba(${60 + r() * 40},${45 + r() * 30},${30 + r() * 20},0.6)`;
        g.beginPath();
        g.arc(r() * w, r() * h, 1 + r() * 3, 0, Math.PI * 2);
        g.fill();
      }
    });
    this.roof = mk(256, 256, (g, w, h) => {
      noise(g, w, h, '#5d5f62', 0.14, 9000, 61, 3);
    });
    this.wood = mk(256, 256, (g, w, h) => {
      g.fillStyle = '#9a7445';
      g.fillRect(0, 0, w, h);
      const r = rng(71);
      for (let y = 0; y < h; y += 32) {
        g.fillStyle = `rgba(0,0,0,${0.1 + r() * 0.15})`;
        g.fillRect(0, y, w, 3);
        for (let i = 0; i < 40; i++) {
          g.fillStyle = `rgba(60,35,15,${0.1 + r() * 0.2})`;
          g.fillRect(r() * w, y + r() * 30, 20 + r() * 60, 1);
        }
      }
    });
    this.metalSiding = mk(256, 256, (g, w, h) => {
      g.fillStyle = '#9aa3a8';
      g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 16) {
        const grd = g.createLinearGradient(x, 0, x + 16, 0);
        grd.addColorStop(0, '#7f888d');
        grd.addColorStop(0.5, '#c2c9cd');
        grd.addColorStop(1, '#7f888d');
        g.fillStyle = grd;
        g.fillRect(x, 0, 16, h);
      }
      noise(g, 0, 0, '#000', 0, 0, 1);
    });
    this.parkingLines = mk(256, 256, (g, w, h) => {
      noise(g, w, h, '#3a3c3f', 0.12, 9000, 81, 2);
      g.fillStyle = '#e6e6e0';
      for (let x = 0; x <= w; x += w / 4) g.fillRect(x - 2, 0, 4, h * 0.42);
      for (let x = 0; x <= w; x += w / 4) g.fillRect(x - 2, h * 0.58, 4, h * 0.42);
    });
    this.lightPool = mk(128, 128, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      grd.addColorStop(0, 'rgba(255,214,150,0.95)');
      grd.addColorStop(0.4, 'rgba(255,190,120,0.45)');
      grd.addColorStop(1, 'rgba(255,170,90,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
    }, true, false);

    this.facades.glass = this.facade('glass', 3, 3.6, (g, cx, cy, cw, ch, r) => {
      const grd = g.createLinearGradient(cx, cy, cx + cw, cy + ch);
      const b = 40 + r() * 30;
      grd.addColorStop(0, `rgb(${b},${b + 40},${b + 70})`);
      grd.addColorStop(1, `rgb(${b + 30},${b + 70},${b + 100})`);
      g.fillStyle = grd;
      g.fillRect(cx + 1, cy + 1, cw - 2, ch - 3);
    }, '#2b3440');
    this.facades.office = this.facade('office', 3.2, 3.6, (g, cx, cy, cw, ch, r) => {
      g.fillStyle = `rgb(${30 + r() * 25},${40 + r() * 25},${55 + r() * 25})`;
      g.fillRect(cx + cw * 0.12, cy + ch * 0.2, cw * 0.76, ch * 0.62);
    }, '#b8b4aa');
    this.facades.brick = this.facade('brick', 3, 3.2, (g, cx, cy, cw, ch, r) => {
      g.fillStyle = '#e8e0d0';
      g.fillRect(cx + cw * 0.2, cy + ch * 0.15, cw * 0.6, ch * 0.66);
      g.fillStyle = `rgb(${25 + r() * 25},${30 + r() * 25},${40 + r() * 25})`;
      g.fillRect(cx + cw * 0.25, cy + ch * 0.2, cw * 0.5, ch * 0.58);
    }, '#8c4a33', true);
    this.facades.apartment = this.facade('apartment', 3.4, 2.9, (g, cx, cy, cw, ch, r) => {
      g.fillStyle = `rgb(${30 + r() * 20},${36 + r() * 20},${44 + r() * 20})`;
      g.fillRect(cx + cw * 0.15, cy + ch * 0.22, cw * 0.7, ch * 0.5);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(cx + cw * 0.08, cy + ch * 0.74, cw * 0.84, ch * 0.08);
      if (r() > 0.6) {
        g.fillStyle = ['#c0392b', '#2e86c1', '#f1c40f', '#27ae60'][Math.floor(r() * 4)];
        g.fillRect(cx + cw * 0.18, cy + ch * 0.25, cw * 0.18, ch * 0.45);
      }
    }, '#d8d2c4');
    this.facades.house = this.facade('house', 3.5, 3, (g, cx, cy, cw, ch, r) => {
      g.fillStyle = '#f2f0ea';
      g.fillRect(cx + cw * 0.25, cy + ch * 0.2, cw * 0.5, ch * 0.55);
      g.fillStyle = `rgb(${40 + r() * 20},${50 + r() * 20},${60 + r() * 20})`;
      g.fillRect(cx + cw * 0.3, cy + ch * 0.25, cw * 0.4, ch * 0.45);
    }, '#e3d3b4');
    this.facades.shop = this.facade('shop', 4, 3.4, (g, cx, cy, cw, ch, r) => {
      g.fillStyle = `rgb(${30 + r() * 25},${35 + r() * 25},${45 + r() * 25})`;
      g.fillRect(cx + cw * 0.12, cy + ch * 0.2, cw * 0.76, ch * 0.6);
    }, '#cfc6b8');
    this.facades.industrial = this.facade('industrial', 6, 5, (g, cx, cy, cw, ch, r) => {
      if (r() > 0.55) {
        g.fillStyle = 'rgba(40,50,60,0.9)';
        g.fillRect(cx + cw * 0.1, cy + ch * 0.1, cw * 0.8, ch * 0.18);
      }
    }, '#a7aeb2', false, true);

    const shopNames = ['KEBAB DU COIN', 'MOTO PIÈCES', 'PIZZA ROMA', 'BARBER SHOP', 'TACOS 2000', 'PHARMACIE', 'BOULANGERIE', 'SNEAKERS', 'TÉLÉPHONIE', 'GARAGE 2 ROUES', 'CAFÉ DU MARCHÉ', 'BURGER LAB', 'SUPÉRETTE', 'LAVERIE', 'OPTIQUE', 'SPORT 2000+'];
    const signColors = ['#c0392b', '#1f6fb2', '#16a085', '#f39c12', '#8e44ad', '#2c3e50', '#d35400', '#27ae60'];
    this.signCount = shopNames.length;
    this.signAtlas = mk(512, 96 * shopNames.length, (g, w) => {
      shopNames.forEach((name, i) => {
        const y = i * 96;
        g.fillStyle = signColors[i % signColors.length];
        g.fillRect(0, y, w, 96);
        g.fillStyle = 'rgba(255,255,255,0.15)';
        g.fillRect(0, y, w, 10);
        g.fillStyle = '#fff';
        g.font = '900 54px "Arial Black", Impact, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(name, w / 2, y + 51, w - 30);
      });
    }, true, false);
    ['#c0392b', '#1f6fb2', '#27ae60', '#e67e22', '#7f8c8d', '#8e44ad'].forEach((col, i) => {
      this.containers.push(mk(256, 128, (g, w, h) => {
        g.fillStyle = col;
        g.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 10) {
          g.fillStyle = 'rgba(0,0,0,0.18)';
          g.fillRect(x, 0, 4, h);
        }
        g.fillStyle = 'rgba(255,255,255,0.8)';
        g.font = 'bold 22px sans-serif';
        g.fillText(['MAERX', 'CMA-GGM', 'HAPAG', 'EVERGRN', 'MSC', 'COSCO'][i] + ' ' + (100000 + i * 7331), 12, 30);
      }));
    });
    const tags = ['BIKE LIFE', 'WHEELIE', '93', 'BRAAAP', 'RIDE OR DIE', 'KINGZ'];
    this.graffitiCount = tags.length;
    this.graffitiAtlas = mk(512, 256 * tags.length, (g0) => {
      tags.forEach((tag, i) => {
        const g = g0;
        const w = 512, h = 256;
        g.save();
        g.translate(0, i * 256);
        const r = rng(100 + i);
        const cols = ['#ff2bd6', '#39ff6a', '#22b8ff', '#ffd400', '#ff6a00'];
        g.font = `italic 900 ${90 - tag.length * 2}px Impact, "Arial Black", sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineWidth = 14;
        g.strokeStyle = '#111';
        g.save();
        g.translate(w / 2, h / 2);
        g.rotate((r() - 0.5) * 0.3);
        g.strokeText(tag, 0, 0);
        const grd = g.createLinearGradient(-200, 0, 200, 0);
        grd.addColorStop(0, cols[i % 5]);
        grd.addColorStop(1, cols[(i + 2) % 5]);
        g.fillStyle = grd;
        g.fillText(tag, 0, 0);
        g.restore();
        g.restore();
      });
    }, true, false);
  }

  /** Façade : tuile de 4 x 4 cellules (fenêtres) + carte émissive aléatoire (nuit). */
  private facade(key: string, cellW: number, cellH: number, drawWin: (g: Ctx, x: number, y: number, w: number, h: number, r: () => number) => void, wall: string, bricks = false, siding = false): FacadeTex {
    const cols = 4, rows = 4;
    const W = 256, H = 256;
    const cw = W / cols, ch = H / rows;
    const r = rng(key.length * 977);
    const lit: boolean[] = [];
    const map = mk(W, H, (g) => {
      g.fillStyle = wall;
      g.fillRect(0, 0, W, H);
      if (bricks) {
        for (let y = 0; y < H; y += 6) {
          for (let x = (y / 6) % 2 ? 0 : 6; x < W; x += 12) {
            g.fillStyle = `rgba(${90 + r() * 40},${40 + r() * 20},${30},0.35)`;
            g.fillRect(x, y, 11, 5);
          }
        }
      }
      if (siding) {
        for (let x = 0; x < W; x += 8) {
          g.fillStyle = 'rgba(0,0,0,0.12)';
          g.fillRect(x, 0, 3, H);
        }
      }
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          drawWin(g, i * cw, j * ch, cw, ch, r);
          lit.push(r() > 0.55);
        }
      }
      g.fillStyle = 'rgba(0,0,0,0.12)';
      for (let j = 0; j < rows; j++) g.fillRect(0, j * ch + ch - 3, W, 3);
    });
    const emissive = mk(W, H, (g) => {
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
      let k = 0;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          if (lit[k++] && !siding) {
            const warm = r() > 0.3;
            g.fillStyle = warm ? `rgb(255,${190 + r() * 40},${110 + r() * 40})` : `rgb(${170 + r() * 40},${200 + r() * 30},255)`;
            g.fillRect(i * cw + cw * 0.18, j * ch + ch * 0.24, cw * 0.64, ch * 0.5);
          }
        }
      }
    });
    return { map, emissive, tileW: cellW * cols, tileH: cellH * rows };
  }
}
