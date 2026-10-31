// Prépare une page autonome (sans <html>/<head>/<body>) à partir de dist/ pour une
// publication en page web hébergée : CSS intégré, script module et worklet en fichiers.
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const out = path.resolve('dist-artifact');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'assets'), { recursive: true });
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const js = html.match(/src="\.\/assets\/(index-[^"]+\.js)"/)[1];
const css = html.match(/href="\.\/assets\/(index-[^"]+\.css)"/)[1];
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
const cssText = fs.readFileSync(path.join(dist, 'assets', css), 'utf8');
for (const f of fs.readdirSync(path.join(dist, 'assets'))) if (f.endsWith('.js')) fs.copyFileSync(path.join(dist, 'assets', f), path.join(out, 'assets', f));
const page = `<title>Bike Life Street Kings</title>
<meta name="theme-color" content="#07080c" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@500;600;700&display=swap" rel="stylesheet" />
<style>:root{color-scheme:dark}${cssText}</style>
${body.trim()}
<script type="module" src="./assets/${js}"></script>
`;
fs.writeFileSync(path.join(out, 'index.html'), page);
console.log('dist-artifact/index.html', (page.length / 1024).toFixed(1) + ' KB', fs.readdirSync(path.join(out, 'assets')));
