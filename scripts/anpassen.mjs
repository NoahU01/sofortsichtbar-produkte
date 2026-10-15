// Passt die geklonten Seiten an — läuft nach klonen.mjs, mehrfach ausführen ist unschädlich.
//
//   node scripts/anpassen.mjs            alle Seiten
//   node scripts/anpassen.mjs <slug> ... nur diese Seiten
//
// 1. Tablet: Landingis Tablet-Layout (764–959 px) ist breiter als der Bildschirm. Stattdessen
//    gilt dort jetzt das Mobile-Layout: Breakpoint 763/764 px wird auf 959/960 px verschoben.
// 2. Farben: Landingi färbt über --color-primary-0…4. farben.json definiert die Paletten,
//    assets/css/farben.css schaltet sie über <html data-farbe="…"> um.
// 3. Farbwahl (nur Musterseiten): Knopf unten links, merkt die Wahl in ?farbe=…, damit man
//    einem Kunden direkt den Link mit seiner Farbe schicken kann.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const seiten = JSON.parse(await readFile(path.join(ROOT, 'seiten.json'), 'utf8'));
const farben = JSON.parse(await readFile(path.join(ROOT, 'farben.json'), 'utf8'));
const STANDARD = Object.keys(farben)[0];

function tabletAlsMobile(text) {
  return text
    .replace(/\(min-width:\s*764px\)\s*and\s*\(max-width:\s*959px\)/g, '(max-width: 0px)')
    .replace(/\(min-width:\s*764px\)/g, '(min-width: 960px)')
    .replace(/\(max-width:\s*763px\)/g, '(max-width: 959px)');
}

const farbenCss = `/* Erzeugt von scripts/anpassen.mjs aus farben.json — Farbe über <html data-farbe="…"> wählen. */
${Object.entries(farben).map(([key, f]) => `html[data-farbe="${key}"] { ${f.primary.map((v, i) => `--color-primary-${i}: ${v};`).join(' ')} }`).join('\n')}
`;

const farbwahlJs = `// Farbwahl für Musterseiten. Für Kundenseiten diese Datei samt <script>-Tag entfernen
// und die Farbe fest über <html data-farbe="…"> setzen.
(function () {
  var FARBEN = ${JSON.stringify(Object.fromEntries(Object.entries(farben).map(([k, f]) => [k, { name: f.name, rgb: f.primary[2] }])))};
  var html = document.documentElement;
  var param = new URLSearchParams(location.search).get('farbe');
  if (param && FARBEN[param]) html.setAttribute('data-farbe', param);

  var box = document.createElement('div');
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', 'Farbe wählen');
  box.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:2147483647;display:flex;gap:8px;padding:8px 10px;background:#fff;border-radius:999px;box-shadow:0 2px 12px rgba(0,0,0,.18);font:12px/1 sans-serif;align-items:center';
  Object.keys(FARBEN).forEach(function (key) {
    var b = document.createElement('button');
    b.type = 'button';
    b.title = FARBEN[key].name;
    b.setAttribute('aria-label', 'Farbe ' + FARBEN[key].name);
    b.style.cssText = 'width:24px;height:24px;border-radius:50%;cursor:pointer;padding:0;background:rgb(' + FARBEN[key].rgb + ')';
    function markieren() {
      var aktiv = html.getAttribute('data-farbe') === key;
      b.style.border = aktiv ? '3px solid #111' : '3px solid #fff';
      b.setAttribute('aria-pressed', aktiv);
    }
    b.addEventListener('click', function () {
      html.setAttribute('data-farbe', key);
      var url = new URL(location.href);
      url.searchParams.set('farbe', key);
      history.replaceState(null, '', url);
      box.querySelectorAll('button').forEach(function (x) { x._markieren(); });
    });
    b._markieren = markieren;
    markieren();
    box.appendChild(b);
  });
  document.body.appendChild(box);
})();
`;

const auswahl = process.argv.slice(2);
for (const seite of auswahl.length ? seiten.filter((s) => auswahl.includes(s.slug)) : seiten) {
  const ordner = path.join(ROOT, seite.slug);

  for (const datei of await readdir(path.join(ordner, 'assets/css'))) {
    if (!datei.endsWith('.css') || datei === 'farben.css' || datei === 'korrekturen.css') continue;
    const p = path.join(ordner, 'assets/css', datei);
    const alt = await readFile(p, 'utf8');
    const neu = tabletAlsMobile(alt);
    if (neu !== alt) await writeFile(p, neu);
  }
  await writeFile(path.join(ordner, 'assets/css/farben.css'), farbenCss);
  await writeFile(path.join(ordner, 'assets/js/farbwahl.js'), farbwahlJs);

  let html = tabletAlsMobile(await readFile(path.join(ordner, 'index.html'), 'utf8'));
  if (!/<html[^>]*data-farbe=/.test(html)) html = html.replace('<html lang="de"', `<html lang="de" data-farbe="${STANDARD}"`);
  // farben.css muss nach den Landingi-Styles stehen (gleiche Variablen in :root).
  html = html.replace(/<link rel="stylesheet" href="assets\/css\/farben\.css">/, '');
  html = html.replace(/(<link rel="stylesheet" href="assets\/css\/korrekturen\.css">)?<\/head>/, '<link rel="stylesheet" href="assets/css/farben.css">$&');
  if (!html.includes('assets/js/farbwahl.js')) html = html.replace('</body>', '<script src="assets/js/farbwahl.js"></script></body>');
  await writeFile(path.join(ordner, 'index.html'), html);
  console.log(`✓ ${seite.slug}`);
}
