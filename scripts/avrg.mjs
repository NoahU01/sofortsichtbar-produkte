// Erzeugt die AVRG-Landingpages (SV Owen) in avrg/: eine Seite je Variante aus
// scripts/avrg/vorlage.html + scripts/avrg/varianten.json, dazu Impressum, Datenschutz
// (scripts/avrg/rechtstexte/), robots.txt und sitemap.xml. Ausgabe wird committet (kein Build auf Vercel).
//   node scripts/avrg.mjs
import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ZIEL = path.join(ROOT, 'avrg');
const QUELLE = path.join(ROOT, 'scripts/avrg');
const daten = JSON.parse(await readFile(path.join(QUELLE, 'varianten.json'), 'utf8'));
const vorlage = await readFile(path.join(QUELLE, 'vorlage.html'), 'utf8');

// CSS-Version aus dem Inhalt: Änderung an den Stylesheets → neue ?v=, kein Cache-Problem
const hash = createHash('sha1');
for (const f of ['avrg.css', 'avrg-v3.css']) hash.update(await readFile(path.join(ZIEL, 'assets/css', f)));
const version = hash.digest('hex').slice(0, 8);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const { gemeinsam } = daten;
const BASIS_URL = `https://${gemeinsam.domain}/`;
const robotsTag = (url) => gemeinsam.indexieren
  ? `<link rel="canonical" href="${url}">`
  : '<meta name="robots" content="noindex, nofollow">';

// Strukturierte Daten nur auf der allgemeinen Seite, sonst doppelt über alle Varianten
const agentur = {
  '@context': 'https://schema.org',
  '@type': 'InsuranceAgency',
  name: 'SV SparkassenVersicherung Gebietsdirektion Owen – Schmid-Raichle · Precker GbR',
  url: BASIS_URL + gemeinsam.start + '/',
  logo: BASIS_URL + 'assets/bilder/sv-owen-logo.svg',
  telephone: '+49 7021 98080-0',
  email: 'service@sv-owen.de',
  address: { '@type': 'PostalAddress', streetAddress: 'Kirchheimer Str. 22', postalCode: '73277', addressLocality: 'Owen', addressCountry: 'DE' },
  sameAs: ['https://www.sparkassenversicherung.de/sv-owen'],
};
const jsonld = `<script type="application/ld+json">${JSON.stringify(agentur)}</script>\n`;

// Alles außer assets/ neu schreiben – auch umbenannte oder entfernte Varianten verschwinden
for (const eintrag of await readdir(ZIEL)) {
  if (eintrag !== 'assets') await rm(path.join(ZIEL, eintrag), { recursive: true, force: true });
}

async function schreibe(slug, html) {
  await mkdir(path.join(ZIEL, slug), { recursive: true });
  await writeFile(path.join(ZIEL, slug, 'index.html'), html);
}

const sitemap = [];
const slugs = new Set();
for (const v of daten.varianten) {
  if (!v.slug || slugs.has(v.slug)) throw new Error(`Slug leer oder doppelt: "${v.slug}"`);
  slugs.add(v.slug);

  const istStart = v.slug === gemeinsam.start;
  const url = `${BASIS_URL}${v.slug}/`;
  const werte = {
    ...gemeinsam, ...v, version, url, basis: '../',
    titel: istStart ? 'Neue Altersvorsorge 2027 · Klarheits-Ticket | SV Owen' : `Neue Altersvorsorge 2027 · ${v.name} | SV Owen`,
    telefonLink: v.telefon.replace(/[^\d+]/g, ''),
  };

  const html = vorlage.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (k === 'robots') return robotsTag(url);
    if (k === 'jsonld') return istStart ? jsonld : '';
    if (werte[k] == null) throw new Error(`${v.slug}: Wert „${k}“ fehlt`);
    return esc(werte[k]);
  });

  await schreibe(v.slug, html);
  sitemap.push({ url, prio: istStart ? '1.0' : '0.8' });
  console.log(`${url.padEnd(46)} ${v.name}`);
}

// Rechtsseiten: Text aus rechtstexte/, Rahmen aus Kopf und Fuß der Landingpage
for (const slug of ['impressum', 'datenschutz']) {
  const text = await readFile(path.join(QUELLE, 'rechtstexte', `${slug}.html`), 'utf8');
  const titel = text.match(/<!-- titel: (.+?) -->/)[1];
  const url = `${BASIS_URL}${slug}/`;
  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titel)} | SV Owen</title>
${robotsTag(url)}
<link rel="stylesheet" href="../assets/css/avrg.css?v=${version}">
<link rel="stylesheet" href="../assets/css/avrg-v3.css?v=${version}">
<style>
.recht{padding-block:clamp(40px,6vw,80px);overflow-wrap:anywhere}
.recht>*{max-width:46rem}
.recht h1{font-size:clamp(2.2rem,5vw,3.2rem);margin:0 0 1.6rem}
.recht h2{font-size:1.6rem;margin:2.6rem 0 .8rem}
.recht h3{font-size:1.2rem;margin:1.8rem 0 .5rem}
.recht h4{font:600 1rem/1.4 var(--font);margin:1.2rem 0 .3rem}
.recht p,.recht li{color:var(--text);font-size:16px;line-height:1.65;margin:0 0 .8rem}
.recht a{color:inherit}
.recht__quelle{margin-top:2.4rem!important;font-size:13px!important;opacity:.7}
</style>
</head>
<body>
<header class="kopf"><div class="wrap">
  <a class="logo" href="../${gemeinsam.start}/"><img src="../assets/bilder/sv-owen-logo.svg" alt="SV Owen"></a>
</div></header>
<main class="wrap recht">
${text.replace(/<!--[\s\S]*?-->\n?/g, '').trim()}
</main>
<footer class="fuss"><div class="wrap"><img src="../assets/bilder/sv-owen-logo.svg" alt="SV Owen"><nav><a href="../impressum/">Impressum</a><a href="../datenschutz/">Datenschutz</a></nav></div></footer>
</body>
</html>
`;
  await schreibe(slug, html);
  sitemap.push({ url, prio: '0.3' });
  console.log(`${url.padEnd(46)} ${titel}`);
}

const heute = new Date().toISOString().slice(0, 10);
await writeFile(path.join(ZIEL, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap.map((s) => `  <url><loc>${s.url}</loc><lastmod>${heute}</lastmod><priority>${s.prio}</priority></url>`).join('\n')}
</urlset>
`);
await writeFile(path.join(ZIEL, 'robots.txt'), gemeinsam.indexieren
  ? `User-agent: *\nAllow: /\n\nSitemap: ${BASIS_URL}sitemap.xml\n`
  : 'User-agent: *\nDisallow: /\n');
console.log(`${BASIS_URL}sitemap.xml (${sitemap.length} Adressen), robots.txt`);
