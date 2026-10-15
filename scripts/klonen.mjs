// Klont Landingi-Seiten als statisches HTML in eigene, in sich geschlossene Ordner.
//
//   node scripts/klonen.mjs            alle Seiten aus seiten.json
//   node scripts/klonen.mjs <slug> ... nur diese Seiten
//
// Pro Seite entsteht <slug>/index.html + <slug>/assets/… — der Ordner läuft
// ohne Landingi und lässt sich 1:1 in ein eigenes Kunden-Repo kopieren.

import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

// Hosts, deren Dateien lokal abgelegt werden. Alles andere bleibt extern (z. B. Podbean-Player).
const LOKAL = [
  'images.assets-landingi.com', 'cdn.lugc.link', 'icons.assets-landingi.com',
  'styles.assets-landingi.com', 'fonts.assets-landingi.com', 'fonts.googleapis.com',
  'fonts.gstatic.com', 'assetslp.link', 'scripts.assets-landingi.com',
  'old.assets-landingi.com', 's3-eu-west-1.amazonaws.com', 'cdnjs.cloudflare.com',
];

const URL_RE = /https?:\/\/[a-z0-9.-]+\.[a-z]{2,}\/[^\s"'()<>\\]*/gi;

const cache = new Map(); // url -> Promise<{buf, type}>

async function laden(url) {
  if (!cache.has(url)) {
    cache.set(url, (async () => {
      for (let versuch = 1; ; versuch++) {
        try {
          const res = await fetch(url, {
            headers: { 'User-Agent': UA, Accept: 'image/avif,image/webp,text/css,*/*' },
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return { buf: Buffer.from(await res.arrayBuffer()), type: res.headers.get('content-type') || '' };
        } catch (e) {
          if (versuch >= 3) throw new Error(`${url}: ${e.message}`);
          await new Promise((r) => setTimeout(r, 1000 * versuch));
        }
      }
    })());
  }
  return cache.get(url);
}

const EXT = {
  'text/css': 'css', 'application/javascript': 'js', 'text/javascript': 'js',
  'application/x-javascript': 'js', 'image/svg+xml': 'svg', 'image/png': 'png',
  'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif',
  'font/woff2': 'woff2', 'font/woff': 'woff', 'font/ttf': 'ttf', 'application/font-woff': 'woff',
  'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico',
};

function dateiname(url, type) {
  const u = new URL(url);
  const mime = type.split(';')[0].trim();
  const ext = EXT[mime] || path.extname(u.pathname).slice(1) || 'bin';
  const ordner = { css: 'css', js: 'js', woff2: 'fonts', woff: 'fonts', ttf: 'fonts' }[ext] || 'img';
  const teile = u.pathname.split('/').filter((t) => t && t !== '-');
  const basis = (teile.find((t) => !/^(uc|resize|format|auto|stretch|off|quality|progressive|yes)$/.test(t)) || 'datei')
    .replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9_-]/gi, '-').slice(0, 40);
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 8);
  return `${ordner}/${basis}-${hash}.${ext}`;
}

const istLokal = (url) => LOKAL.includes(new URL(url).hostname);

// Lädt eine Datei in den Seitenordner und gibt den Pfad relativ zu assets/ zurück.
async function ablegen(url, ziel, abgelegt) {
  if (abgelegt.has(url)) return abgelegt.get(url);
  const promise = (async () => {
    const { buf, type } = await laden(url);
    const datei = dateiname(url, type);
    let inhalt = buf;
    if (datei.endsWith('.css')) inhalt = Buffer.from(await cssUmschreiben(buf.toString('utf8'), url, ziel, abgelegt));
    await mkdir(path.dirname(path.join(ziel, 'assets', datei)), { recursive: true });
    await writeFile(path.join(ziel, 'assets', datei), inhalt);
    return datei;
  })();
  abgelegt.set(url, promise);
  return promise;
}

async function cssUmschreiben(css, basisUrl, ziel, abgelegt) {
  const treffer = [...css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)];
  const ersatz = await Promise.all(treffer.map(async (m) => {
    const roh = m[2].trim();
    if (roh.startsWith('data:') || roh.startsWith('#')) return m[0];
    const abs = new URL(roh, basisUrl).href;
    if (!istLokal(abs)) return m[0];
    try {
      return `url("../${await ablegen(abs, ziel, abgelegt)}")`;
    } catch (e) {
      console.warn(`  ! ${e.message}`);
      return m[0];
    }
  }));
  let i = 0;
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, () => ersatz[i++]);
}

// Landingi-eigene Skripte (Statistik, Popups, Lightboxen, Tag-Manager, Blinkloader) entfernen.
const SKRIPT_RAUS = [
  /Blinkloader/, /landingiInternalDetails/, /tagmanager\.landingi\.io/, /LightboxRender/,
  /lpStatsModule/, /popups\.landingi\.com/, /lightbox-render\.js/, /frodo\.js/,
];

const FORMULAR_SPERRE = `<script>
document.addEventListener('submit', function (e) {
  e.preventDefault(); e.stopImmediatePropagation();
  alert('Dies ist eine Musterseite – das Formular ist noch nicht angebunden.');
}, true);
</script>`;

function aufraeumen(html, seite) {
  html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g, (tag, attr, body) =>
    SKRIPT_RAUS.some((re) => re.test(attr) || re.test(body)) ? '' : tag);
  html = html.replace(/<link\b[^>]*rel="(?:preconnect|dns-prefetch)"[^>]*>/g, '');
  html = html.replace(/<link\b[^>]*href="(?:\/assets\/js\/landend\/frodo\.js|https:\/\/ucarecdn\.com[^"]*)"[^>]*>/g, '');
  html = html.replace(/(<form\b[^>]*\baction=")[^"]*"/g, '$1#"');
  html = html.replace('<html lang="en"', '<html lang="de"');
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${seite.titel} – Musterseite</title>`);
  html = html.replace(/<link rel="shortcut icon" href=""[^>]*>/, '<link rel="icon" href="data:,">');
  html = html.replace('<meta charset="utf-8">',
    '<meta charset="utf-8"><meta name="robots" content="noindex, nofollow">');
  html = html.replace('</body>', `${FORMULAR_SPERRE}</body>`);
  return html;
}

async function klonen(seite) {
  const ziel = path.join(ROOT, seite.slug);
  const quelle = `https://www.landpage-preview.com/${seite.id}`;
  console.log(`→ ${seite.slug}  (${quelle})`);
  await rm(ziel, { recursive: true, force: true });
  await mkdir(ziel, { recursive: true });

  const res = await fetch(quelle, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${quelle}: HTTP ${res.status}`);
  let html = aufraeumen(await res.text(), seite);

  const abgelegt = new Map();
  const urls = [...new Set((html.match(URL_RE) || []).map((u) => u.replace(/&amp;/g, '&')))].filter(istLokal);
  const pfade = new Map();
  let fehler = 0;
  // In Paketen laden, damit das CDN nicht drosselt.
  for (let i = 0; i < urls.length; i += 8) {
    await Promise.all(urls.slice(i, i + 8).map(async (u) => {
      try {
        pfade.set(u, await ablegen(u, ziel, abgelegt));
      } catch (e) {
        fehler++;
        console.warn(`  ! ${e.message}`);
      }
    }));
  }
  html = html.replace(URL_RE, (u) => {
    const p = pfade.get(u.replace(/&amp;/g, '&'));
    return p ? `assets/${p}` : u;
  });

  await writeFile(path.join(ziel, 'index.html'), html);
  console.log(`  ${pfade.size} Dateien lokal${fehler ? `, ${fehler} Fehler` : ''}`);
  return fehler;
}

const seiten = JSON.parse(await readFile(path.join(ROOT, 'seiten.json'), 'utf8'));
const auswahl = process.argv.slice(2);
const liste = auswahl.length ? seiten.filter((s) => auswahl.includes(s.slug)) : seiten;
let fehler = 0;
for (const seite of liste) fehler += await klonen(seite);
if (fehler) {
  console.error(`\n${fehler} Datei(en) nicht geladen — Lauf wiederholen.`);
  process.exit(1);
}
