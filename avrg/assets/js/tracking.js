/* =========================================================
   Conversion- und Modul-Tracking der AVRG-Landingpages
   (Vanilla-Port aus sofortsichtbar.de, src/assets/js/tracking.js)

   Ein zentraler Sender, damit Event-Namen an genau einer Stelle stehen.
   Namen sind das Vertragsstück Richtung GA4: einmal festlegen, nicht mehr
   ändern – sonst brechen Berichte und importierte Conversions.
   Konvention: alles klein, Unterstriche, <was>_<passiert>.

   Welche Person / welcher Kunde: steht im Seitenpfad (/sv-owen/hild/),
   dafür braucht es keine Custom Dimension.
   ========================================================= */
(function () {
  "use strict";

  var EVENTS = {
    ticket:  "ticket_klick",     // „Ticket einlösen“ – Sprung zum Terminbereich
    termin:  "termin_klick",     // Klick auf den SV-Terminkalender: die Conversion
    telefon: "telefon_klick",
    mail:    "mail_klick",
    rechner: "rechner_genutzt"   // erster Regler- oder Knopfdruck im Rechner
  };

  /** Sendet direkt über gtag; ohne gtag als dataLayer-Push, damit ein
      späterer Umzug auf GTM ohne Code-Änderung funktioniert. */
  function track(name, params) {
    params = params || {};
    if (typeof window.gtag === "function") {
      window.gtag("event", name, params);
    } else {
      window.dataLayer = window.dataLayer || [];
      var payload = { event: name };
      for (var k in params) if (params.hasOwnProperty(k)) payload[k] = params[k];
      window.dataLayer.push(payload);
    }
  }

  /* --- Klicks ---------------------------------------------------------- */
  function initKlicks() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest("a");
      if (!a) return;
      var href = a.getAttribute("href") || "";

      if (href.indexOf("meinsvtermin.sparkassenversicherung.de") !== -1) {
        // Öffnet in neuem Tab, die Seite bleibt – beacon trotzdem, falls nicht
        track(EVENTS.termin, { transport_type: "beacon" });
      } else if (href === "#termin") {
        track(EVENTS.ticket, {});
      } else if (href.indexOf("tel:") === 0) {
        track(EVENTS.telefon, {});
      } else if (href.indexOf("mailto:") === 0) {
        track(EVENTS.mail, {});
      }
    });
  }

  /* --- Rechner: einmal pro Seitenaufruf ------------------------------- */
  function initRechner() {
    var rechner = document.getElementById("rechner");
    if (!rechner) return;
    var gemeldet = false;
    function melden() {
      if (gemeldet) return;
      gemeldet = true;
      track(EVENTS.rechner, {});
    }
    rechner.addEventListener("input", melden);
    rechner.addEventListener("click", function (e) { if (e.target.closest("button")) melden(); });
  }

  /* --- Modul-Tracking --------------------------------------------------
     1. section_view_<id> – einmal pro Seitenaufruf, sobald die Sektion im
        sichtbaren Bereich war (Reichweite: bis wohin wird gescrollt).
     2. section_time_<id> – die dort verbrachte Zeit in Sekunden als `value`.
        GA4 summiert das zur Metrik „Ereigniswert“; Durchschnitt = Ereigniswert
        geteilt durch die Anzahl der section_view-Events derselben Sektion.
     Bindestriche in ids werden zu Unterstrichen – GA4-Eventnamen erlauben
     nur Buchstaben, Ziffern und Unterstriche.
     --------------------------------------------------------------------- */
  var SICHTBAR_ANTEIL = 0.15;
  /** Sehr hohe Sektionen erreichen den Anteil nie, füllen aber das Fenster. */
  var FENSTER_ANTEIL = 0.3;
  /** Deckel gegen Tabs, die stundenlang offen liegen. */
  var MAX_SEKUNDEN = 600;
  /** Unter einer Sekunde ist Durchscrollen, keine Aufmerksamkeit. */
  var MIN_SEKUNDEN = 1;

  function initSektionen() {
    if (!document.querySelector("section[id]") || !("IntersectionObserver" in window)) return;

    var seitenUrl = location.href;
    var gesehen = {};     // schon als view gemeldet
    var sichtbar = {};    // gerade im Bild
    var seit = {};        // laufender Timer je Sektion
    var summe = {};       // aufgelaufene Millisekunden

    function jetzt() { return performance.now(); }
    function eventId(id) { return id.replace(/-/g, "_"); }

    /** Laufende Timer stoppen und aufaddieren (Tabwechsel, Seitenwechsel). */
    function alleAnhalten() {
      for (var id in seit) {
        if (!seit.hasOwnProperty(id)) continue;
        summe[id] = (summe[id] || 0) + (jetzt() - seit[id]);
      }
      seit = {};
    }

    /** Timer für alles wieder starten, was gerade sichtbar ist – nur im
        Vordergrund, sonst läuft die Uhr im Hintergrund-Tab weiter. */
    function alleFortsetzen() {
      if (document.visibilityState !== "visible") return;
      for (var id in sichtbar) {
        if (sichtbar.hasOwnProperty(id) && !seit.hasOwnProperty(id)) seit[id] = jetzt();
      }
    }

    function senden() {
      alleAnhalten();
      for (var id in summe) {
        if (!summe.hasOwnProperty(id)) continue;
        // Erst gegen die Rohzeit prüfen: Math.round würde aus 0,6 s eine 1 s
        // machen und Durchscrollen als Verweildauer durchgehen lassen.
        if (summe[id] < MIN_SEKUNDEN * 1000) continue;
        track("section_time_" + eventId(id), {
          value: Math.min(Math.round(summe[id] / 1000), MAX_SEKUNDEN),
          page_location: seitenUrl,
          transport_type: "beacon"   // überlebt das Verlassen der Seite
        });
      }
      summe = {};
      alleFortsetzen();
    }

    var beobachter = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var id = e.target.id;
        if (!id) return;

        var istSichtbar = e.isIntersecting &&
          (e.intersectionRatio >= SICHTBAR_ANTEIL ||
           e.intersectionRect.height > window.innerHeight * FENSTER_ANTEIL);

        if (istSichtbar) {
          if (!gesehen[id]) {
            gesehen[id] = true;
            track("section_view_" + eventId(id), { page_location: seitenUrl });
          }
          sichtbar[id] = true;
          if (document.visibilityState === "visible" && !seit.hasOwnProperty(id)) seit[id] = jetzt();
        } else {
          delete sichtbar[id];
          if (seit.hasOwnProperty(id)) {
            summe[id] = (summe[id] || 0) + (jetzt() - seit[id]);
            delete seit[id];
          }
        }
      });
    }, { threshold: [0, SICHTBAR_ANTEIL, 0.5] });

    // Sofort anhängen, dann nochmal für spät gerenderte Sektionen.
    // observe() auf ein bereits beobachtetes Element ist folgenlos.
    function anhaengen() {
      document.querySelectorAll("section[id]").forEach(function (s) { beobachter.observe(s); });
    }
    anhaengen();
    setTimeout(anhaengen, 400);
    setTimeout(anhaengen, 1200);

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") senden();
      else alleFortsetzen();
    });
    window.addEventListener("pagehide", senden);
  }

  function init() {
    initKlicks();
    initRechner();
    initSektionen();
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();
})();
