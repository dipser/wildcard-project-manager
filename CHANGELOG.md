# Changelog

## 1.0.2

- Renamed to **Wildcard Project Manager**: repository, documentation links and the in-app messages now use `wildcard-project-manager` / "Wildcard Project Manager" consistently. Command ids and configuration keys are unchanged, so existing settings and keybindings keep working.
- The README now carries a VS Code Marketplace badge next to the Open VSX one.
- On a fresh install `projects.json` is now created empty (`[]`) instead of two sample groups pointing at `myremoteserver` and `/home/user/projects`, which existed on nobody's machine.
- Fixed: the `.vsix` download links in both READMEs pointed at a file name that did not exist.

## 1.0.1

- Repository reference and all links in the README and the marketplace page now point to GitHub.
- Fixed: the extension view in VS Code showed "No README available." – the packaged README was named `readme-marketplace.md`, but VS Code looks for `README.md` in the extension folder. There is now a single English `README.md` that serves the repository, the package and the marketplace pages.
- The user interface is English by default and switches to German with VS Code's display language (`package.nls.de.json`, `l10n/bundle.l10n.de.json`); documentation is available in both languages.

## 1.0.0

- First stable release: project groups built from path patterns with wildcards, local and remote, right in the sidebar.
