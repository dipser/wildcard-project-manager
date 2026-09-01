import * as vscode from 'vscode';
import { FolderNode, GroupNode, PathProjectManagerProvider, ProjectNode } from './treeProvider';
import { CurrentProjectDecorationProvider } from './decorationProvider';
import {
  ensureConfigFile,
  getConfigUri,
  ProjectGroup,
  ProjectSettings,
  readGroups,
  readGroupsForWrite,
  writeGroups
} from './config';
import { findSettings } from './projectResolver';
import { formatUriForConfig, parseProjectPath } from './uri';
import { ICON_CATALOG } from './icons';
import { COLOR_COMMANDS, COLOR_PALETTE } from './colors';

type IconPick = vscode.QuickPickItem & { iconId?: string; custom?: boolean };

/**
 * Icon-Auswahl mit Vorschau: jeder Eintrag rendert sein Codicon in der aktuell
 * eingestellten Farbe, statt die ID nur als Text anzubieten.
 */
async function pickCodicon(
  current: ProjectSettings,
  projectName: string
): Promise<{ icon: string | undefined } | undefined> {
  const currentColor = current['icon-color'];
  const currentIcon = current['icon-image'];
  const color = currentColor ? new vscode.ThemeColor(currentColor) : undefined;

  const items: IconPick[] = [
    {
      label: vscode.l10n.t('Default icon'),
      description: vscode.l10n.t('Folder or remote, depending on the path'),
      iconPath: new vscode.ThemeIcon('circle-slash'),
      iconId: ''
    },
    {
      label: vscode.l10n.t('Custom codicon ID…'),
      description: vscode.l10n.t('for icons not listed here'),
      iconPath: new vscode.ThemeIcon('edit'),
      custom: true
    }
  ];

  for (const group of ICON_CATALOG) {
    items.push({ label: vscode.l10n.t(group.title), kind: vscode.QuickPickItemKind.Separator });
    for (const id of group.ids) {
      items.push({
        label: id,
        description: id === currentIcon ? vscode.l10n.t('current') : undefined,
        iconPath: new vscode.ThemeIcon(id, color),
        iconId: id
      });
    }
  }

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: vscode.l10n.t('Icon for “{0}” – type to filter', projectName),
    matchOnDescription: true
  });
  if (!picked) {
    return undefined;
  }

  if (picked.custom) {
    const typed = await vscode.window.showInputBox({
      prompt: vscode.l10n.t('Codicon ID (leave empty for the default icon)'),
      value: currentIcon ?? '',
      placeHolder: vscode.l10n.t('e.g. symbol-namespace')
    });
    if (typed === undefined) {
      return undefined;
    }
    return { icon: typed.trim() || undefined };
  }

  return { icon: picked.iconId || undefined };
}


export function activate(context: vscode.ExtensionContext): void {
  const provider = new PathProjectManagerProvider(context);
  const decorationProvider = new CurrentProjectDecorationProvider();

  const treeView = vscode.window.createTreeView('pathProjectManagerView', {
    treeDataProvider: provider,
    dragAndDropController: provider,
    showCollapseAll: true
  });

  function updateFilterContext(): void {
    vscode.commands.executeCommand('setContext', 'pathProjectManager.filterActive', !!provider.filter);
    treeView.message = provider.filter ? vscode.l10n.t('Filter: "{0}"', provider.filter) : undefined;
  }

  function updateCurrentProject(): void {
    const folders = vscode.workspace.workspaceFolders ?? [];
    decorationProvider.setCurrent(folders.map(f => f.uri));
  }

  /** Gibt zurück, ob der Eintrag tatsächlich angesteuert werden konnte. */
  async function revealCurrentProject(): Promise<boolean> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      return false;
    }
    const node = await provider.findProject(folder.uri);
    if (!node) {
      return false;
    }
    try {
      await treeView.reveal(node, { select: true, focus: false, expand: true });
      return true;
    } catch {
      // Reveal ist Komfort, kein Muss – z. B. wenn der Baum gerade neu aufgebaut
      // wird oder der Eintrag durch einen aktiven Filter ausgeblendet ist.
      return false;
    }
  }

  // Erst wenn die Seitenleiste tatsächlich sichtbar ist: reveal() würde die View
  // sonst von sich aus aufziehen, obwohl der Nutzer sie gar nicht geöffnet hat.
  let revealed = false;
  async function revealCurrentProjectOnce(): Promise<void> {
    if (revealed || !treeView.visible) {
      return;
    }
    // Erst nach dem geglückten Versuch abhaken: steht die Remote-Verbindung noch
    // nicht, findet findProject nichts – dann darf der nächste Blick in die
    // Seitenleiste es erneut versuchen, statt es für die Sitzung aufzugeben.
    revealed = await revealCurrentProject();
  }

  /**
   * Die aktuell wirksamen Einstellungen eines Projekts als Ausgangspunkt zum
   * Bearbeiten – auch dann, wenn sie aus einem Muster-Schlüssel stammen. Sonst
   * verlöre ein Projekt, dessen Icon aus `"test-*"` kommt, genau dieses Icon,
   * sobald man nur seine Farbe ändert.
   */
  function currentSettings(group: ProjectGroup, projectName: string): ProjectSettings {
    return { ...(findSettings(group.settings, projectName) ?? {}) };
  }

  /**
   * Hinweis, wenn Icon und Farbe eines Projekts aus einem Muster-Schlüssel wie
   * `"test-*"` stammen: das Muster zu ändern würde auch andere Projekte treffen,
   * also kann der Befehl hier nichts tun – wie beim Einblenden eines über
   * `hidden` versteckten Projekts.
   */
  function warnAboutPattern(group: ProjectGroup, projectName: string): void {
    if (findSettings(group.settings, projectName)) {
      vscode.window.showWarningMessage(
        vscode.l10n.t('Wildcard Project Manager: Icon and color for “{0}” come from a pattern in “settings”. Please adjust the pattern in the configuration.', projectName)
      );
    }
  }

  /**
   * Einstellungen eines Projekts speichern – und den Eintrag ganz entfernen,
   * wenn weder Icon noch Farbe gesetzt sind, damit die Konfiguration nicht
   * zumüllt.
   *
   * Liest die Konfiguration bewusst selbst und frisch ein: zwischen dem Öffnen
   * eines Dialogs und der Auswahl kann sie sich geändert haben, und die alte
   * Kopie zurückzuschreiben würde diese Änderungen verwerfen.
   */
  async function applySettings(
    groupName: string,
    projectName: string,
    settings: ProjectSettings
  ): Promise<void> {
    const groups = await readGroupsForWrite(context);
    const group = groups?.find(g => g.name === groupName);
    if (!groups || !group) {
      return;
    }

    if (settings['icon-image'] || settings['icon-color']) {
      group.settings ??= {};
      group.settings[projectName] = settings;
    } else if (group.settings?.[projectName]) {
      delete group.settings[projectName];
      if (Object.keys(group.settings).length === 0) {
        delete group.settings;
      }
    } else {
      // Nichts zu löschen: entweder war nie etwas gesetzt, oder die Darstellung
      // kommt aus einem Muster. Ohne den Hinweis bliebe „Standardfarbe“ dort
      // wirkungslos, ohne das je zu sagen.
      warnAboutPattern(group, projectName);
      return;
    }

    await writeGroups(context, groups);
    provider.refresh();
  }

  async function setIconColor(node: ProjectNode, colorId: string): Promise<void> {
    if (!node) {
      return;
    }
    const groups = await readGroups(context);
    const group = groups.find(g => g.name === node.group.name);
    if (!group) {
      return;
    }
    const current = currentSettings(group, node.name);
    current['icon-color'] = colorId || undefined;
    await applySettings(node.group.name, node.name, current);
  }

  async function setGroupCollapsed(node: GroupNode, collapsed: boolean): Promise<void> {
    if (!node) {
      return;
    }
    const groups = await readGroupsForWrite(context);
    const group = groups?.find(g => g.name === node.group.name);
    if (!groups || !group) {
      return;
    }
    if (collapsed) {
      group.collapsed = true;
    } else {
      delete group.collapsed;
    }
    await writeGroups(context, groups);
    provider.refresh();
  }

  context.subscriptions.push(
    treeView,
    provider,
    vscode.window.registerFileDecorationProvider(decorationProvider),

    vscode.commands.registerCommand('pathProjectManager.refresh', () => {
      provider.refresh();
      updateCurrentProject();
    }),

    vscode.commands.registerCommand('pathProjectManager.openConfig', async () => {
      const uri = await ensureConfigFile(context);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc);
    }),

    vscode.commands.registerCommand('pathProjectManager.openInCurrentWindow', async (node: ProjectNode | FolderNode) => {
      const confirmed = await vscode.window.showInformationMessage(
        vscode.l10n.t('Switch to “{0}”?', node.name),
        { modal: true, detail: `${vscode.l10n.t('The current window will be replaced by the project.')}\n\n${node.uri.toString(true)}` },
        vscode.l10n.t('Switch')
      );
      if (confirmed !== vscode.l10n.t('Switch')) {
        return;
      }
      await vscode.commands.executeCommand('vscode.openFolder', node.uri, { forceNewWindow: false });
    }),

    vscode.commands.registerCommand('pathProjectManager.openInNewWindow', (node: ProjectNode | FolderNode) => {
      vscode.commands.executeCommand('vscode.openFolder', node.uri, { forceNewWindow: true });
    }),

    vscode.commands.registerCommand('pathProjectManager.addCurrentFolder', async () => {
      const folders = vscode.workspace.workspaceFolders ?? [];
      if (folders.length === 0) {
        vscode.window.showErrorMessage(vscode.l10n.t('Wildcard Project Manager: No folder is currently open.'));
        return;
      }

      let folder = folders[0];
      if (folders.length > 1) {
        const picked = await vscode.window.showQuickPick(
          folders.map(f => ({ label: f.name, description: f.uri.toString(true), folder: f })),
          { placeHolder: vscode.l10n.t('Which open folder should be saved?') }
        );
        if (!picked) {
          return;
        }
        folder = picked.folder;
      }

      const pathString = formatUriForConfig(folder.uri);

      const groups = await readGroupsForWrite(context);
      if (!groups) {
        return;
      }
      const NEW_GROUP = '$new';
      const groupPick = await vscode.window.showQuickPick(
        [
          ...groups.map(g => ({ label: g.name, id: g.name })),
          { label: vscode.l10n.t('$(add) New group…'), id: NEW_GROUP }
        ],
        { placeHolder: vscode.l10n.t('Add to which group?') }
      );
      if (!groupPick) {
        return;
      }

      let group: ProjectGroup;
      if (groupPick.id === NEW_GROUP) {
        const name = await vscode.window.showInputBox({ prompt: vscode.l10n.t('Name of the new group') });
        if (!name) {
          return;
        }
        // Ans Ende, nicht an Position "Anzahl + 1": die vorhandenen `order`-Werte
        // müssen weder lückenlos noch überhaupt gesetzt sein.
        const lastOrder = Math.max(0, ...groups.map(g => g.order ?? 0));
        group = { name, paths: [], hidden: [], order: lastOrder + 1 };
        groups.push(group);
      } else {
        group = groups.find(g => g.name === groupPick.id)!;
      }

      // Über die normalisierte Form vergleichen, nicht als Zeichenkette: ältere
      // Einträge stehen noch in der prozentkodierten Schreibweise (%2B) und
      // meinen trotzdem denselben Ordner.
      const alreadyPresent = group.paths.some(p => {
        try {
          return formatUriForConfig(parseProjectPath(p)) === pathString;
        } catch {
          return p === pathString;
        }
      });

      if (alreadyPresent) {
        vscode.window.showInformationMessage(vscode.l10n.t('Wildcard Project Manager: “{0}” is already part of “{1}”.', folder.name, group.name));
        return;
      }

      group.paths.push(pathString);
      await writeGroups(context, groups);
      provider.refresh();
      vscode.window.showInformationMessage(vscode.l10n.t('Wildcard Project Manager: “{0}” added to “{1}”.', folder.name, group.name));
    }),

    vscode.commands.registerCommand('pathProjectManager.hideProject', async (node: ProjectNode | FolderNode) => {
      if (!node) {
        return;
      }
      const groups = await readGroupsForWrite(context);
      const group = groups?.find(g => g.name === node.group.name);
      if (!groups || !group) {
        return;
      }

      group.hidden ??= [];
      if (!group.hidden.includes(node.name)) {
        group.hidden.push(node.name);
        await writeGroups(context, groups);
        provider.refresh();
      }

      const choice = await vscode.window.showInformationMessage(
        vscode.l10n.t('Wildcard Project Manager: “{0}” hidden.', node.name),
        vscode.l10n.t('Undo')
      );
      if (choice !== vscode.l10n.t('Undo')) {
        return;
      }

      // Neu einlesen statt die alte Kopie zu benutzen: zwischen Ausblenden und
      // Klick auf „Rückgängig“ kann die Konfiguration sich geändert haben.
      const current = await readGroupsForWrite(context);
      const target = current?.find(g => g.name === node.group.name);
      if (!current || !target?.hidden) {
        return;
      }
      target.hidden = target.hidden.filter(h => h !== node.name);
      await writeGroups(context, current);
      provider.refresh();
    }),

    vscode.commands.registerCommand('pathProjectManager.showHidden', (node: GroupNode) => {
      if (node) {
        provider.setShowingHidden(node.group.name, true);
      }
    }),

    vscode.commands.registerCommand('pathProjectManager.hideHidden', (node: GroupNode) => {
      if (node) {
        provider.setShowingHidden(node.group.name, false);
      }
    }),

    vscode.commands.registerCommand('pathProjectManager.unhideProject', async (node: ProjectNode | FolderNode) => {
      if (!node) {
        return;
      }
      const groups = await readGroupsForWrite(context);
      const group = groups?.find(g => g.name === node.group.name);
      if (!groups || !group?.hidden) {
        return;
      }

      const before = group.hidden.length;
      group.hidden = group.hidden.filter(h => h !== node.name);
      if (group.hidden.length === before) {
        // Der Eintrag stammt aus einem Muster wie "test-*", nicht aus einem
        // Namen – das Muster zu löschen würde auch andere Projekte einblenden.
        vscode.window.showWarningMessage(
          vscode.l10n.t('Wildcard Project Manager: “{0}” is hidden by a pattern in “hidden”. Please adjust the pattern in the configuration.', node.name)
        );
        return;
      }

      // Ohne verbleibende Einträge verschwindet der Umschalter an der Gruppe –
      // dann darf der Anzeige-Zustand nicht stehen bleiben.
      if (group.hidden.length === 0) {
        provider.setShowingHidden(group.name, false);
      }
      await writeGroups(context, groups);
      provider.refresh();
    }),

    vscode.commands.registerCommand('pathProjectManager.find', async () => {
      const query = await vscode.window.showInputBox({
        prompt: vscode.l10n.t('Filter by name or path'),
        value: provider.filter,
        placeHolder: vscode.l10n.t('e.g. myremoteserver or path-project')
      });
      if (query === undefined) {
        return;
      }
      provider.setFilter(query);
      updateFilterContext();
    }),

    vscode.commands.registerCommand('pathProjectManager.clearFilter', () => {
      provider.clearFilter();
      updateFilterContext();
    }),

    vscode.commands.registerCommand('pathProjectManager.collapseGroupByDefault', (node: GroupNode) =>
      setGroupCollapsed(node, true)
    ),

    vscode.commands.registerCommand('pathProjectManager.expandGroupByDefault', (node: GroupNode) =>
      setGroupCollapsed(node, false)
    ),

    vscode.commands.registerCommand('pathProjectManager.customizeIcon', async (node: ProjectNode) => {
      if (!node) {
        return;
      }

      const groups = await readGroups(context);
      const group = groups.find(g => g.name === node.group.name);
      if (!group) {
        return;
      }
      const current = currentSettings(group, node.name);

      const iconPick = await pickCodicon(current, node.name);
      if (!iconPick) {
        return;
      }
      current['icon-image'] = iconPick.icon;

      await applySettings(node.group.name, node.name, current);
    }),

    vscode.commands.registerCommand('pathProjectManager.resetIcon', async (node: ProjectNode) => {
      if (!node) {
        return;
      }
      const groups = await readGroupsForWrite(context);
      const group = groups?.find(g => g.name === node.group.name);
      if (!groups || !group) {
        return;
      }

      if (!group.settings?.[node.name]) {
        warnAboutPattern(group, node.name);
        return;
      }

      delete group.settings[node.name];
      if (Object.keys(group.settings).length === 0) {
        delete group.settings;
      }
      await writeGroups(context, groups);
      provider.refresh();
    }),

    vscode.workspace.onDidSaveTextDocument(doc => {
      if (doc.uri.toString() === getConfigUri(context).toString()) {
        provider.refresh();
      }
    }),

    vscode.workspace.onDidChangeWorkspaceFolders(() => updateCurrentProject()),

    treeView.onDidChangeVisibility(() => void revealCurrentProjectOnce())
  );

  for (const { suffix, colorId } of COLOR_COMMANDS) {
    context.subscriptions.push(
      vscode.commands.registerCommand(`pathProjectManager.setColor${suffix}`, (node: ProjectNode) =>
        setIconColor(node, colorId)
      )
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('pathProjectManager.setColorMore', async (node: ProjectNode) => {
      if (!node) {
        return;
      }
      const groups = await readGroups(context);
      const group = groups.find(g => g.name === node.group.name);
      if (!group) {
        return;
      }
      const current = currentSettings(group, node.name);
      const previewIcon = current['icon-image'] || 'circle-filled';

      const picked = await vscode.window.showQuickPick(
        COLOR_PALETTE.map(entry => ({
          label: vscode.l10n.t(entry.label),
          description:
            entry.colorId === (current['icon-color'] ?? '') ? vscode.l10n.t('current') : entry.colorId || undefined,
          iconPath: new vscode.ThemeIcon(
            previewIcon,
            entry.colorId ? new vscode.ThemeColor(entry.colorId) : undefined
          ),
          colorId: entry.colorId
        })),
        { placeHolder: vscode.l10n.t('Color for “{0}” – shown as in the tree', node.name) }
      );
      if (!picked) {
        return;
      }
      current['icon-color'] = picked.colorId || undefined;
      await applySettings(node.group.name, node.name, current);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('pathProjectManager.setColorCustom', async (node: ProjectNode) => {
      if (!node) {
        return;
      }
      const groups = await readGroups(context);
      const group = groups.find(g => g.name === node.group.name);
      if (!group) {
        return;
      }
      const current = currentSettings(group, node.name);
      const typed = await vscode.window.showInputBox({
        prompt: vscode.l10n.t('Theme color ID (leave empty for the default color)'),
        value: current['icon-color'] ?? '',
        placeHolder: vscode.l10n.t('e.g. terminal.ansiBrightCyan or gitDecoration.modifiedResourceForeground')
      });
      if (typed === undefined) {
        return;
      }
      current['icon-color'] = typed.trim() || undefined;
      await applySettings(node.group.name, node.name, current);
    })
  );

  updateCurrentProject();
  updateFilterContext();
  void revealCurrentProjectOnce();
}

export function deactivate(): void {}
