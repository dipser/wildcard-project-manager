<p align="center">
  <img src="icons/marketplace-icon.png" alt="Wildcard Project Manager" width="128">
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=dipser.wildcard-project-manager">
    <img src="https://img.shields.io/badge/VS%20Code-Marketplace-007ACC?style=flat" alt="VS Code Marketplace" />
  </a>
  <a href="https://open-vsx.org/extension/dipser/wildcard-project-manager">
    <img src="https://img.shields.io/open-vsx/v/dipser/wildcard-project-manager?label=Open%20VSX&style=flat&color=007ACC&logo=open-vsx" alt="Open VSX Version" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License: MIT" />
  </a>
  <a href="https://github.com/dipser/wildcard-project-manager/stargazers">
    <img src="https://img.shields.io/github/stars/dipser/wildcard-project-manager.svg?style=flat&logo=github" alt="GitHub stars" />
  </a>
  <a href="https://github.com/dipser/wildcard-project-manager/issues">
    <img src="https://img.shields.io/github/issues/dipser/wildcard-project-manager.svg?style=flat&logo=github" alt="GitHub issues" />
  </a>
</p>

# Wildcard Project Manager

[English](https://github.com/dipser/wildcard-project-manager/blob/develop/README.md) · **Deutsch**

Verwalte **Pfade mit Wildcards**. Praktisch, wenn in einem Pfad mehrere Projekte in Unterordnern liegen.

<p>
  <img src="promo/example.png" alt="Seitenleiste mit zwei Gruppen und ihren Projekten" width="380">
</p>

## Installation

Aktuelle Version: **[wildcard-project-manager-1.0.3.vsix](https://raw.githubusercontent.com/dipser/wildcard-project-manager/develop/releases/wildcard-project-manager-1.0.3.vsix)**<br>
Ältere Versionen siehe [`releases/`](https://github.com/dipser/wildcard-project-manager/tree/develop/releases)

In VSCode drücke `Strg`+`Shift`+`P` und wähle "`Extensions: Install from VSIX...`". Danach über `Strg`+`Shift`+`P` wähle "`Developer: Reload Window`".


## Funktionsweise

### JSON-Konfiguration `projects.json`

```json
[
  {
    "name": "Remote Server",
    "paths": ["vscode-remote://ssh-remote+externalserver/var/www/*/*"],
    "hidden": [],
    "order": 1
  },
  {
    "name": "Lokal",
    "paths": ["file:///home/user/projects/*"],
    "hidden": ["node_modules", ".old-*"],
    "order": 2,
    "collapsed": true,
    "settings": {
      "shop": { "icon-image": "rocket", "icon-color": "charts.red" }
    }
  }
]
```

| Feld | Beschreibung |
|---|---|
| `name` | Gruppenname in der Seitenleiste |
| `paths` | Liste von URIs oder nackten Pfaden. Ein `*` darf in jedem Segment stehen; alle passenden Unterordner werden als Projekte aufgelistet. Ohne Wildcard wird der Pfad selbst als einzelnes Projekt eingetragen. |
| `hidden` | Optional. Ordnernamen (auch mit `*`), die aus dem Scan-Ergebnis ausgeschlossen werden sollen. Bei mehrstufigen Mustern darf ein Eintrag **jede Ebene** meinen: `domain.com` blendet den ganzen Aufklapper aus, `domain.com/logs` genau einen Eintrag, und das kurze `logs` jeden so heißenden Ordner unter jeder Domain. |
| `order` | Optional. Umsortieren auch per Drag & Drop. |
| `collapsed` | Optional. Gruppe startet auf- oder zugeklappt. |
| `settings` | Optional. Einstellungen nach Ordnername (auch mit `*`): `icon-image` = [Codicon-ID](https://microsoft.github.io/vscode-codicons/dist/codicon.html), `icon-color` = [Theme-Farb-Id](https://code.visualstudio.com/api/references/theme-color). |

### Lokale und Remote Pfad-Angaben:

- `/var/www/*`
- `C:\Projekte\*`
- `file:///var/www/*`
- `vscode-remote://ssh-remote+<host>/…`
- `vscode-remote://wsl+…`
- `vscode-remote://dev-container+…`

### Wildcards

`*` steht für beliebig viele Zeichen und ist die einzige Wildcard. Ein `*` bleibt immer innerhalb **eines** Verzeichnisses – es überspringt nie eine Ebene. Dafür darf jedes Segment eines Pfades eine Wildcard enthalten, und der Pfad wird dann Ebene für Ebene abgelaufen.

#### Mehrere Ebenen

Typisch für Plesk-Server, wo unter jeder Domain ihre Subdomains liegen:

```json
{ "name": "Server", "paths": ["/var/www/*/*"], "hidden": ["logs", "conf", "httpdocs", ".*"] }
```

```
▾ Server
  ▾ domain1.com
      sub1.domain1.com
      sub2.domain1.com
  ▸ domain2.com
```

Jede Wildcard-Ebene außer der letzten wird zu einem **Aufklapper**. Ein Klick darauf klappt nur auf und zu; das Verzeichnis selbst öffnest du über das Kontextmenü oder den Button `In neuem Fenster öffnen`. Aufklapper starten zugeklappt, danach merkt sich VS Code den Zustand.

Der volle Projektname setzt sich aus allen Ebenen **ab der ersten Wildcard** zusammen (`domain1.com/sub1.domain1.com`) – das feste Präfix davor gehört nicht dazu, und im Baum steht ohnehin nur die unterste Ebene. Der volle Name ist der Schlüssel für `hidden` und `settings` und bleibt damit auch dann eindeutig, wenn zwei Domains dieselbe Unterseite haben.

Ein Rechtsklick auf einen Aufklapper bietet `Projekt ausblenden` genau wie bei einem Projekt; in `hidden` landet dann sein eigener Weg (`domain2.com`) und damit alles darunter. Solange versteckte Einträge eingeblendet sind, steht so ein Aufklapper ausgegraut da und lässt sich über sein Kontextmenü wieder einblenden.

Auch feste Segmente hinter einer Wildcard sind erlaubt: `/var/www/*/httpdocs` findet je Domain das Dokumentverzeichnis. Unterordner, die sich nicht lesen lassen – auf Plesk gehören etliche root – werden übersprungen und am Ende der Gruppe als Hinweis gezählt; die übrigen Domains bleiben davon unberührt.

### Cache `projects-cache.json`

Es wird ein **Cache** bei jedem fehlerfreien Ladevorgang aktualisiert.


### Features

- **Seitenleiste öffnen**: Klick auf das Path-Project-Manager-Icon in der Activity Bar.
- **Konfiguration bearbeiten**: Zahnrad-Icon oben in der View, oder Befehl `Wildcard Project Manager: Konfiguration bearbeiten`. Die Datei liegt im globalen Storage der Extension und wird beim ersten Aufruf mit einem Beispiel angelegt.
- **Projekt öffnen**: Klick auf einen Eintrag fragt nach und öffnet ihn dann im aktuellen Fenster. Beim ersten Öffnen der Seitenleiste wird das aktuell geöffnete Projekt automatisch angesteuert und ausgewählt.
- **In neuem Fenster öffnen**: Kontextmenü / Inline-Aktion am Eintrag – ohne Rückfrage.
- **Projekt ausblenden**: Rechtsklick auf ein Projekt → `Projekt ausblenden`. Der Name wandert in die `hidden`-Liste der Gruppe; die Meldung danach bietet `Rückgängig` an.
- **Versteckte ein-/ausblenden**: Auge-Symbol an der Gruppe (erscheint beim Überfahren mit der Maus, nur wenn die Gruppe überhaupt `hidden`-Einträge hat). Solange versteckte Projekte sichtbar sind, steht `versteckte sichtbar` neben dem Gruppennamen und die betroffenen Einträge sind mit `ausgeblendet` markiert und ausgegraut. Rechtsklick auf so einen Eintrag → `Projekt einblenden` entfernt ihn dauerhaft aus `hidden`.
- **Gruppen umsortieren**: Gruppen per Drag & Drop verschieben – das schreibt `order` neu. Projekte lassen sich nicht ziehen, sie ergeben sich aus den Pfad-Mustern.
- **Gruppe standardmäßig zuklappen**: Rechtsklick auf eine Gruppe → `Gruppe standardmäßig zuklappen` (bzw. `… aufklappen`). Das setzt das Feld `collapsed` in der Konfiguration.
- **Icon anpassen**: Rechtsklick auf ein Projekt → `Icon`. Darin zuerst `Icon Farbe` als Untermenü: acht gängige Farben direkt anklickbar, `Weitere Farben…` für die vollständige Palette mit echter Farbvorschau und `Eigene Farb-Id…` für jede beliebige [Theme-Farbe](https://code.visualstudio.com/api/references/theme-color). Die Emoji im Menü sind nur Näherungen — Menüs können keine echten Icons rendern, Listen schon, danach `Icon wechseln…` für die Icon-Liste und `Icon zurücksetzen`. Die Icon-Liste zeigt rund 90 Codicons gruppiert und in der eingestellten Farbe gerendert, Tippen filtert; über `Eigene Codicon-ID…` ist jede ID aus der [offiziellen Übersicht](https://microsoft.github.io/vscode-codicons/dist/codicon.html) erreichbar. Alles landet unter `settings` in der Gruppe (`icon-image` und `icon-color`).

  Das Icon bleibt bewusst eine Liste statt eines Untermenüs: VS Code liest Menüs statisch aus `package.json`, jeder Eintrag braucht einen eigenen Befehl. Bei acht Farben lohnt sich das, bei 90 Icons nicht.
- **Projekt suchen**: Lupe oben in der View filtert Gruppen und Projekte nach Name oder Pfad; das Filter-Symbol daneben setzt den Filter zurück.
- **Cache**: Nach jedem fehlerfreien Laden schreibt die Extension die gefundenen Projekte nach `projects-cache.json` neben die Konfiguration. Ist ein Pfad später nicht erreichbar, zeigt die Gruppe diesen Stand statt einer leeren Liste – markiert mit `aus dem Cache`. Die Datei darf jederzeit gelöscht werden.
- **Aktualisieren**: Refresh-Icon oben in der View, nötig z. B. wenn du remote neue Ordner angelegt hast (die Konfigurationsdatei selbst wird beim Speichern automatisch neu geladen).



## Sprachen

Die Oberfläche ist standardmäßig englisch und richtet sich nach der Anzeigesprache von VS Code. Sie ist in alle vierzehn Sprachen übersetzt, für die VS Code ein Language Pack anbietet: Chinesisch (vereinfacht), Chinesisch (traditionell), Deutsch, Französisch, Italienisch, Japanisch, Koreanisch, Polnisch, Portugiesisch (Brasilien), Russisch, Spanisch, Tschechisch, Türkisch und Ungarisch. Diese Dokumentation liegt auf Englisch und Deutsch vor.


## Entwicklung & Testen

### Build

```bash
npm install
npm run compile
npm run package   # legt die .vsix im Ordner releases/ ab
code --install-extension releases/wildcard-project-manager-1.0.3.vsix
```


## Lizenz

MIT
