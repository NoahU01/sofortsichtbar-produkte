// Behebt Text-Überlappungen aus den Landingi-Vorlagen (z. B. Überschrift ragt in den Absatz darunter).
//
//   node scripts/korrigieren.mjs            alle Seiten aus seiten.json
//   node scripts/korrigieren.mjs <slug> ... nur diese Seiten
//
// Landingi positioniert jedes Element absolut. Wo ein Text mehr Zeilen braucht als geplant,
// läuft er in das nächste Element. Das Skript misst die gerenderten Textzeilen im Browser,
// schiebt alles darunter nach unten, verlängert Karten und Sektion und schreibt das Ergebnis
// nach <slug>/assets/css/korrekturen.css (wird in index.html eingebunden).
//
// Einmalig: cd scripts && npm install

import http from 'node:http';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import handler from 'serve-handler';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(import.meta.dirname, '..');
const ABSTAND = 12; // px Luft zwischen zwei Texten nach der Korrektur
const LAYOUTS = [
  { name: 'Mobile', breite: 375, media: '@media only screen and (max-width: 959px)' },
  { name: 'Desktop', breite: 1440, media: '@media only screen and (min-width: 960px)' },
];

// Läuft im Browser: korrigiert iterativ und gibt die geänderten Werte in px zurück.
function korrigieren(abstand) {
  const px = (v) => parseFloat(v) || 0;
  const textRect = (el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const rs = [...r.getClientRects()].filter((x) => x.width > 1 && x.height > 1);
    if (!rs.length) return null;
    return {
      top: Math.min(...rs.map((x) => x.top)), bottom: Math.max(...rs.map((x) => x.bottom)),
      left: Math.min(...rs.map((x) => x.left)), right: Math.max(...rs.map((x) => x.right)),
    };
  };
  const istText = (el) => el.textContent.trim() !== '';
  const aenderungen = new Map(); // id -> {top?, height?}
  const merken = (el, feld, wert) => {
    if (!aenderungen.has(el.id)) aenderungen.set(el.id, {});
    aenderungen.get(el.id)[feld] = wert;
    el.style.setProperty(feld, `${wert}px`, 'important');
  };
  const meldungen = [];

  for (let runde = 0; runde < 50; runde++) {
    const widgets = [...document.querySelectorAll('.widget[id]')].filter((e) =>
      e.offsetParent && !e.closest('form') && !e.closest('.menu-section') &&
      getComputedStyle(e).position === 'absolute' && istText(e) && !e.querySelector('.widget[id]'));
    let fund = null;
    for (const a of widgets) {
      for (const b of widgets) {
        if (a === b || a.parentElement !== b.parentElement) continue;
        const ra = textRect(a), rb = textRect(b);
        if (!ra || !rb || ra.top > rb.top) continue; // a liegt oben
        const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const oy = ra.bottom - rb.top;
        if (ox > 2 && oy > 0 && (!fund || rb.top < fund.rb.top)) fund = { a, b, rb, oy };
      }
    }
    if (!fund) break;

    const { a, b, oy } = fund;
    const d = Math.ceil(oy + abstand);
    const linie = b.offsetTop;
    meldungen.push(`"${a.textContent.trim().slice(0, 40)}" ragte ${Math.round(oy)}px in "${b.textContent.trim().slice(0, 40)}"`);
    for (const s of b.parentElement.children) {
      if (!s.id || getComputedStyle(s).position !== 'absolute') continue;
      if (s.offsetTop >= linie - 0.5) merken(s, 'top', s.offsetTop + d);
      else if (!istText(s) && s.offsetTop + s.offsetHeight > linie) merken(s, 'height', s.offsetHeight + d);
    }
    const sektion = b.closest('.widget-section');
    merken(sektion, 'height', sektion.offsetHeight + d);
  }
  return { aenderungen: [...aenderungen.entries()], meldungen };
}

const rem = (v) => `${+(v / 16).toFixed(4)}rem`;

const server = http.createServer((req, res) => handler(req, res, { public: ROOT, trailingSlash: true }));
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const browser = await puppeteer.launch();

const seiten = JSON.parse(await readFile(path.join(ROOT, 'seiten.json'), 'utf8'));
const auswahl = process.argv.slice(2);
for (const seite of auswahl.length ? seiten.filter((s) => auswahl.includes(s.slug)) : seiten) {
  const datei = path.join(ROOT, seite.slug, 'index.html');
  let html = await readFile(datei, 'utf8');
  // Vorherige Korrektur entfernen, damit immer gegen das Original gemessen wird.
  html = html.replace(/<link rel="stylesheet" href="assets\/css\/korrekturen\.css">/, '');
  await writeFile(datei, html);
  await rm(path.join(ROOT, seite.slug, 'assets/css/korrekturen.css'), { force: true });

  let css = '';
  for (const layout of LAYOUTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: layout.breite, height: 900 });
    await page.goto(`http://localhost:${port}/${seite.slug}/`, { waitUntil: 'networkidle0' });
    const { aenderungen, meldungen } = await page.evaluate(korrigieren, ABSTAND);
    await page.close();
    for (const m of meldungen) console.log(`${seite.slug} [${layout.name}] ${m}`);
    if (!aenderungen.length) continue;
    css += `${layout.media} {\n`;
    for (const [id, w] of aenderungen) {
      const regeln = Object.entries(w).map(([k, v]) => `${k}: ${rem(v)} !important;`).join(' ');
      css += `  #${id} { ${regeln} }\n`;
    }
    css += '}\n';
  }

  if (css) {
    await writeFile(path.join(ROOT, seite.slug, 'assets/css/korrekturen.css'),
      `/* Erzeugt von scripts/korrigieren.mjs — behebt Text-Überlappungen aus der Landingi-Vorlage. */\n${css}`);
    html = html.replace('</head>', '<link rel="stylesheet" href="assets/css/korrekturen.css"></head>');
    await writeFile(datei, html);
  }
}

await browser.close();
server.close();
