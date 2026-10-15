// Farbwahl für Musterseiten. Für Kundenseiten diese Datei samt <script>-Tag entfernen
// und die Farbe fest über <html data-farbe="…"> setzen.
(function () {
  var FARBEN = {"blau":{"name":"Blau","rgb":"42,0,220"},"gruen":{"name":"Grün","rgb":"2,172,63"},"rot":{"name":"Rot","rgb":"238,0,0"}};
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
