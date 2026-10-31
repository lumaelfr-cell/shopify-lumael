// Test d'intégration du serveur multijoueur (démarre server.mjs sur un port libre).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 18000 + Math.floor(Math.random() * 1000);
let proc: ChildProcess;

function client(): Promise<{ ws: WebSocket; msgs: any[]; next: (t: string) => Promise<any> }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    const msgs: any[] = [];
    const waiters: { t: string; r: (m: any) => void }[] = [];
    ws.on('message', (d) => {
      const m = JSON.parse(String(d));
      const i = waiters.findIndex((w) => w.t === m.t);
      if (i >= 0) waiters.splice(i, 1)[0].r(m);
      else msgs.push(m);
    });
    ws.on('open', () => resolve({
      ws, msgs,
      next: (t) => new Promise((r) => {
        const i = msgs.findIndex((m) => m.t === t);
        if (i >= 0) r(msgs.splice(i, 1)[0]);
        else waiters.push({ t, r });
      }),
    }));
    ws.on('error', reject);
  });
}

describe('serveur multijoueur', () => {
  beforeAll(async () => {
    proc = spawn(process.execPath, ['server/server.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'pipe' });
    await new Promise<void>((r) => proc.stdout!.on('data', (d) => String(d).includes('Bike Life') && r()));
  });
  afterAll(() => proc.kill());

  it('relaie arrivée, états, chat et départ', async () => {
    const a = await client();
    a.ws.send(JSON.stringify({ t: 'join', name: 'Alice', bike: 'aoz-az125', room: 'test' }));
    const wa = await a.next('welcome');
    expect(wa.players.length).toBe(0);
    const b = await client();
    b.ws.send(JSON.stringify({ t: 'join', name: 'Bob', bike: 'kro-690smr', room: 'test' }));
    const wb = await b.next('welcome');
    expect(wb.players.map((p: any) => p.name)).toEqual(['Alice']);
    const joined = await a.next('joined');
    expect(joined.p.name).toBe('Bob');
    const state = [1, 0.8, 2, 0.1, 0.2, 0, 0, 0.05, 0.05, 1, 1, 9000, 1];
    b.ws.send(JSON.stringify({ t: 's', s: state }));
    const st = await a.next('s');
    expect(st.s).toEqual(state);
    b.ws.send(JSON.stringify({ t: 's', s: [1, 2, 'x'] })); // invalide : ignoré
    a.ws.send(JSON.stringify({ t: 'chat', text: 'salut <b>' }));
    const chat = await b.next('chat');
    expect(chat.text).toBe('salut b');
    b.ws.close();
    const left = await a.next('left');
    expect(left.id).toBe(wb.id);
    a.ws.close();
  });
});
