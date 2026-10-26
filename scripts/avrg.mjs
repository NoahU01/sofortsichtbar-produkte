// Erzeugt die AVRG-Landingpages in avrg/ – ein Ordner je Kunde (avrg.sofortsichtbar.de/<kunde>/),
// darin die allgemeine Seite, je Mitarbeiter eine Seite (/<kunde>/<nachname>/), Impressum,
// Datenschutz und eine eigene Sitemap. Quelle: scripts/avrg/vorlage.html + scripts/avrg/kunden/<kunde>/.
// Ausgabe wird committet (kein Build auf Vercel).
//   node scripts/avrg.mjs
import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const DOMAIN = 'avrg.sofortsichtbar.de';
const BASIS_URL = `https://${DOMAIN}/`;
const ROOT = path.resolve(import.meta.dirname, '..');
const ZIEL = path.join(ROOT, 'avrg');
const QUELLE = path.join(ROOT, 'scripts/avrg');
const vorlage = await readFile(path.join(QUELLE, 'vorlage.html'), 'utf8');

// CSS-Version aus dem Inhalt: Änderung an den Stylesheets → neue ?v=, kein Cache-Problem
const hash = createHash('sha1');
for (const f of ['avrg.css', 'avrg-v3.css']) hash.update(await readFile(path.join(ZIEL, 'assets/css', f)));
const version = hash.digest('hex').slice(0, 8);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const heute = new Date().toISOString().slice(0, 10);

// Alles außer assets/ neu schreiben – auch umbenannte oder entfernte Seiten verschwinden
for (const eintrag of await readdir(ZIEL)) {
  if (eintrag !== 'assets') await rm(path.join(ZIEL, eintrag), { recursive: true, force: true });
}

async function schreibe(relPfad, inhalt) {
  const datei = path.join(ZIEL, relPfad);
  await mkdir(path.dirname(datei), { recursive: true });
  await writeFile(datei, inhalt);
}

const sitemapXml = (eintraege) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${eintraege.map((s) => `  <url><loc>${s.url}</loc><lastmod>${heute}</lastmod><priority>${s.prio}</priority></url>`).join('\n')}
</urlset>
`;

function rechtsseite(gemeinsam, text, url) {
  const titel = text.match(/<!-- titel: (.+?) -->/)[1];
  const robots = gemeinsam.indexieren ? `<link rel="canonical" href="${url}">` : '<meta name="robots" content="noindex, nofollow">';
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titel)} | ${esc(gemeinsam.marke)}</title>
${robots}
<link rel="stylesheet" href="../../assets/css/avrg.css?v=${version}">
<link rel="stylesheet" href="../../assets/css/avrg-v3.css?v=${version}">
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
  <a class="logo" href="../"><img src="../../assets/bilder/${gemeinsam.logo}" alt="${esc(gemeinsam.marke)}"></a>
</div></header>
<main class="wrap recht">
${text.replace(/<!--[\s\S]*?-->\n?/g, '').trim()}
</main>
<footer class="fuss"><div class="wrap"><img src="../../assets/bilder/${gemeinsam.logo}" alt="${esc(gemeinsam.marke)}"><nav><a href="../impressum/">Impressum</a><a href="../datenschutz/">Datenschutz</a></nav></div></footer>
</body>
</html>
`;
}

const kundenSitemaps = [];
for (const kunde of (await readdir(path.join(QUELLE, 'kunden'))).filter((k) => !k.startsWith('.'))) {
  const ordner = path.join(QUELLE, 'kunden', kunde);
  const { gemeinsam, varianten } = JSON.parse(await readFile(path.join(ordner, 'kunde.json'), 'utf8'));
  const kundeUrl = `${BASIS_URL}${kunde}/`;
  const sitemap = [];

  // Strukturierte Daten nur auf der allgemeinen Seite des Kunden, sonst doppelt über alle Varianten
  const jsonld = gemeinsam.organisation
    ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', ...gemeinsam.organisation, url: kundeUrl, logo: `${BASIS_URL}assets/bilder/${gemeinsam.logo}` })}</script>\n`
    : '';

  const slugs = new Set();
  for (const v of varianten) {
    if (slugs.has(v.slug)) throw new Error(`${kunde}: Slug doppelt: "${v.slug}"`);
    slugs.add(v.slug);

    const istStart = v.slug === '';
    const url = istStart ? kundeUrl : `${kundeUrl}${v.slug}/`;
    // Relative Pfade: gleiche Seite funktioniert unter /avrg/… auf der Vercel-Domain und auf der Subdomain
    const werte = {
      ...gemeinsam, ...v, kunde, version, url,
      basis: istStart ? '../' : '../../',
      kundeBasis: istStart ? '' : '../',
      titel: istStart ? `Neue Altersvorsorge 2027 · Klarheits-Ticket | ${gemeinsam.marke}` : `Neue Altersvorsorge 2027 · ${v.name} | ${gemeinsam.marke}`,
      telefonLink: v.telefon.replace(/[^\d+]/g, ''),
    };

    const html = vorlage.replace(/\{\{(\w+)\}\}/g, (_, k) => {
      if (k === 'robots') return gemeinsam.indexieren ? `<link rel="canonical" href="${url}">` : '<meta name="robots" content="noindex, nofollow">';
      if (k === 'jsonld') return istStart ? jsonld : '';
      if (werte[k] == null || typeof werte[k] === 'object') throw new Error(`${kunde}/${v.slug}: Wert „${k}“ fehlt`);
      return esc(werte[k]);
    });

    await schreibe(path.join(kunde, v.slug, 'index.html'), html);
    sitemap.push({ url, prio: istStart ? '1.0' : '0.8' });
    console.log(`${url.padEnd(52)} ${v.name}`);
  }

  for (const seite of ['impressum', 'datenschutz']) {
    const text = await readFile(path.join(ordner, `${seite}.html`), 'utf8');
    const url = `${kundeUrl}${seite}/`;
    await schreibe(path.join(kunde, seite, 'index.html'), rechtsseite(gemeinsam, text, url));
    sitemap.push({ url, prio: '0.3' });
    console.log(`${url.padEnd(52)} ${seite}`);
  }

  // Eigene Sitemap je Kunde: lässt sich in einer Search-Console-Property nur für /<kunde>/ einreichen
  await schreibe(path.join(kunde, 'sitemap.xml'), sitemapXml(sitemap));
  if (gemeinsam.indexieren) kundenSitemaps.push(`${kundeUrl}sitemap.xml`);
  console.log(`${(kundeUrl + 'sitemap.xml').padEnd(52)} ${sitemap.length} Adressen`);
}

// Sitemap-Index und robots.txt für die ganze Subdomain
await schreibe('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${kundenSitemaps.map((u) => `  <sitemap><loc>${u}</loc><lastmod>${heute}</lastmod></sitemap>`).join('\n')}
</sitemapindex>
`);
await schreibe('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${BASIS_URL}sitemap.xml\n`);
console.log(`${BASIS_URL}sitemap.xml (Index über ${kundenSitemaps.length} Kunden), robots.txt`);
