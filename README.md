# sofortsichtbar – Produkte (Musterseiten)

Die Landingpage-Vorlagen, die vorher auf Landingi lagen. Sie sind als statisches HTML geklont, ohne Build-Schritt und ohne Abhängigkeit von Landingi.

- `index.html`: Übersicht aller Musterseiten
- `<slug>/index.html` + `<slug>/assets/`: eine Musterseite. Jeder Ordner ist **in sich geschlossen** (CSS, JS, Bilder, Schriften liegen darin) und lässt sich 1:1 in ein eigenes Repo kopieren.
- `seiten.json`: Liste der Seiten (Slug, Titel, Landingi-ID)
- `scripts/klonen.mjs`: zieht eine Seite von Landingi und legt alles lokal ab
- `scripts/korrigieren.mjs`: behebt Text-Überlappungen aus der Landingi-Vorlage (schreibt `<slug>/assets/css/korrekturen.css`)
- `scripts/uebersicht.mjs`: erzeugt `index.html` aus `seiten.json`

Alle Musterseiten sind **noindex**, per `<meta name="robots">` und per `X-Robots-Tag`-Header in `vercel.json`. Die Formulare schicken nichts ab, sondern zeigen nur einen Hinweis.

## Eine weitere Landingi-Seite übernehmen

1. Eintrag in `seiten.json` ergänzen (`slug`, `titel`, `gruppe`, `id` = UUID aus der `landpage-preview.com`-URL).
2. `node scripts/klonen.mjs <slug>`
3. `node scripts/korrigieren.mjs <slug>` (einmalig vorher: `cd scripts && npm install`)
4. `node scripts/uebersicht.mjs`

Was das Klonen ändert: Landingi-Statistik, Tag-Manager, Popups, Lightbox und Blinkloader werden entfernt. Alle Bilder, CSS, JS und Schriften (auch Google Fonts) werden lokal abgelegt. `lang="de"`, Titel und noindex werden gesetzt. Extern bleibt nur der Podbean-Podcast-Player.

## Eine Seite für einen Kunden ausrollen (vorerst von Hand)

1. Ordner `<slug>/` in ein neues Repo kopieren (Inhalt ins Root).
2. Texte, Logo, Kontaktdaten, Impressum/Datenschutz-Links anpassen.
3. noindex entfernen (Meta-Tag in `index.html`), Formular-Sperre am Ende von `index.html` durch die echte Anbindung ersetzen.
4. Vercel-Projekt im Team empiria-gmb-h anlegen, Domain verbinden.

## Offen

- [ ] **Tablet (764–959 px, z. B. iPad hochkant):** Landingis Tablet-Layout ist breiter als der Bildschirm, Karten und Kontaktblöcke überlappen seitlich. Das war schon im Original so.

- [ ] Vercel: Projekt im Team **empiria-gmb-h** anlegen und mit diesem Repo verbinden (Zugriff fehlt noch).
- [ ] Formulare → **Datenbank** (Vercel-Funktion), sobald echte Kundenprojekte kommen.
- [ ] **Cookie-Banner** + Tracking pro Kunde (Landingi hatte keinen Banner). Der Podbean-Player lädt extern und braucht dann ebenfalls Consent.
- [ ] Skript „neuer Kunde“: Vorlage → eigenes Repo → Vercel-Projekt → Domain, mit einem Befehl.
- [ ] Kundenspezifische Werte (Name, Telefon, Logo, Farben) in eine Datei pro Seite ziehen, damit Anpassen nicht im HTML passiert.
- [ ] Impressum/Datenschutz sind im Original nur Text, keine Links → pro Kunde verlinken.
