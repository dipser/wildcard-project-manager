<!-- <p>
  <img src="https://raw.githubusercontent.com/dipser/wildcard-project-manager/develop/icons/marketplace-icon.png" alt="Wildcard Project Manager" width="128">
</p> -->

# <img src="https://raw.githubusercontent.com/dipser/wildcard-project-manager/develop/icons/marketplace-icon.png" alt="Wildcard Project Manager" width="26"> Wildcard Project Manager 1.0.4


[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-007ACC?style=flat)](https://marketplace.visualstudio.com/items?itemName=dipser.wildcard-project-manager)
[![Open VSX Version](https://img.shields.io/open-vsx/v/dipser/wildcard-project-manager?label=Open%20VSX&style=flat&color=007ACC&logo=open-vsx)](https://open-vsx.org/extension/dipser/wildcard-project-manager)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/dipser/wildcard-project-manager/blob/develop/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/dipser/wildcard-project-manager.svg?style=flat&logo=github)](https://github.com/dipser/wildcard-project-manager/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/dipser/wildcard-project-manager.svg?style=flat&logo=github)](https://github.com/dipser/wildcard-project-manager/issues)


**English** · [Deutsch](https://github.com/dipser/wildcard-project-manager/blob/develop/README.de.md)

Manage **paths with wildcards**. Handy when a single path holds several projects in its subdirectories.

<p>
  <img src="https://raw.githubusercontent.com/dipser/wildcard-project-manager/develop/promo/example.png" alt="Sidebar showing two groups and their projects" width="380">
</p>

## Installation

[Download from Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=dipser.wildcard-project-manager)<br>
[Download from Open VSX](https://open-vsx.org/extension/dipser/wildcard-project-manager)<br>
[Download from Git-Repository](https://raw.githubusercontent.com/dipser/wildcard-project-manager/develop/releases/wildcard-project-manager-1.0.4.vsix)<br>
Older versions in [`releases/`](https://github.com/dipser/wildcard-project-manager/tree/develop/releases)

Manual Install: In VS Code press `Ctrl`+`Shift`+`P` and choose "`Extensions: Install from VSIX...`". Then press `Ctrl`+`Shift`+`P` again and choose "`Developer: Reload Window`".


## How it works

Instead of listing individual projects you define **groups**. Each group has a name and a list of paths. A path ending in `*` is scanned as a directory – every subdirectory found becomes a project in the list automatically. Wildcards may appear in any segment: `/var/www/*/*` walks two levels and files the matches under one expandable node per parent directory.

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
| `paths` | List of URIs or plain paths. A `*` may appear in any segment; every matching subdirectory is listed as a project. Without a wildcard the path itself becomes a single project. |
| `hidden` | Optional. Directory names (`*` allowed) to exclude from the scan result. With multi-level patterns an entry may name **any level**: `domain.com` hides that whole expandable node, `domain.com/logs` a single entry, and the bare `logs` every folder of that name under any domain. |
| `order` | Optional. Can also be reordered by drag & drop. |
| `collapsed` | Optional. Group starts expanded or collapsed. |
| `settings` | Optional. Settings per directory name (`*` allowed): `icon-image` = [codicon ID](https://microsoft.github.io/vscode-codicons/dist/codicon.html), `icon-color` = [theme color ID](https://code.visualstudio.com/api/references/theme-color). |

### Local and remote path formats

- `/var/www/*`
- `C:\Projects\*`
- `file:///var/www/*`
- `vscode-remote://ssh-remote+<host>/…`
- `vscode-remote://wsl+…`
- `vscode-remote://dev-container+…`

### Wildcards

`*` matches any number of characters and is the only wildcard. It never crosses a directory level, but may sit in every segment – the path is then walked level by level.

#### Several levels

Typical for Plesk servers, where each domain holds its subdomains:

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

- **Expandable node**: every wildcard level except the last. Clicking only expands and collapses, the directory opens from the context menu. `Hide Project` on it hides everything below.
- **Project name**: every level from the first wildcard onwards (`domain1.com/sub1.domain1.com`) – the key for `hidden` and `settings`, and unambiguous when two domains share a subdirectory name.
- **Fixed segments** after a wildcard work too: `/var/www/*/httpdocs` finds the document root of every domain.
- **Unreadable directories** are skipped and counted as a note at the end of the group.

### Cache `projects-cache.json`

The **cache** is refreshed on every successful load.


### Features

- **Sidebar**: the Wildcard Project Manager icon in the activity bar.
- **Configuration**: gear icon in the view, or `Wildcard Project Manager: Edit Configuration`. The file sits in the extension's global storage.
- **Open**: click an entry, confirm, opens in the current window.
- **New window**: context menu or inline action, without a prompt.
- **Hide**: right-click → `Hide Project`, the message offers `Undo`.
- **Show hidden**: eye icon on the group; `Show Project` takes an entry out of `hidden` again.
- **Order**: drag & drop groups, which rewrites `order`. Projects follow from the patterns.
- **Collapsed**: right-click a group → `Collapse Group by Default`, stored as `collapsed`.
- **Icon**: right-click a project or folder → `Icon` for [colour](https://code.visualstudio.com/api/references/theme-color) and [codicon](https://microsoft.github.io/vscode-codicons/dist/codicon.html), stored under `settings`.
- **Search**: magnifier in the view filters groups and projects by name or path.
- **Cache**: an unreachable path falls back to `projects-cache.json`, marked `from cache`.
- **Refresh**: refresh icon, for directories created elsewhere. The configuration itself reloads on save.


## Languages

- Chinese (Simplified)
- Chinese (Traditional)
- Czech
- **English** (default)
- French
- German
- Hungarian
- Italian
- Japanese
- Korean
- Polish
- Portuguese (Brazil)
- Russian
- Spanish
- Turkish


## Development

Building, running the extension in the Extension Development Host, the translation workflow and the release steps are described in [CONTRIBUTING.md](https://github.com/dipser/wildcard-project-manager/blob/develop/CONTRIBUTING.md).


## License

[MIT](https://github.com/dipser/wildcard-project-manager/blob/develop/LICENSE)
