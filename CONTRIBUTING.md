# Contributing

Thanks for taking a look. This file covers everything that is not about *using*
the extension: how to build it, how to run it, how the translations are kept in
step and what a release consists of.

The user documentation lives in [README.md](README.md), in German in
[README.de.md](README.de.md).

## Requirements

Node.js 20 or newer and VS Code 1.85 or newer. Everything else comes from
`npm install` – TypeScript, `@vscode/vsce` for packaging and `@vscode/l10n-dev`
for the translation files.

## Build

```bash
npm install
npm run compile
```

`compile` runs `tsc -p ./` and writes the JavaScript to `dist/`, which is what
`package.json` points at as `main`. `npm run watch` does the same continuously
and is the default build task of this workspace.

## Running it

Press `F5` in VS Code. That starts the `Run Extension` launch configuration,
which triggers the watch task and opens a second VS Code window – the Extension
Development Host – with the extension loaded from the working copy. Changes to
`src/` are compiled on save; `Developer: Reload Window` in that second window
picks them up.

The configuration the extension reads (`projects.json`) lives in the global
storage of that host, not in this repository, so the development instance has
its own project list and cannot damage your normal one.

There is no automated test suite. What needs checking after a change to the tree
or the resolver:

- a group with a single wildcard (`/var/www/*`) and one with several
  (`/var/www/*/*`)
- a remote path, since resolution and the default icon differ from local ones
- `hidden` on all levels: a folder name, a full path, a pattern
- an unreadable directory inside a wildcard level – it must be skipped and
  counted, not abort the group
- the cache: make a path unreachable and confirm the group still lists its
  projects, marked `from cache`

## Layout of the source

| File | Responsibility |
|---|---|
| `extension.ts` | Activation, all commands, the menu wiring |
| `treeProvider.ts` | The tree: nodes, icons, drag & drop, filtering |
| `projectResolver.ts` | Walks a path pattern level by level and produces the projects |
| `projectCache.ts` | Reads and writes `projects-cache.json` |
| `config.ts` | Reads and writes `projects.json` |
| `glob.ts` | The `*` matcher – one segment, no crossing levels |
| `icons.ts`, `colors.ts` | The lists offered in the icon menu |
| `uri.ts` | Comparing and building local and remote URIs |
| `decorationProvider.ts` | The greying out of hidden entries |

The colours in the icon menu are a static submenu, the icons are a quick pick.
That split is deliberate: VS Code reads menus statically from `package.json`, so
every entry needs its own registered command. That pays off for eight colours,
not for the roughly 90 codicons – and a quick pick can render them in their real
shape and colour, which a menu cannot.

## Translations

The interface ships in English plus the fourteen languages VS Code has a
language pack for. Two surfaces are translated: `package.nls.*.json` for
everything declared in `package.json` (command titles, menu labels), and
`l10n/bundle.l10n.*.json` for the strings inside the code, which reach it
through `vscode.l10n.t()`.

Never edit the language files by hand. The workflow is:

```bash
npm run i18n:scan    # collects everything outstanding into l10n/_todo.json
                     # (translate the empty "t" fields)
npm run i18n:merge   # writes them back into the language files
```

`i18n:scan` rebuilds the English base from the sources, drops keys that no
longer exist and records a fingerprint of the English text for every
translation. As long as that English text is unchanged, the translation counts
as current and manual corrections survive; once it changes, the string shows up
in `_todo.json` again. Entries left empty are skipped by `i18n:merge`, so a
large batch can be done in several sittings.

The rules every translation follows – what stays verbatim, which terminology to
use – are in [l10n/glossary.md](l10n/glossary.md). Pass it along whenever a
translation is produced, otherwise separate runs drift apart.

`i18n:merge` refuses a translation that has lost a placeholder (`{0}`), a
codicon (`$(add)`) or a command URI, because that only surfaces at runtime and
only in that one language.

## Releasing

1. Raise `version` in `package.json`.
2. Add a section to [CHANGELOG.md](CHANGELOG.md). The marketplace shows this
   file as its own tab next to the README.
3. Update the `.vsix` links in both READMEs – they name the version.
4. `npm run package`, which compiles and writes
   `releases/wildcard-project-manager-<version>.vsix`.

Step 4 stops if that file already exists. This is deliberate: a `.vsix` in
`releases/` is a shipped state, the READMEs link to it and it is installed
somewhere by now. The same file name with different content inside would be a
build nobody can identify afterwards, so the version gets raised instead of the
file being replaced.

Patch releases are preferred – a small step per change rather than collecting
several into one.

## Pull requests

Follow the surrounding code: comments are in German, identifiers and everything
user-facing in English. Keep it simple over clever, and keep a change to one
subject.

If a change affects the interface, run `npm run i18n:scan` and include the
translations. A pull request that leaves new strings untranslated leaves them
English in fourteen languages.
