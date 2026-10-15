// Erzeugt index.html: Übersicht aller Musterseiten (noindex).
//   node scripts/uebersicht.mjs
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const seiten = JSON.parse(await readFile(path.join(ROOT, 'seiten.json'), 'utf8'));

const gruppe = (name) => seiten.filter((s) => s.gruppe === name)
  .map((s) => `      <li><a href="${s.slug}/">${s.titel}</a></li>`).join('\n');

const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Musterseiten – sofortsichtbar</title>
<link rel="icon" href="data:,">
<style>
  body { margin: 0; font: 16px/1.5 system-ui, sans-serif; background: #f6f6f8; color: #18171a; }
  main { max-width: 760px; margin: 0 auto; padding: 48px 16px; }
  h1 { font-size: 28px; margin: 0 0 4px; }
  p { margin: 0 0 32px; color: #666; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .08em; color: #888; margin: 32px 0 12px; }
  ul { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
  a { display: block; padding: 12px 16px; background: #fff; border: 1px solid #e4e4e8; border-radius: 8px; color: inherit; text-decoration: none; }
  a:hover { border-color: #a167e4; }
</style>
</head>
<body>
<main>
  <h1>Musterseiten</h1>
  <p>${seiten.length} Vorlagen, Desktop und Mobile. Formulare sind auf den Musterseiten nicht angebunden.</p>
  <h2>Privat</h2>
  <ul>
${gruppe('Privat')}
  </ul>
  <h2>Gewerbe</h2>
  <ul>
${gruppe('Gewerbe')}
  </ul>
</main>
</body>
</html>
`;
await writeFile(path.join(ROOT, 'index.html'), html);
console.log(`index.html mit ${seiten.length} Seiten geschrieben`);
