// Client multijoueur : WebSocket vers server/server.mjs. Envoie l'état de la
// moto à 15 Hz, interpole les autres joueurs (BikeAvatar), chat et exploits.
// Fonctionne uniquement si un serveur est lancé (aucune simulation factice).

import * as THREE from 'three';
import { BIKE_BY_ID } from '../data/bikes';
import { BikeConfig, defaultConfig } from '../data/parts';
import type { RiderConfig } from '../data/apparel';
import { BikeAvatar, BikeSnapshot } from '../vehicle/bike';

export interface RemotePlayer {
  id: number;
  name: string;
  bike: string;
  avatar: BikeAvatar | null;
}

export type NetStatus = 'off' | 'connecting' | 'online' | 'error';

export class Multiplayer {
  ws: WebSocket | null = null;
  status: NetStatus = 'off';
  error = '';
  myId = 0;
  room = 'public';
  players = new Map<number, RemotePlayer>();
  onChat: ((name: string, text: string) => void) | null = null;
  onInfo: ((text: string) => void) | null = null;
  private sendTimer = 0;

  constructor(private scene: THREE.Scene) {}

  static defaultUrl(): string {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const port = location.port === '5173' || location.port === '4173' ? '8787' : location.port;
    return `${proto}://${location.hostname}${port ? ':' + port : ''}/ws`;
  }

  connect(url: string, room: string, me: { name: string; bike: string; cfg: BikeConfig; rider: RiderConfig }): void {
    this.disconnect();
    this.status = 'connecting';
    this.error = '';
    this.room = room || 'public';
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      this.status = 'error';
      this.error = 'Adresse invalide';
      return;
    }
    this.ws = ws;
    const timeout = window.setTimeout(() => {
      if (this.status === 'connecting') {
        this.status = 'error';
        this.error = 'Aucun serveur ne répond à cette adresse';
        ws.close();
      }
    }, 5000);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', room: this.room, ...me }));
    ws.onerror = () => {
      this.status = 'error';
      this.error = 'Connexion impossible (serveur lancé ? voir README)';
    };
    ws.onclose = () => {
      clearTimeout(timeout);
      if (this.status === 'online') this.onInfo?.('Déconnecté du serveur');
      if (this.status !== 'error') this.status = 'off';
      this.clearPlayers();
    };
    ws.onmessage = (ev) => {
      let m: any;
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      switch (m.t) {
        case 'welcome':
          clearTimeout(timeout);
          this.status = 'online';
          this.myId = m.id;
          for (const p of m.players) this.addPlayer(p);
          this.onInfo?.(`Connecté au salon « ${m.room} » (${m.players.length + 1} joueur(s))`);
          break;
        case 'joined':
          this.addPlayer(m.p);
          this.onInfo?.(`${m.p.name} a rejoint la session`);
          break;
        case 'left': {
          const p = this.players.get(m.id);
          if (p) {
            this.onInfo?.(`${p.name} a quitté la session`);
            p.avatar?.dispose(this.scene);
            this.players.delete(m.id);
          }
          break;
        }
        case 's': {
          const p = this.players.get(m.id);
          if (p?.avatar) p.avatar.push(unpack(m.s));
          break;
        }
        case 'bike': {
          const p = this.players.get(m.id);
          if (p) {
            p.avatar?.dispose(this.scene);
            p.bike = m.bike;
            p.avatar = this.makeAvatar(m.bike, m.cfg, m.rider, p.name);
          }
          break;
        }
        case 'chat':
          this.onChat?.(m.name, m.text);
          break;
        case 'feat':
          this.onInfo?.(`${m.name} : ${m.text}`);
          break;
        case 'error':
          this.status = 'error';
          this.error = m.msg;
          break;
      }
    };
  }

  private makeAvatar(bikeId: string, cfg: BikeConfig | null, rider: RiderConfig | null, name: string): BikeAvatar | null {
    const spec = BIKE_BY_ID[bikeId];
    if (!spec) return null;
    const c = { ...defaultConfig(spec), ...(cfg ?? {}) };
    try {
      const a = new BikeAvatar(spec, c, rider);
      a.setName(name);
      this.scene.add(a.rig.outer);
      return a;
    } catch (e) {
      console.warn('[mp] avatar', e);
      return null;
    }
  }

  private addPlayer(p: { id: number; name: string; bike: string; cfg: BikeConfig | null; rider: RiderConfig | null; s?: number[] | null }): void {
    if (this.players.has(p.id)) return;
    const rp: RemotePlayer = { id: p.id, name: p.name, bike: p.bike, avatar: this.makeAvatar(p.bike, p.cfg, p.rider, p.name) };
    if (p.s && rp.avatar) rp.avatar.push(unpack(p.s));
    this.players.set(p.id, rp);
  }

  private clearPlayers(): void {
    for (const p of this.players.values()) p.avatar?.dispose(this.scene);
    this.players.clear();
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    this.ws = null;
    this.status = 'off';
    this.clearPlayers();
  }

  update(dt: number, mine: BikeSnapshot | null): void {
    for (const p of this.players.values()) p.avatar?.update(dt);
    if (this.status !== 'online' || !this.ws || !mine) return;
    this.sendTimer -= dt;
    if (this.sendTimer <= 0) {
      this.sendTimer = 1 / 15;
      this.ws.send(JSON.stringify({ t: 's', s: pack(mine) }));
    }
  }

  sendBike(bike: string, cfg: BikeConfig, rider: RiderConfig): void {
    if (this.status === 'online') this.ws?.send(JSON.stringify({ t: 'bike', bike, cfg, rider }));
  }

  chat(text: string): void {
    if (this.status === 'online' && text.trim()) this.ws?.send(JSON.stringify({ t: 'chat', text }));
  }

  feat(text: string): void {
    if (this.status === 'online') this.ws?.send(JSON.stringify({ t: 'feat', text }));
  }
}

function pack(s: BikeSnapshot): number[] {
  const r = (v: number, k = 100) => Math.round(v * k) / k;
  return [r(s.x), r(s.y), r(s.z), r(s.yaw, 1000), r(s.pitch, 1000), r(s.roll, 1000), r(s.steer, 1000), r(s.cf, 1000), r(s.cr, 1000), r(s.rf, 100), r(s.rr, 100), Math.round(s.rpm), r(s.thr)];
}

function unpack(a: number[]): BikeSnapshot {
  return { x: a[0], y: a[1], z: a[2], yaw: a[3], pitch: a[4], roll: a[5], steer: a[6], cf: a[7], cr: a[8], rf: a[9], rr: a[10], rpm: a[11], thr: a[12] };
}
