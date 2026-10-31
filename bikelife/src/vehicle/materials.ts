// Matériaux PBR partagés + textures procédurales (déco de plastiques, plaques,
// carbone, motifs de tenues). Tout est généré en canvas : aucune ressource externe.

import * as THREE from 'three';

const cache = new Map<string, THREE.Material>();
const texCache = new Map<string, THREE.Texture>();

function cached<T extends THREE.Material>(key: string, make: () => T): T {
  let m = cache.get(key) as T | undefined;
  if (!m) {
    m = make();
    cache.set(key, m);
  }
  return m;
}

export const Mats = {
  paint(color: string, rough = 0.32): THREE.MeshPhysicalMaterial {
    return cached(`paint:${color}:${rough}`, () => new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 0.0, clearcoat: 0.8, clearcoatRoughness: 0.15 }));
  },
  plastic(color: string, rough = 0.42): THREE.MeshStandardMaterial {
    return cached(`plastic:${color}:${rough}`, () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.0 }));
  },
  metal(color: string, rough = 0.32, metalness = 1): THREE.MeshStandardMaterial {
    return cached(`metal:${color}:${rough}:${metalness}`, () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness }));
  },
  chrome(): THREE.MeshStandardMaterial {
    return Mats.metal('#f2f4f6', 0.08, 1);
  },
  rubber(): THREE.MeshStandardMaterial {
    return cached('rubber', () => new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.92, metalness: 0 }));
  },
  dark(): THREE.MeshStandardMaterial {
    return cached('dark', () => new THREE.MeshStandardMaterial({ color: '#1c1d20', roughness: 0.55, metalness: 0.3 }));
  },
  engine(color = '#2a2c30'): THREE.MeshStandardMaterial {
    return Mats.metal(color, 0.45, 0.75);
  },
  glass(tint = '#0b0f14', opacity = 0.75): THREE.MeshPhysicalMaterial {
    return cached(`glass:${tint}:${opacity}`, () => new THREE.MeshPhysicalMaterial({ color: tint, roughness: 0.05, metalness: 0.1, transparent: true, opacity, clearcoat: 1 }));
  },
  emissive(color: string, intensity = 2): THREE.MeshStandardMaterial {
    return cached(`emis:${color}:${intensity}`, () => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.3 }));
  },
  carbon(): THREE.MeshPhysicalMaterial {
    return cached('carbon', () => {
      const t = carbonTexture();
      return new THREE.MeshPhysicalMaterial({ map: t, color: '#ffffff', roughness: 0.35, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 });
    });
  },
  titanium(): THREE.MeshStandardMaterial {
    return cached('titanium', () => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 16;
      const g = c.getContext('2d')!;
      const grd = g.createLinearGradient(0, 0, 256, 0);
      grd.addColorStop(0, '#c9c3b8');
      grd.addColorStop(0.35, '#d8b26a');
      grd.addColorStop(0.55, '#6b4fa3');
      grd.addColorStop(0.75, '#2f6fb8');
      grd.addColorStop(1, '#b9bec6');
      g.fillStyle = grd;
      g.fillRect(0, 0, 256, 16);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.25, metalness: 1 });
    });
  },
  textured(key: string, tex: THREE.Texture, opts: THREE.MeshPhysicalMaterialParameters = {}): THREE.MeshPhysicalMaterial {
    return cached(`tex:${key}`, () => new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.2, ...opts }));
  },
};

export function clearMaterialCache(): void {
  for (const m of cache.values()) m.dispose();
  cache.clear();
  for (const t of texCache.values()) t.dispose();
  texCache.clear();
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function finish(c: HTMLCanvasElement, key: string, anis = 4): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anis;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  texCache.set(key, t);
  return t;
}

function carbonTexture(): THREE.Texture {
  const [c, g] = canvas(64, 64);
  g.fillStyle = '#121214';
  g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const on = (x + y) % 2 === 0;
      const grd = on ? g.createLinearGradient(x * 8, 0, x * 8 + 8, 0) : g.createLinearGradient(0, y * 8, 0, y * 8 + 8);
      grd.addColorStop(0, '#1a1b1f');
      grd.addColorStop(0.5, '#3a3c42');
      grd.addColorStop(1, '#1a1b1f');
      g.fillStyle = grd;
      g.fillRect(x * 8 + 0.5, y * 8 + 0.5, 7, 7);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 6);
  return t;
}

/** Texture de déco pour écopes / flancs (512x256). */
export function decalTexture(style: string, primary: string, secondary: string, accent: string, brand: string, number: string): THREE.Texture {
  const key = `decal:${style}:${primary}:${secondary}:${accent}:${brand}:${number}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const W = 512, H = 256;
  const [c, g] = canvas(W, H);
  g.fillStyle = primary;
  g.fillRect(0, 0, W, H);
  const rnd = mulberry(hash(key));
  switch (style) {
    case 'stripes': {
      g.fillStyle = secondary;
      g.save();
      g.translate(W / 2, H / 2);
      g.rotate(-0.35);
      g.fillRect(-W, -40, W * 2, 34);
      g.fillStyle = accent;
      g.fillRect(-W, 2, W * 2, 14);
      g.fillStyle = secondary;
      g.fillRect(-W, 26, W * 2, 8);
      g.restore();
      break;
    }
    case 'split': {
      g.fillStyle = secondary;
      g.beginPath();
      g.moveTo(0, H * 0.55);
      g.lineTo(W, H * 0.3);
      g.lineTo(W, H);
      g.lineTo(0, H);
      g.fill();
      g.strokeStyle = accent;
      g.lineWidth = 10;
      g.beginPath();
      g.moveTo(0, H * 0.55);
      g.lineTo(W, H * 0.3);
      g.stroke();
      break;
    }
    case 'camo': {
      const cols = [secondary, accent, shade(primary, -0.25), shade(primary, 0.2)];
      for (let i = 0; i < 70; i++) {
        g.fillStyle = cols[i % cols.length];
        g.beginPath();
        const x = rnd() * W, y = rnd() * H, r = 12 + rnd() * 34;
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2;
          const rr = r * (0.6 + rnd() * 0.6);
          k === 0 ? g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        g.fill();
      }
      break;
    }
    case 'flames': {
      for (let i = 0; i < 9; i++) {
        const y0 = H * (0.25 + rnd() * 0.6);
        const grd = g.createLinearGradient(0, 0, W, 0);
        grd.addColorStop(0, accent);
        grd.addColorStop(0.6, secondary);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(0, y0 - 18);
        g.bezierCurveTo(W * 0.3, y0 - 30, W * 0.45, y0 - 70 * rnd(), W * (0.55 + rnd() * 0.35), y0 - 40);
        g.bezierCurveTo(W * 0.45, y0, W * 0.3, y0 + 10, 0, y0 + 18);
        g.fill();
      }
      break;
    }
    case 'chevron': {
      g.lineWidth = 22;
      for (let i = -2; i < 8; i++) {
        g.strokeStyle = i % 2 ? secondary : accent;
        g.beginPath();
        const x = i * 70;
        g.moveTo(x, 0);
        g.lineTo(x + 60, H / 2);
        g.lineTo(x, H);
        g.stroke();
      }
      break;
    }
    case 'digital': {
      const s = 16;
      for (let y = 0; y < H; y += s) {
        for (let x = 0; x < W; x += s) {
          const t = x / W + (rnd() - 0.5) * 0.5;
          if (t > 0.45) {
            g.fillStyle = rnd() > 0.5 ? secondary : accent;
            g.fillRect(x, y, s - 1, s - 1);
          }
        }
      }
      break;
    }
    case 'bikelife': {
      g.fillStyle = secondary;
      g.fillRect(0, H * 0.62, W, H * 0.38);
      g.font = 'italic 900 96px Impact, "Arial Black", sans-serif';
      g.fillStyle = accent;
      g.strokeStyle = '#0a0a0a';
      g.lineWidth = 8;
      g.save();
      g.translate(26, H * 0.56);
      g.rotate(-0.08);
      g.strokeText('BIKE LIFE', 0, 0);
      g.fillText('BIKE LIFE', 0, 0);
      g.restore();
      for (let i = 0; i < 30; i++) {
        g.fillStyle = accent;
        g.globalAlpha = 0.5;
        g.fillRect(rnd() * W, H * 0.62 + rnd() * H * 0.38, 3 + rnd() * 6, 3 + rnd() * 6);
      }
      g.globalAlpha = 1;
      break;
    }
    case 'none':
      break;
    default: {
      // "usine" : grande vague + logo marque fictive
      g.fillStyle = secondary;
      g.beginPath();
      g.moveTo(0, H * 0.72);
      g.bezierCurveTo(W * 0.3, H * 0.45, W * 0.6, H * 0.95, W, H * 0.55);
      g.lineTo(W, H);
      g.lineTo(0, H);
      g.fill();
      g.fillStyle = accent;
      g.beginPath();
      g.moveTo(0, H * 0.8);
      g.bezierCurveTo(W * 0.3, H * 0.55, W * 0.6, H * 1.02, W, H * 0.63);
      g.lineTo(W, H * 0.7);
      g.bezierCurveTo(W * 0.6, H * 1.1, W * 0.3, H * 0.62, 0, H * 0.88);
      g.fill();
    }
  }
  if (style !== 'none' && brand) {
    g.font = 'italic 800 64px "Arial Black", Impact, sans-serif';
    g.fillStyle = style === 'bikelife' ? secondary : contrast(primary);
    g.globalAlpha = 0.95;
    g.fillText(brand.toUpperCase(), 30, 92);
    g.globalAlpha = 1;
  }
  void number;
  return finish(c, key);
}

/** Plaque numéro (fond + numéro). */
export function plateTexture(number: string, bg: string, fg?: string): THREE.Texture {
  const key = `plate:${number}:${bg}:${fg}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const [c, g] = canvas(256, 256);
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 256);
  const col = fg ?? contrast(bg);
  g.fillStyle = col;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const n = number.slice(0, 3) || '0';
  g.font = `900 ${n.length > 2 ? 132 : 176}px "Arial Black", Impact, sans-serif`;
  g.fillText(n, 128, 138);
  g.strokeStyle = shade(bg, -0.3);
  g.lineWidth = 10;
  g.strokeRect(5, 5, 246, 246);
  return finish(c, key);
}

/** Plaque d'immatriculation fictive (moto de rue / scooter). */
export function licenseTexture(text: string): THREE.Texture {
  const key = `lic:${text}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const [c, g] = canvas(256, 128);
  g.fillStyle = '#f4f4f0';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#1d3fbf';
  g.fillRect(0, 0, 34, 128);
  g.fillStyle = '#111';
  g.font = '900 54px "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 145, 66);
  return finish(c, key);
}

export function seatTexture(color: string, style: string): THREE.Texture {
  const key = `seat:${color}:${style}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const [c, g] = canvas(256, 64);
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 64);
  if (style === 'gripper') {
    g.strokeStyle = shade(color, -0.35);
    g.lineWidth = 3;
    for (let x = 0; x < 256; x += 10) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + 6, 64);
      g.stroke();
    }
  } else if (style === 'stitched') {
    g.strokeStyle = shade(color, 0.45);
    g.setLineDash([5, 4]);
    g.lineWidth = 2;
    for (let y = 10; y < 64; y += 14) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(256, y);
      g.stroke();
    }
  }
  return finish(c, key);
}

/** Motif textile (maillot, pantalon, casque). */
export function patternTexture(pattern: string, c1: string, c2: string, number = ''): THREE.Texture {
  const key = `pat:${pattern}:${c1}:${c2}:${number}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const W = 256, H = 256;
  const [c, g] = canvas(W, H);
  g.fillStyle = c1;
  g.fillRect(0, 0, W, H);
  const rnd = mulberry(hash(key));
  switch (pattern) {
    case 'stripes':
      g.fillStyle = c2;
      g.fillRect(0, H * 0.42, W, H * 0.12);
      g.fillRect(0, H * 0.6, W, H * 0.05);
      break;
    case 'split':
      g.fillStyle = c2;
      g.fillRect(W / 2, 0, W / 2, H);
      break;
    case 'chevron':
      g.strokeStyle = c2;
      g.lineWidth = 18;
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.moveTo(0, 60 + i * 50);
        g.lineTo(W / 2, 20 + i * 50);
        g.lineTo(W, 60 + i * 50);
        g.stroke();
      }
      break;
    case 'camo':
      for (let i = 0; i < 60; i++) {
        g.fillStyle = i % 2 ? c2 : shade(c1, -0.3);
        g.beginPath();
        g.ellipse(rnd() * W, rnd() * H, 10 + rnd() * 24, 6 + rnd() * 16, rnd() * 3, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case 'number':
      g.fillStyle = c2;
      g.fillRect(0, 0, W, 26);
      g.font = '900 120px "Arial Black", Impact, sans-serif';
      g.textAlign = 'center';
      g.fillText(number || '77', W * 0.75, H * 0.65);
      break;
  }
  const t = finish(c, key, 2);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---------------- utilitaires couleur
export function shade(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return '#' + c.getHexString();
}

export function contrast(hex: string): string {
  const c = new THREE.Color(hex);
  const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  return lum > 0.55 ? '#111111' : '#f5f5f5';
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
