// Wendet die inhaltlichen Korrekturen aus inhalte.json auf die geklonten Seiten an.
//
//   node scripts/inhalte.mjs
//
// Jeder Eintrag: { punkt, seiten: [slugs] | "sie" | "du", alt, neu, optional? }
// "sie"/"du" = alle Seiten mit dieser Anrede (Feld "anrede" in seiten.json).
// Bricht ab, wenn ein Text weder als "alt" noch als "neu" gefunden wird. So fällt auf,
// wenn sich eine Vorlage geändert hat. Mehrfach ausführen ist unschädlich.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const seiten = JSON.parse(await readFile(path.join(ROOT, 'seiten.json'), 'utf8'));
const korrekturen = JSON.parse(await readFile(path.join(ROOT, 'inhalte.json'), 'utf8'));

const html = new Map();
for (const s of seiten) html.set(s.slug, await readFile(path.join(ROOT, s.slug, 'index.html'), 'utf8'));

let fehler = 0;
for (const k of korrekturen) {
  const ziel = Array.isArray(k.seiten) ? k.seiten : seiten.filter((s) => s.anrede === k.seiten).map((s) => s.slug);
  const ergebnis = [];
  for (const slug of ziel) {
    const alt = html.get(slug);
    if (alt === undefined) { console.error(`  ! unbekannte Seite ${slug}`); fehler++; continue; }
    const anzahl = alt.split(k.alt).length - 1;
    if (anzahl) {
      html.set(slug, alt.split(k.alt).join(k.neu));
      ergebnis.push(`${slug} (${anzahl}×)`);
    } else if (!alt.includes(k.neu) && !k.optional) {
      console.error(`  ! ${slug}: Text nicht gefunden — ${k.punkt}`);
      fehler++;
    }
  }
  console.log(`${ergebnis.length ? '✓' : '·'} ${k.punkt}${ergebnis.length ? `\n    ${ergebnis.join(', ')}` : ' (nichts zu tun)'}`);
}

for (const [slug, inhalt] of html) await writeFile(path.join(ROOT, slug, 'index.html'), inhalt);
if (fehler) {
  console.error(`\n${fehler} Korrektur(en) nicht anwendbar.`);
  process.exit(1);
}
