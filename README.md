# sofortsichtbar – Produkte (Musterseiten)

Die Landingpage-Vorlagen, die vorher auf Landingi lagen. Sie sind als statisches HTML geklont, ohne Build-Schritt und ohne Abhängigkeit von Landingi.

- `index.html`: Übersicht aller Musterseiten
- `<slug>/index.html` + `<slug>/assets/`: eine Musterseite. Jeder Ordner ist **in sich geschlossen** (CSS, JS, Bilder, Schriften liegen darin) und lässt sich 1:1 in ein eigenes Repo kopieren.
- `seiten.json`: Liste der Seiten (Slug, Titel, Landingi-ID, `anrede` du/sie, `style1_id` = inhaltlich geprüfte Style-1-Fassung als Referenz)
- `scripts/klonen.mjs`: zieht eine Seite von Landingi und legt alles lokal ab
- `inhalte.json` + `scripts/inhalte.mjs`: inhaltliche Korrekturen (Kundenprüfung vom 14.10.2026), jeweils mit Verweis auf den Befund
- `farben.json` + `scripts/anpassen.mjs`: Farbpaletten (Blau, Grün, Rot) und Tablet-Umstellung, siehe unten
- `scripts/korrigieren.mjs`: behebt Text-Überlappungen aus der Landingi-Vorlage (schreibt `<slug>/assets/css/korrekturen.css`)
- `scripts/uebersicht.mjs`: erzeugt `index.html` aus `seiten.json`

Alle Musterseiten sind **noindex**, per `<meta name="robots">` und per `X-Robots-Tag`-Header in `vercel.json`. Die Formulare schicken nichts ab, sondern zeigen nur einen Hinweis.

## Eine weitere Landingi-Seite übernehmen

1. Eintrag in `seiten.json` ergänzen (`slug`, `titel`, `gruppe`, `id` = UUID aus der `landpage-preview.com`-URL).
2. `node scripts/klonen.mjs <slug>`
3. `node scripts/inhalte.mjs` (wendet `inhalte.json` an)
4. `node scripts/anpassen.mjs <slug>` (Tablet + Farben)
5. `node scripts/korrigieren.mjs <slug>` (einmalig vorher: `cd scripts && npm install`)
6. `node scripts/uebersicht.mjs`

Alles auf einmal für alle Seiten: `cd scripts && npm run alles`.
Achtung: `klonen.mjs` überschreibt den Seitenordner. Danach immer die Schritte 3–5 laufen lassen, sonst fehlen die Korrekturen.

## Farben

Jede Seite gibt es in allen Farben aus `farben.json`. Landingi färbt Buttons und Akzente über fünf Abstufungen `--color-primary-0…4`, nur die werden getauscht. Bilder und Icons sind in allen Farben gleich.

- **Musterseite:** Knopf unten links oder Link mit `?farbe=gruen` / `?farbe=rot`.
- **Kundenseite:** im `<html>`-Tag `data-farbe="…"` setzen, `assets/js/farbwahl.js` und den zugehörigen `<script>`-Tag entfernen.
- **Neue Farbe:** Eintrag in `farben.json` (5 RGB-Abstufungen, hell → dunkel, Mitte = Hauptfarbe), dann `node scripts/anpassen.mjs`.

## Tablet

Landingis eigenes Tablet-Layout (764–959 px) war breiter als der Bildschirm. `anpassen.mjs` verschiebt den Mobile-Breakpoint auf 959 px, Tablets zeigen also das Mobile-Layout als mittige Spalte.

Was das Klonen ändert: Landingi-Statistik, Tag-Manager, Popups, Lightbox und Blinkloader werden entfernt. Alle Bilder, CSS, JS und Schriften (auch Google Fonts) werden lokal abgelegt. `lang="de"`, Titel und noindex werden gesetzt. Extern bleibt nur der Podbean-Podcast-Player.

## Eine Seite für einen Kunden ausrollen (vorerst von Hand)

1. Ordner `<slug>/` in ein neues Repo kopieren (Inhalt ins Root).
2. Texte, Logo, Kontaktdaten, Impressum/Datenschutz-Links anpassen.
3. noindex entfernen (Meta-Tag in `index.html`), Formular-Sperre am Ende von `index.html` durch die echte Anbindung ersetzen.
4. Farbe festlegen (siehe „Farben“).
5. Vercel-Projekt im Team empiria-gmb-h anlegen, Domain verbinden.

## Offen


- [ ] Vercel: Projekt im Team **empiria-gmb-h** anlegen und mit diesem Repo verbinden (Zugriff fehlt noch).
- [ ] Formulare → **Datenbank** (Vercel-Funktion), sobald echte Kundenprojekte kommen.
- [ ] **Cookie-Banner** + Tracking pro Kunde (Landingi hatte keinen Banner). Der Podbean-Player lädt extern und braucht dann ebenfalls Consent.
- [ ] Skript „neuer Kunde“: Vorlage → eigenes Repo → Vercel-Projekt → Domain, mit einem Befehl.
- [ ] Kundenspezifische Werte (Name, Telefon, Logo, Farben) in eine Datei pro Seite ziehen, damit Anpassen nicht im HTML passiert.
- [ ] Impressum/Datenschutz sind im Original nur Text, keine Links → pro Kunde verlinken.
