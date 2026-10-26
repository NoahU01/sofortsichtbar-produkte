// Subdomains von sofortsichtbar.de auf einen Ordner in diesem Repo legen:
// avrg.sofortsichtbar.de/tim/ zeigt avrg/tim/index.html.
// Middleware statt Rewrite in vercel.json, weil Rewrites erst greifen, wenn unter dem Pfad
// keine Datei liegt – avrg.sofortsichtbar.de/ würde sonst die Musterseiten-Übersicht zeigen.
const SUBDOMAINS = {
  'avrg.sofortsichtbar.de': '/avrg',
};

export default function middleware(request) {
  const url = new URL(request.url);
  const host = (request.headers.get('host') || url.hostname).split(':')[0];
  const ordner = SUBDOMAINS[host];
  if (!ordner) {
    return new Response(null, { headers: { 'x-middleware-next': '1' } });
  }
  // Auf der Subdomain gibt es nur den Ordner – und den nur unter seinen kurzen Adressen
  if (url.pathname === ordner || url.pathname.startsWith(ordner + '/')) {
    url.pathname = url.pathname.slice(ordner.length) || '/';
    return Response.redirect(url, 308);
  }
  url.pathname = ordner + url.pathname;
  return new Response(null, { headers: { 'x-middleware-rewrite': url.toString() } });
}
