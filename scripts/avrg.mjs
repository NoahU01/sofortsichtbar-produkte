// Erzeugt die AVRG-Landingpages (SV Owen) in avrg/: eine Seite je Variante aus
// scripts/avrg/vorlage.html + scripts/avrg/varianten.json. Ausgabe wird committet (kein Build auf Vercel).
//   node scripts/avrg.mjs
import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ZIEL = path.join(ROOT, 'avrg');
const daten = JSON.parse(await readFile(path.join(ROOT, 'scripts/avrg/varianten.json'), 'utf8'));
const vorlage = await readFile(path.join(ROOT, 'scripts/avrg/vorlage.html'), 'utf8');

// CSS-Version aus dem Inhalt: Änderung an den Stylesheets → neue ?v=, kein Cache-Problem
const hash = createHash('sha1');
for (const f of ['avrg.css', 'avrg-v3.css']) hash.update(await readFile(path.join(ZIEL, 'assets/css', f)));
const version = hash.digest('hex').slice(0, 8);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const { gemeinsam } = daten;

// Alles außer assets/ neu schreiben – auch umbenannte oder entfernte Varianten verschwinden
for (const eintrag of await readdir(ZIEL)) {
  if (eintrag !== 'assets') await rm(path.join(ZIEL, eintrag), { recursive: true, force: true });
}

const slugs = new Set();
for (const v of daten.varianten) {
  if (slugs.has(v.slug)) throw new Error(`Slug doppelt: "${v.slug}"`);
  slugs.add(v.slug);

  const url = `https://${gemeinsam.domain}/${v.slug ? v.slug + '/' : ''}`;
  const robots = gemeinsam.indexieren
    ? `<link rel="canonical" href="${url}">`
    : '<meta name="robots" content="noindex, nofollow">';
  // Relative Pfade: gleiche Seite funktioniert unter /avrg/<slug>/ und unter avrg.sofortsichtbar.de/<slug>/
  const werte = { ...gemeinsam, ...v, version, basis: v.slug ? '../' : '', telefonLink: v.telefon.replace(/[^\d+]/g, '') };

  const html = vorlage.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (k === 'robots') return robots;
    if (werte[k] == null) throw new Error(`${v.slug || 'start'}: Wert „${k}“ fehlt`);
    return esc(werte[k]);
  });

  const ordner = v.slug ? path.join(ZIEL, v.slug) : ZIEL;
  await mkdir(ordner, { recursive: true });
  await writeFile(path.join(ordner, 'index.html'), html);
  console.log(`${url.padEnd(40)} ${v.name}`);
}
