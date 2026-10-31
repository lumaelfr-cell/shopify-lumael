// Serveur Bike Life : sert le jeu compilé (dist/) et relaie le multijoueur
// (WebSocket /ws). Lancement : `npm run start` (compile puis démarre) ou
// `npm run server` (si dist/ existe déjà). Port : variable PORT (8787 par défaut).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT || 8787);
const MAX_ROOM = 16;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, players: [...rooms.values()].reduce((n, r) => n + r.size, 0) }));
    return;
  }
  let file = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST)) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) {
    if (!fs.existsSync(path.join(DIST, 'index.html'))) {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Serveur multijoueur Bike Life actif. Compilez le jeu avec "npm run build" pour le servir ici.');
      return;
    }
    file = path.join(DIST, 'index.html');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
});

/** @type {Map<string, Map<number, any>>} */
const rooms = new Map();
let nextId = 1;
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 32 * 1024 });

const finiteArr = (a, n) => Array.isArray(a) && a.length === n && a.every((v) => typeof v === 'number' && Number.isFinite(v));
const clean = (s, max) => String(s ?? '').replace(/[<>]/g, '').slice(0, max);

function broadcast(room, msg, except) {
  const data = JSON.stringify(msg);
  for (const [id, p] of room) if (id !== except && p.ws.readyState === 1) p.ws.send(data);
}

wss.on('connection', (ws) => {
  let me = null;
  let room = null;
  let lastState = 0;
  ws.on('message', (raw) => {
    let m;
    try {
      m = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'join' && !me) {
      const roomName = clean(m.room || 'public', 24) || 'public';
      if (!rooms.has(roomName)) rooms.set(roomName, new Map());
      room = rooms.get(roomName);
      if (room.size >= MAX_ROOM) {
        ws.send(JSON.stringify({ t: 'error', msg: 'Salon complet' }));
        ws.close();
        return;
      }
      me = { id: nextId++, ws, name: clean(m.name, 16) || 'Rider', bike: clean(m.bike, 40), cfg: m.cfg && typeof m.cfg === 'object' ? m.cfg : null, rider: m.rider && typeof m.rider === 'object' ? m.rider : null, s: null };
      room.set(me.id, me);
      ws.send(JSON.stringify({ t: 'welcome', id: me.id, room: roomName, players: [...room.values()].filter((p) => p !== me).map((p) => ({ id: p.id, name: p.name, bike: p.bike, cfg: p.cfg, rider: p.rider, s: p.s })) }));
      broadcast(room, { t: 'joined', p: { id: me.id, name: me.name, bike: me.bike, cfg: me.cfg, rider: me.rider } }, me.id);
      return;
    }
    if (!me) return;
    if (m.t === 's' && finiteArr(m.s, 13)) {
      const now = Date.now();
      if (now - lastState < 40) return; // 25 Hz max
      lastState = now;
      me.s = m.s;
      broadcast(room, { t: 's', id: me.id, s: m.s }, me.id);
    } else if (m.t === 'bike') {
      me.bike = clean(m.bike, 40);
      me.cfg = m.cfg && typeof m.cfg === 'object' ? m.cfg : null;
      me.rider = m.rider && typeof m.rider === 'object' ? m.rider : null;
      broadcast(room, { t: 'bike', id: me.id, bike: me.bike, cfg: me.cfg, rider: me.rider }, me.id);
    } else if (m.t === 'chat') {
      const text = clean(m.text, 140);
      if (text) broadcast(room, { t: 'chat', id: me.id, name: me.name, text }, undefined);
    } else if (m.t === 'feat') {
      broadcast(room, { t: 'feat', id: me.id, name: me.name, text: clean(m.text, 80) }, me.id);
    }
  });
  ws.on('close', () => {
    if (me && room) {
      room.delete(me.id);
      broadcast(room, { t: 'left', id: me.id });
      if (!room.size) for (const [k, r] of rooms) if (r === room) rooms.delete(k);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Bike Life : http://localhost:${PORT}  (multijoueur : ws://<adresse>:${PORT}/ws)`);
});
