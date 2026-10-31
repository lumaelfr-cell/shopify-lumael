// Point d'entrée : charge le style, crée le jeu et affiche la progression du chargement.
import './ui/style.css';
import { Game } from './game';

const loading = document.getElementById('loading')!;
const bar = loading.querySelector('.bar i') as HTMLElement;
const msg = loading.querySelector('.msg') as HTMLElement;

function fail(e: unknown): void {
  console.error(e);
  msg.textContent = 'Erreur de démarrage : ' + (e instanceof Error ? e.message : String(e)) + ' — votre navigateur prend-il en charge WebGL ?';
  msg.style.color = '#ff6b6b';
}

try {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const game = new Game(canvas);
  (window as any).__game = game;
  game
    .init((p, m) => {
      bar.style.width = `${Math.round(p * 100)}%`;
      msg.textContent = m;
    })
    .then(() => {
      loading.style.transition = 'opacity 0.5s';
      loading.style.opacity = '0';
      setTimeout(() => loading.remove(), 520);
      (window as any).__ready = true;
    })
    .catch(fail);
} catch (e) {
  fail(e);
}
