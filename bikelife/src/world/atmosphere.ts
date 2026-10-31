// Ciel physique, soleil/lune, cycle jour-nuit, météo (nuages, pluie, brouillard)
// et carte d'environnement (reflets) régénérée périodiquement.

import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { clamp, lerp, smoothstep } from '../core/math';

export type Weather = 'clear' | 'cloudy' | 'rain' | 'fog';

export const WEATHER_LABEL: Record<Weather, string> = { clear: 'Dégagé', cloudy: 'Nuageux', rain: 'Pluie', fog: 'Brouillard' };

const RAIN_COUNT = 1800;

export class Atmosphere {
  sky: Sky;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  stars: THREE.Points;
  rain: THREE.LineSegments;
  private rainMat: THREE.ShaderMaterial;
  private envSky: Sky;
  private envScene = new THREE.Scene();
  private pmrem: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private envTimer = 0;
  private lastEnvKey = '';
  time = 17.2; // heures
  timeSpeed = 1; // heures de jeu par minute réelle
  weather: Weather = 'clear';
  night = 0;
  wetness = 0;
  fogDensity = 0;
  viewDist = 600;
  sunDir = new THREE.Vector3();
  private cloud = 0.2;
  private fogColor = new THREE.Color();
  envEnabled = true;

  constructor(private scene: THREE.Scene, private renderer: THREE.WebGLRenderer, shadowSize: number) {
    this.sky = new Sky();
    this.sky.frustumCulled = false;
    scene.add(this.sky);
    this.envSky = new Sky();
    this.envSky.scale.setScalar(50);
    this.envScene.add(this.envSky);
    this.pmrem = new THREE.PMREMGenerator(renderer);

    this.sun = new THREE.DirectionalLight('#ffffff', 3);
    this.sun.castShadow = shadowSize > 0;
    if (shadowSize > 0) {
      this.sun.shadow.mapSize.set(shadowSize, shadowSize);
      const c = this.sun.shadow.camera;
      c.left = -38;
      c.right = 38;
      c.top = 38;
      c.bottom = -38;
      c.near = 1;
      c.far = 260;
      this.sun.shadow.bias = -0.0004;
      this.sun.shadow.normalBias = 0.04;
    }
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight('#bcd6f2', '#4a4636', 0.9);
    scene.add(this.hemi);

    // étoiles
    const sp: number[] = [];
    for (let i = 0; i < 1600; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      if (u < -0.05) continue;
      sp.push(Math.cos(a) * r, Math.abs(u), Math.sin(a) * r);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    // pluie (segments animés dans le shader)
    const rp = new Float32Array(RAIN_COUNT * 6);
    const rs = new Float32Array(RAIN_COUNT * 2);
    for (let i = 0; i < RAIN_COUNT; i++) {
      const x = (Math.random() - 0.5) * 70, y = Math.random() * 30, z = (Math.random() - 0.5) * 70;
      rp.set([x, y, z, x, y, z], i * 6);
      rs[i * 2] = 0;
      rs[i * 2 + 1] = 1;
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    rg.setAttribute('tail', new THREE.BufferAttribute(rs, 1));
    this.rainMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uOpacity: { value: 0 }, uWind: { value: new THREE.Vector2(1.5, 0.5) } },
      vertexShader: `
        attribute float tail; uniform float uTime; uniform vec3 uCam; uniform vec2 uWind;
        varying float vA;
        void main(){
          vec3 p = position;
          float fall = 22.0;
          p.y = mod(p.y - uTime * fall, 30.0) - 12.0;
          p.x = mod(p.x - uCam.x + 35.0 + uTime * uWind.x, 70.0) - 35.0 + uCam.x;
          p.z = mod(p.z - uCam.z + 35.0 + uTime * uWind.y, 70.0) - 35.0 + uCam.z;
          p.y += uCam.y;
          p += vec3(uWind.x, fall, uWind.y) * 0.035 * tail;
          vA = 1.0 - tail * 0.7;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `uniform float uOpacity; varying float vA; void main(){ gl_FragColor = vec4(0.75,0.8,0.88, uOpacity * vA); }`,
      transparent: true,
      depthWrite: false,
    });
    this.rain = new THREE.LineSegments(rg, this.rainMat);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);
    scene.fog = new THREE.FogExp2('#bcd3e6', 0.0015);
  }

  setWeather(w: Weather): void {
    this.weather = w;
    this.envTimer = 0;
  }

  update(dt: number, cam: THREE.PerspectiveCamera, focus: THREE.Vector3): void {
    this.time = (this.time + (dt / 60) * this.timeSpeed) % 24;
    const t = this.time;
    // élévation du soleil : lever ~6h, coucher ~20h
    const dayFrac = (t - 6) / 14;
    const elev = Math.sin(dayFrac * Math.PI) * 62 * (Math.PI / 180) - (dayFrac < 0 || dayFrac > 1 ? 0.3 : 0);
    const az = (dayFrac - 0.5) * Math.PI * 0.9 + Math.PI * 0.15;
    this.sunDir.set(Math.cos(elev) * Math.sin(az), Math.sin(elev), Math.cos(elev) * Math.cos(az)).normalize();
    const sunUp = smoothstep(-0.06, 0.12, this.sunDir.y);
    this.night = 1 - smoothstep(-0.12, 0.06, this.sunDir.y);

    const wTarget = this.weather === 'rain' ? 1 : this.weather === 'cloudy' ? 0.15 : 0;
    this.wetness += (wTarget - this.wetness) * Math.min(1, dt * (wTarget > this.wetness ? 0.08 : 0.02));
    const cloudT = { clear: 0.18, cloudy: 0.72, rain: 0.95, fog: 0.6 }[this.weather];
    this.cloud += (cloudT - this.cloud) * Math.min(1, dt * 0.2);

    const u = this.sky.material.uniforms;
    u.sunPosition.value.copy(this.sunDir);
    u.turbidity.value = lerp(2.2, 9, this.cloud);
    u.rayleigh.value = lerp(1.2, 0.6, this.cloud) * (0.4 + 0.6 * sunUp) + 0.2;
    u.mieCoefficient.value = 0.004 + this.cloud * 0.01;
    u.mieDirectionalG.value = 0.82;
    u.cloudCoverage.value = this.cloud;
    u.cloudDensity.value = 0.35 + this.cloud * 0.5;
    u.time.value += dt;
    this.sky.position.copy(cam.position);
    this.sky.scale.setScalar(cam.far * 1.0);
    this.stars.position.copy(cam.position);
    this.stars.scale.setScalar(cam.far * 0.85);
    (this.stars.material as THREE.PointsMaterial).opacity = this.night * (1 - this.cloud * 0.9);

    // lumières
    const sunCol = new THREE.Color().setHSL(0.08 + 0.05 * sunUp, 0.8 - 0.5 * sunUp, 0.6 + 0.3 * sunUp);
    const moon = new THREE.Color('#7f95c9');
    const dirToLight = this.sunDir.y > -0.05 ? this.sunDir.clone() : new THREE.Vector3(-0.3, 0.8, -0.4).normalize();
    this.sun.color.copy(this.sunDir.y > -0.05 ? sunCol : moon);
    this.sun.intensity = this.sunDir.y > -0.05 ? (0.4 + 2.8 * sunUp) * (1 - this.cloud * 0.55) : 0.35;
    this.sun.position.copy(focus).addScaledVector(dirToLight, 120);
    this.sun.target.position.copy(focus);
    this.hemi.intensity = lerp(0.28, 1.0, sunUp) * (1 - this.cloud * 0.2) + (this.weather === 'fog' ? 0.15 : 0);
    this.hemi.color.set(this.night > 0.5 ? '#3b4a72' : '#bcd6f2');
    this.hemi.groundColor.set(this.night > 0.5 ? '#2a2620' : '#5a5040');

    // brouillard
    const day = new THREE.Color('#b7cce0'), dusk = new THREE.Color('#d9a07a'), nightC = new THREE.Color('#0d1424'), grey = new THREE.Color('#8b939b');
    const duskAmt = clamp(1 - Math.abs(this.sunDir.y - 0.05) / 0.18, 0, 1);
    this.fogColor.copy(day).lerp(dusk, duskAmt * 0.7).lerp(nightC, this.night).lerp(grey, this.cloud * 0.6 * (1 - this.night));
    const baseDensity = 1.9 / this.viewDist;
    this.fogDensity = baseDensity * (this.weather === 'fog' ? 3.2 : this.weather === 'rain' ? 1.7 : 1) * (1 + this.night * 0.3);
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.copy(this.fogColor);
    fog.density = this.fogDensity;

    // pluie
    this.rain.visible = this.weather === 'rain';
    this.rainMat.uniforms.uTime.value += dt;
    this.rainMat.uniforms.uCam.value.copy(cam.position);
    this.rainMat.uniforms.uOpacity.value = 0.45;

    // carte d'environnement
    this.envTimer -= dt;
    const key = `${Math.round(this.time * 4)}:${this.weather}`;
    if (this.envEnabled && (this.envTimer <= 0 || (key !== this.lastEnvKey && this.envTimer < 20))) {
      this.updateEnv();
      this.lastEnvKey = key;
      this.envTimer = 30;
    }
  }

  private updateEnv(): void {
    const src = this.sky.material.uniforms, dst = this.envSky.material.uniforms;
    for (const k of Object.keys(src)) {
      const v = src[k].value;
      if (v && v.isVector3) dst[k].value.copy(v);
      else dst[k].value = v;
    }
    const rt = this.pmrem.fromScene(this.envScene, 0.02, 0.1, 200);
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = lerp(0.25, 1, 1 - this.night) * (1 - this.cloud * 0.3);
  }

  dispose(): void {
    this.envRT?.dispose();
    this.pmrem.dispose();
  }
}
