# Changelog

## 1.0.4

- Expandable nodes can now carry their own icon and color, just like projects.
- New marketplace icon.

## 1.0.3

- Wildcards may now appear in **any segment** of a path, not just the last one. `/var/www/*/*` walks two levels.
- The user interface is now translated into Chinese (Simplified), Chinese (Traditional), Czech, French, German, Hungarian, Italian, Japanese, Korean, Polish, Portuguese (Brazil), Russian, Spanish and Turkish.
- New translation workflow: `npm run i18n:scan` collects everything outstanding into `l10n/_todo.json`, `npm run i18n:merge` writes it back. Fingerprints of the English source keep manual corrections intact as long as the original is unchanged; once it changes, the string is translated afresh. The rules live in `l10n/glossary.md`.

## 1.0.2

- Renamed to **Wildcard Project Manager**.
- The README now has a VS Code Marketplace badge.
- On a fresh install `projects.json` is now created empty.
- Fixed: the `.vsix` download links.

## 1.0.1

- Repository reference and all links in the README and the marketplace page now point to GitHub.
- Fixed: the extension view in VS Code showed "No README available." – the packaged README was named `readme-marketplace.md`, but VS Code looks for `README.md` in the extension folder. There is now a single English `README.md` that serves the repository, the package and the marketplace pages.
- The user interface is now in English by default.

## 1.0.0

- First stable release: project groups built from path patterns with wildcards, local and remote, right in the sidebar.
