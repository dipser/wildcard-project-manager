# Übersetzungs-Glossar

Regeln für jede Übersetzung dieser Extension. Bei jedem Lauf mitgeben, damit
verschiedene Läufe und verschiedene Sprachen zueinander passen.

## Unverändert übernehmen

- **„Wildcard Project Manager"** – Produktname, wird nie übersetzt.
- **Platzhalter** `{0}`, `{1}` – müssen wörtlich und vollständig erhalten
  bleiben. Ihre Reihenfolge darf sich ändern, wenn die Zielsprache es verlangt.
- **Codicon-Syntax** `$(add)`, `$(refresh)` – wörtlich stehen lassen.
- **Command-URIs** `command:pathProjectManager.refresh` – wörtlich stehen lassen.
- **Beispielwerte** in Platzhaltertexten: `symbol-namespace`,
  `terminal.ansiBrightCyan`, `gitDecoration.modifiedResourceForeground`,
  `myremoteserver`. Nur das einleitende „e.g." wird übersetzt.
- **Emoji** (🔴 🟠 ⚫ …) und das Auslassungszeichen `…` bleiben erhalten,
  inklusive Position relativ zum Text.

## Terminologie

Die Begriffe so übersetzen, wie das offizielle VS-Code-Language-Pack der
jeweiligen Sprache sie übersetzt – sonst fühlt sich die Extension neben der
restlichen Oberfläche fremd an. Zielsprachen sind genau die vierzehn, für die
es ein solches Language Pack gibt: cs, de, es, fr, hu, it, ja, ko, pl, pt-br,
ru, tr, zh-cn, zh-tw. Betrifft vor allem:

| Englisch | Anmerkung |
|---|---|
| Refresh, Folder, Project, Group | VS-Code-Standardbegriffe verwenden |
| Remote | in den meisten Sprachen unübersetzt, wie in VS Code |
| Codicon, Theme | Fachbegriffe, unübersetzt |
| Hide / Show | Sichtbarkeit, nicht Löschen |

## Stil

- Menü- und Befehlseinträge (`command.*`) sind **kurze Imperative ohne
  Satzzeichen am Ende**. Die Farbnamen bleiben ein einzelnes Wort.
- Meldungstexte sind ganze Sätze mit Satzzeichen.
- Sprachen mit Höflichkeitsformen: neutral-höfliche Form, wie VS Code sie
  verwendet (de: „Sie" vermeiden, unpersönlich formulieren; ja: ですます).
- Typografische Anführungszeichen der Zielsprache verwenden: de/cs/hu/pl „…",
  fr/it/es « … », ru «…», ja/zh-tw 「…」, zh-cn/ko/tr “…”.
- Kurz halten: Die Strings stehen in einer schmalen Seitenleiste.

## Ablauf

1. `npm run i18n:scan` – schreibt offene Strings nach `l10n/_todo.json`
2. Die Felder `t` ausfüllen (`en` ist die Quelle, `was` die bisherige
   Übersetzung, falls der englische Text sich geändert hat)
3. `npm run i18n:merge` – schreibt zurück und aktualisiert die Fingerprints

Handkorrekturen direkt in den Sprachdateien bleiben erhalten, solange der
englische Quelltext unverändert ist. Ändert sich der Quelltext, wird der String
neu übersetzt und die Handkorrektur ersetzt – der Diff zeigt, wo.
