# Lucalender

Der offizielle, vollkommen unseriöse Kalender zur fairen Verteilung von Luca zwischen Anka und Gabel.

## Funktionen

- interaktiver Monatskalender
- getrennte Monatskontingente für Anka und Gabel
- gemeinsame Online-Buchungen über Supabase
- Live-Link für Anka und Gabel; Änderungen erscheinen automatisch
- responsive Darstellung für Handy und Desktop

## Lokal öffnen

Die Seite ist statisch und nutzt Supabase als gemeinsame Datenbank. Vor dem Start:

1. `supabase-setup.sql` im SQL Editor des Supabase-Projekts ausführen.
2. Projekt-URL und öffentlichen `anon`-Key in `config.js` eintragen.
3. `index.html` über einen lokalen Webserver öffnen.

## GitHub Pages

Der Workflow unter `.github/workflows/pages.yml` veröffentlicht den Inhalt des Repositorys automatisch über GitHub Pages.
