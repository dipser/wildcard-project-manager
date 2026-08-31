<p align="center">
  <img src="https://raw.githubusercontent.com/dipser/wildcard-project-manager/develop/icons/marketplace-icon.png" alt="Wildcard Project Manager" width="128">
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=dipser.wildcard-project-manager">
    <img src="https://img.shields.io/badge/VS%20Code-Marketplace-007ACC?style=flat" alt="VS Code Marketplace" />
  </a>
  <a href="https://open-vsx.org/extension/dipser/wildcard-project-manager">
    <img src="https://img.shields.io/open-vsx/v/dipser/wildcard-project-manager?label=Open%20VSX&style=flat&color=007ACC&logo=open-vsx" alt="Open VSX Version" />
  </a>
  <a href="https://github.com/dipser/wildcard-project-manager/blob/develop/LICENSE">
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

**English** · [Deutsch](https://github.com/dipser/wildcard-project-manager/blob/develop/README.de.md)

Manage **paths with wildcards**. Handy when a single path holds several projects in its subdirectories.

<p>
  <img src="https://raw.githubusercontent.com/dipser/wildcard-project-manager/develop/promo/example.png" alt="Sidebar showing two groups and their projects" width="380">
</p>

## Installation

Current version: **[wildcard-project-manager-1.0.2.vsix](https://raw.githubusercontent.com/dipser/wildcard-project-manager/develop/releases/wildcard-project-manager-1.0.2.vsix)**<br>
For older versions see [`releases/`](https://github.com/dipser/wildcard-project-manager/tree/develop/releases)

In VS Code press `Ctrl`+`Shift`+`P` and choose "`Extensions: Install from VSIX...`". Then press `Ctrl`+`Shift`+`P` again and choose "`Developer: Reload Window`".


## How it works

Instead of listing individual projects you define **groups**. Each group has a name and a list of paths. A path ending in `*` is scanned as a directory – every subdirectory found becomes a project in the list automatically.

### JSON configuration `projects.json`

```json
[
  {
    "name": "Remote Server",
    "paths": ["vscode-remote://ssh-remote+externalserver/var/www/*"],
    "hidden": [],
    "order": 1
  },
  {
    "name": "Local",
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

| Field | Description |
|---|---|
| `name` | Group name in the sidebar |
| `paths` | List of URIs or plain paths. If a path ends in `*` (or contains `*`/`?` in its last segment), every matching subdirectory is listed as a project. Without a wildcard the path itself becomes a single project. |
| `hidden` | Optional. Directory names (`*`/`?` allowed) to exclude from the scan result |
| `order` | Optional. Can also be reordered by drag & drop. |
| `collapsed` | Optional. Group starts expanded or collapsed. |
| `settings` | Optional. Settings per directory name (`*`/`?` allowed): `icon-image` = [codicon ID](https://microsoft.github.io/vscode-codicons/dist/codicon.html), `icon-color` = [theme color ID](https://code.visualstudio.com/api/references/theme-color). |

### Local and remote path formats

- `/var/www/*`
- `C:\Projects\*`
- `file:///var/www/*`
- `vscode-remote://ssh-remote+<host>/…`
- `vscode-remote://wsl+…`
- `vscode-remote://dev-container+…`

### Wildcards

Wildcards are evaluated within **one** directory only.

- `*` matches any number of characters
- `?` matches exactly one character

### Cache `projects-cache.json`

The **cache** is refreshed on every successful load.


### Features

- **Open the sidebar**: click the Wildcard Project Manager icon in the activity bar.
- **Edit the configuration**: gear icon at the top of the view, or the command `Wildcard Project Manager: Edit Configuration`. The file lives in the extension's global storage and is created with an example on first use.
- **Open a project**: clicking an entry asks for confirmation and then opens it in the current window. When the sidebar is opened for the first time, the currently open project is revealed and selected automatically.
- **Open in a new window**: context menu / inline action on the entry – without a confirmation prompt.
- **Hide a project**: right-click a project → `Hide Project`. The name moves into the group's `hidden` list; the message afterwards offers `Undo`.
- **Show/hide hidden entries**: eye icon on the group (appears on hover, and only if the group has any `hidden` entries at all). While hidden projects are visible, `showing hidden` appears next to the group name and the affected entries are marked `hidden` and greyed out. Right-click such an entry → `Show Project` removes it from `hidden` permanently.
- **Reorder groups**: drag & drop groups – this rewrites `order`. Projects cannot be dragged, they follow from the path patterns.
- **Collapse a group by default**: right-click a group → `Collapse Group by Default` (or `… Expand …`). This sets the `collapsed` field in the configuration.
- **Customize the icon**: right-click a project → `Icon`. First `Icon Color` as a submenu: eight common colors directly selectable, `More Colors…` for the full palette with a real color preview, and `Custom Color ID…` for any [theme color](https://code.visualstudio.com/api/references/theme-color). The emoji in the menu are only approximations — menus cannot render real icons, lists can. Then `Change Icon…` for the icon list and `Reset Icon`. The icon list shows around 90 codicons, grouped and rendered in the configured color; typing filters them. `Custom codicon ID…` gives access to any ID from the [official overview](https://microsoft.github.io/vscode-codicons/dist/codicon.html). Everything is stored under `settings` in the group (`icon-image` and `icon-color`).

  The icon deliberately stays a list rather than a submenu: VS Code reads menus statically from `package.json`, and every entry needs its own command. That pays off for eight colors, but not for 90 icons.
- **Find a project**: the magnifier at the top of the view filters groups and projects by name or path; the filter icon next to it clears the filter.
- **Cache**: after every successful load the extension writes the projects it found to `projects-cache.json` next to the configuration. If a path becomes unreachable later, the group shows that state instead of an empty list – marked `from cache`. The file may be deleted at any time.
- **Refresh**: refresh icon at the top of the view, needed for example after creating new directories remotely (the configuration file itself is reloaded automatically on save).


## Language

The user interface is English by default and follows VS Code's display language. It is translated into all fourteen languages VS Code ships a language pack for: Chinese (Simplified), Chinese (Traditional), Czech, French, German, Hungarian, Italian, Japanese, Korean, Polish, Portuguese (Brazil), Russian, Spanish and Turkish. This documentation exists in English and German.


## Development & testing

### Build

```bash
npm install
npm run compile
npm run package   # writes the .vsix into releases/
code --install-extension releases/wildcard-project-manager-1.0.2.vsix
```


## License

MIT
