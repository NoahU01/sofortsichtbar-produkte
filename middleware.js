// Subdomains von sofortsichtbar.de auf einen Ordner in diesem Repo legen:
// avrg.sofortsichtbar.de/sv-owen/hild/ zeigt avrg/sv-owen/hild/index.html.
// Middleware statt Rewrite in vercel.json, weil Rewrites erst greifen, wenn unter dem Pfad
// keine Datei liegt – die Subdomain würde sonst Dateien aus dem ganzen Repo ausliefern.
// start = wohin die nackte Domain weiterleitet (307, damit sie sich später noch ändern lässt).
const SUBDOMAINS = {
  'avrg.sofortsichtbar.de': { ordner: '/avrg', start: '/sv-owen/' },
};

export default function middleware(request) {
  const url = new URL(request.url);
  const host = (request.headers.get('host') || url.hostname).split(':')[0];
  const ziel = SUBDOMAINS[host];
  if (!ziel) {
    return new Response(null, { headers: { 'x-middleware-next': '1' } });
  }
  const { ordner, start } = ziel;
  if (url.pathname === '/' && start) {
    url.pathname = start;
    return Response.redirect(url, 307);
  }
  // Auf der Subdomain gibt es nur den Ordner – und den nur unter seinen kurzen Adressen
  if (url.pathname === ordner || url.pathname.startsWith(ordner + '/')) {
    url.pathname = url.pathname.slice(ordner.length) || '/';
    return Response.redirect(url, 308);
  }
  url.pathname = ordner + url.pathname;
  return new Response(null, { headers: { 'x-middleware-rewrite': url.toString() } });
}
