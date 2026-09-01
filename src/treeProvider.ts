import * as vscode from 'vscode';
import { ProjectGroup, ProjectSettings, readGroups, readGroupsForWrite, writeGroups } from './config';
import { ProjectCache } from './projectCache';
import { ResolvedProject, ResolveResult, hasHardError, resolveGroup } from './projectResolver';
import { sameUri } from './uri';

// Interner Mime-Typ dieser View: "application/vnd.code.tree." + View-Id in
// Kleinbuchstaben. Nur damit erkennt VS Code das Ziehen innerhalb des Baums.
const TREE_MIME = 'application/vnd.code.tree.pathprojectmanagerview';

export class GroupNode {
  readonly kind = 'group' as const;
  constructor(public readonly group: ProjectGroup) {}
}

export class ProjectNode {
  readonly kind = 'project' as const;
  /** Der Aufklapper darüber, falls das Muster über mehrere Ebenen geht. */
  parent?: FolderNode;
  constructor(
    /** Voller Name inklusive der übergeordneten Ebenen – für Meldungen und `hidden`. */
    public readonly name: string,
    /** Was im Baum steht: bei mehreren Ebenen nur die unterste. */
    public readonly label: string,
    public readonly uri: vscode.Uri,
    public readonly group: ProjectGroup,
    public readonly hidden: boolean,
    public readonly settings?: ProjectSettings,
    /** Aus dem Cache angezeigt, weil der Pfad gerade nicht lesbar ist. */
    public readonly stale = false
  ) {}
}

/**
 * Eine Zwischenebene eines mehrstufigen Musters: bei "/var/www/*" + zweitem
 * Stern steht hier die Domain, darunter hängen ihre Unterverzeichnisse.
 *
 * Trägt `name` und `uri` wie ein Projekt, damit die vorhandenen Öffnen-Befehle
 * unverändert auch auf einem Aufklapper funktionieren.
 */
export class FolderNode {
  readonly kind = 'folder' as const;
  parent?: FolderNode;
  constructor(
    /** Der Weg ab der ersten Wildcard ("domain.com", tiefer "domain.com/shop") – Schlüssel für `hidden`. */
    public readonly name: string,
    /** Was im Baum steht: nur dieses eine Verzeichnis. */
    public readonly label: string,
    public readonly uri: vscode.Uri,
    public readonly group: ProjectGroup,
    /** Alles darunter ist ausgeblendet – dann ist es der Ordner auch. */
    public readonly hidden: boolean,
    public readonly children: (ProjectNode | FolderNode)[]
  ) {}
}

export class MessageNode {
  readonly kind = 'message' as const;
  constructor(
    public readonly text: string,
    public readonly command?: vscode.Command,
    public readonly isError = false
  ) {}
}

export type Node = GroupNode | FolderNode | ProjectNode | MessageNode;

const byOrder = (a: ProjectGroup, b: ProjectGroup): number => (a.order ?? 0) - (b.order ?? 0);

/** Das auf Ebene `depth` getroffene Verzeichnis eines Projekts. */
function folderUri(project: ResolvedProject, depth: number): vscode.Uri {
  const up = project.parts.length - 1 - depth;
  const segments = project.uri.path.split('/');
  return project.uri.with({ path: segments.slice(0, segments.length - up).join('/') || '/' });
}

/**
 * Aus der flachen Trefferliste den Baum bauen: Projekte aus einem Muster über
 * mehrere Ebenen hängen unter einem Aufklapper je übergeordnetem Verzeichnis.
 * Bei einstufigen Mustern hat jedes Projekt genau einen Namensteil – dann
 * kommt die Schleife nie in den Ordnerzweig und alles bleibt flach wie bisher.
 *
 * Die Reihenfolge folgt der bereits sortierten Liste: ein Aufklapper steht an
 * der Stelle seines ersten Treffers, seine Kinder in sich wieder sortiert.
 */
function buildNodes(
  projects: ResolvedProject[],
  group: ProjectGroup,
  depth: number
): (ProjectNode | FolderNode)[] {
  const buckets = new Map<string, ResolvedProject[]>();
  // Blätter und Ordnerschlüssel gemischt, damit die Reihenfolge erhalten bleibt.
  const slots: (ResolvedProject | string)[] = [];

  for (const project of projects) {
    if (project.parts.length <= depth + 1) {
      slots.push(project);
      continue;
    }
    const key = project.parts[depth];
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(project);
    } else {
      buckets.set(key, [project]);
      slots.push(key);
    }
  }

  return slots.map(slot => {
    if (typeof slot !== 'string') {
      return new ProjectNode(
        slot.name,
        slot.label,
        slot.uri,
        group,
        slot.hidden,
        slot.settings,
        slot.stale
      );
    }
    const bucket = buckets.get(slot)!;
    const children = buildNodes(bucket, group, depth + 1);
    const folder = new FolderNode(
      bucket[0].parts.slice(0, depth + 1).join('/'),
      slot,
      folderUri(bucket[0], depth),
      group,
      bucket.every(project => project.hidden),
      children
    );
    for (const child of children) {
      child.parent = folder;
    }
    return folder;
  });
}

/** Den Projektknoten zu einer Uri im fertigen Baum suchen – samt Elternkette. */
function findNode(
  nodes: (ProjectNode | FolderNode)[],
  uri: vscode.Uri
): ProjectNode | undefined {
  for (const node of nodes) {
    const hit =
      node.kind === 'project'
        ? sameUri(node.uri, uri)
          ? node
          : undefined
        : findNode(node.children, uri);
    if (hit) {
      return hit;
    }
  }
  return undefined;
}

// Wartezeiten der automatischen Nachfassversuche nach dem Start.
const RETRY_DELAYS = [1000, 3000, 6000, 10000];

function resolveIcon(node: ProjectNode): vscode.ThemeIcon {
  const settings = node.settings;
  const iconId = settings?.['icon-image'] || (node.uri.scheme === 'file' ? 'folder' : 'remote-explorer');
  const colorId = settings?.['icon-color'] ?? (node.hidden ? 'disabledForeground' : undefined);
  return new vscode.ThemeIcon(iconId, colorId ? new vscode.ThemeColor(colorId) : undefined);
}

function matchesFilter(name: string, uri: vscode.Uri, query: string): boolean {
  const haystack = `${name} ${uri.toString(true)}`.toLowerCase();
  return haystack.includes(query);
}

export class PathProjectManagerProvider
  implements vscode.TreeDataProvider<Node>, vscode.TreeDragAndDropController<Node>
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<Node | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  readonly dragMimeTypes = [TREE_MIME];
  readonly dropMimeTypes = [TREE_MIME];

  private filterQuery = '';

  /**
   * Gruppen, die ihre ausgeblendeten Projekte gerade mit anzeigen. Bewusst nur
   * für die Sitzung und nicht in der Konfiguration: das ist ein Blick in die
   * Ablage, keine dauerhafte Einstellung.
   */
  private readonly showingHidden = new Set<string>();

  private readonly cache: ProjectCache;

  /**
   * Laufende Auflösungen je Gruppe. Die Nachladeversuche und ein Klick auf
   * Aktualisieren würden sonst mehrere Durchläufe gleichzeitig starten, die
   * alle auf dieselbe nicht erreichbare Verbindung warten.
   */
  private readonly inFlight = new Map<string, Promise<ResolveResult>>();

  constructor(private readonly context: vscode.ExtensionContext) {
    this.cache = new ProjectCache(context);
  }

  refresh(): void {
    // Jeder von außen ausgelöste Aufbau (Aktualisieren, Filter, gespeicherte
    // Konfiguration) gibt die Nachladeversuche wieder frei …
    this.retries.clear();
    this.clearRetryTimers();
    // … und verwirft laufende Auflösungen: die arbeiten noch mit der
    // Konfiguration von vor dieser Änderung.
    this.inFlight.clear();
    this._onDidChangeTreeData.fire();
  }

  dispose(): void {
    this.clearRetryTimers();
    this._onDidChangeTreeData.dispose();
  }

  private resolve(group: ProjectGroup): Promise<ResolveResult> {
    const running = this.inFlight.get(group.name);
    if (running) {
      return running;
    }
    // Beim Aufräumen prüfen, ob der Eintrag noch der eigene ist: refresh() leert
    // die Karte zwischendurch, und dann gehört der Platz schon dem Nachfolger.
    const pending: Promise<ResolveResult> = resolveGroup(group, this.cache).finally(() => {
      if (this.inFlight.get(group.name) === pending) {
        this.inFlight.delete(group.name);
      }
    });
    this.inFlight.set(group.name, pending);
    return pending;
  }

  get filter(): string {
    return this.filterQuery;
  }

  setFilter(query: string): void {
    this.filterQuery = query.trim().toLowerCase();
    this.refresh();
  }

  clearFilter(): void {
    this.filterQuery = '';
    this.refresh();
  }

  /**
   * Verbrauchte Nachladeversuche je Gruppe. Direkt nach dem Start ist eine
   * Remote-Verbindung häufig noch nicht bereit, dann scheitert readDirectory
   * für jeden Pfad – statt den Nutzer auf „Aktualisieren“ zu schicken, fasst
   * die Ansicht von selbst nach.
   *
   * Bewusst je Gruppe: ein gemeinsamer Zähler wurde von jeder fehlerfreien
   * Gruppe zurückgesetzt, womit eine dauerhaft nicht erreichbare Gruppe
   * daneben endlos im Sekundentakt weiter nachlud.
   */
  private readonly retries = new Map<string, number>();

  /** Laufende Nachladeversuche, damit sie nicht überlappen und nicht die Sitzung überleben. */
  private readonly retryTimers = new Map<string, NodeJS.Timeout>();

  private scheduleRetry(groupName: string): void {
    // Mehrere Anlaeufe: eine SSH-Verbindung braucht beim Kaltstart auch mal
    // laenger als einen einzelnen Nachfassversuch.
    const attempt = this.retries.get(groupName) ?? 0;
    const delay = RETRY_DELAYS[attempt];
    if (delay === undefined) {
      return;
    }
    // Je Gruppe genügt ein wartender Versuch. VS Code fragt die Kinder einer
    // Gruppe durchaus mehrfach ab; ohne das hier lägen mehrere Timer parallel.
    if (this.retryTimers.has(groupName)) {
      return;
    }

    // Hochgezählt wird erst beim tatsächlichen Nachfassen. Zählte schon der
    // beobachtete Fehler, wären zwei Abfragen kurz hintereinander gleich zwei
    // verbrauchte Stufen – von den vier Versuchen bliebe die Hälfte.
    // Bewusst nicht über refresh(): das würde die Zähler leeren und die
    // Versuche damit endlos von vorn beginnen lassen.
    this.retryTimers.set(
      groupName,
      setTimeout(() => {
        this.retryTimers.delete(groupName);
        this.retries.set(groupName, attempt + 1);
        this._onDidChangeTreeData.fire();
      }, delay)
    );
  }

  private clearRetryTimers(): void {
    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();
  }

  setShowingHidden(groupName: string, showing: boolean): void {
    if (showing) {
      this.showingHidden.add(groupName);
    } else {
      this.showingHidden.delete(groupName);
    }
    this.refresh();
  }

  private isShowingHidden(group: ProjectGroup): boolean {
    return this.showingHidden.has(group.name);
  }

  getTreeItem(node: Node): vscode.TreeItem {
    if (node.kind === 'group') {
      // Bei aktivem Filter immer aufklappen, sonst blieben die Treffer unsichtbar.
      const collapsed = !!node.group.collapsed && !this.filterQuery;
      const item = new vscode.TreeItem(
        node.group.name,
        collapsed
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.Expanded
      );
      item.iconPath = new vscode.ThemeIcon('server-environment');

      // Der contextValue trägt beide Zustände, weil die Menüeinträge in
      // package.json getrennt darauf reagieren (per "viewItem =~ /…/").
      // "keine versteckten Einträge" heißt: der Umschalter entfällt ganz.
      const collapsedToken = node.group.collapsed ? 'collapsed' : 'expanded';
      const showing = this.isShowingHidden(node.group);
      const hiddenToken = (node.group.hidden ?? []).length === 0
        ? 'noHidden'
        : showing
          ? 'hiddenShown'
          : 'hiddenHidden';
      item.contextValue = `group-${collapsedToken}-${hiddenToken}`;

      // Inline-Buttons zeigt VS Code nur bei Hover. Damit der aktive Zustand
      // trotzdem dauerhaft sichtbar ist, steht er als Beschriftung daneben.
      if (showing && hiddenToken === 'hiddenShown') {
        item.description = vscode.l10n.t('showing hidden');
      }

      // Bewusst ohne item.id: VS Code würde den Auf-/Zuklapp-Zustand dann selbst
      // merken und das Feld "collapsed" aus der Konfiguration überstimmen.
      return item;
    }

    if (node.kind === 'folder') {
      // Bei aktivem Filter offen, sonst zu: bei dreißig Domains will niemand
      // beim Öffnen der Seitenleiste alle Unterverzeichnisse auf einmal sehen.
      const item = new vscode.TreeItem(
        node.label,
        this.filterQuery
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed
      );
      // Eigenes Präfix: derselbe Ordner kann in derselben Gruppe zusätzlich als
      // Projekt vorkommen, wenn ein zweiter Pfad ihn direkt trifft.
      item.id = `folder ${node.group.name} ${node.uri.toString()}`;
      item.contextValue = node.hidden ? 'folderHidden' : 'folder';
      item.iconPath = new vscode.ThemeIcon(
        'folder',
        node.hidden ? new vscode.ThemeColor('disabledForeground') : undefined
      );
      if (node.hidden) {
        item.description = vscode.l10n.t('hidden');
      }
      item.tooltip = node.uri.toString(true);
      // Bewusst ohne item.command: der Knoten hat einen Aufklapp-Pfeil, und ein
      // Klick soll eindeutig auf- und zuklappen. Öffnen geht über das Kontextmenü.
      return item;
    }

    if (node.kind === 'project') {
      const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
      // Stabile Id, damit treeView.reveal() den Eintrag wiederfindet.
      item.id = `${node.group.name} ${node.uri.toString()}`;
      item.contextValue = node.hidden ? 'projectHidden' : 'project';
      item.resourceUri = node.uri;
      item.iconPath = resolveIcon(node);

      const notes: string[] = [];
      if (node.hidden) {
        notes.push(vscode.l10n.t('hidden'));
      }
      if (node.stale) {
        notes.push(vscode.l10n.t('from cache'));
      }
      item.description = notes.join(' · ') || undefined;
      item.tooltip = node.stale
        ? `${node.uri.toString(true)}\n\n${vscode.l10n.t('Last known state – the path is currently unreadable.')}`
        : node.uri.toString(true);
      item.command = {
        command: 'pathProjectManager.openInCurrentWindow',
        title: vscode.l10n.t('Open Project'),
        arguments: [node]
      };
      return item;
    }

    const item = new vscode.TreeItem(node.text, vscode.TreeItemCollapsibleState.None);
    item.contextValue = node.isError ? 'error' : 'message';
    item.iconPath = new vscode.ThemeIcon(node.isError ? 'warning' : 'info');
    if (node.command) {
      item.command = node.command;
    }
    return item;
  }

  getParent(node: Node): Node | undefined {
    if (node.kind !== 'project' && node.kind !== 'folder') {
      return undefined;
    }
    return node.parent ?? new GroupNode(node.group);
  }

  async getChildren(node?: Node): Promise<Node[]> {
    // Ein abgelehntes Promise laesst VS Code den Baum leer und kommentarlos
    // rendern. Lieber den Fehler als anklickbare Zeile zeigen.
    try {
      return await this.buildChildren(node);
    } catch (err: any) {
      return [
        new MessageNode(
          `⚠ ${err?.message ?? err}`,
          { command: 'pathProjectManager.refresh', title: vscode.l10n.t('Try again') },
          true
        )
      ];
    }
  }

  private async buildChildren(node?: Node): Promise<Node[]> {
    if (!node) {
      const groups = await readGroups(this.context);
      if (groups.length === 0) {
        return [
          new MessageNode(vscode.l10n.t('No configuration found – click to create one'), {
            command: 'pathProjectManager.openConfig',
            title: vscode.l10n.t('Open Configuration')
          })
        ];
      }

      const sorted = [...groups].sort(byOrder);

      if (!this.filterQuery) {
        return sorted.map(g => new GroupNode(g));
      }

      // Parallel, nicht nacheinander: sonst summieren sich die Zeitlimits nicht
      // erreichbarer Gruppen auf und der ganze Baum bleibt so lange leer.
      const resolved = await Promise.all(sorted.map(g => this.resolve(g)));

      // Eine Gruppe, die gerade nicht erreichbar ist, fällt mangels Treffern aus
      // dem gefilterten Baum – und ihre eigene getChildren läuft dann nie, die
      // also auch nicht nachfassen würde. Deshalb hier.
      sorted.forEach((g, i) => {
        if (hasHardError(resolved[i].errors)) {
          this.scheduleRetry(g.name);
        }
      });

      const matchingGroups = sorted
        .filter((g, i) => {
          const visible = resolved[i].projects.filter(p => !p.hidden || this.isShowingHidden(g));
          return (
            g.name.toLowerCase().includes(this.filterQuery) ||
            visible.some(p => matchesFilter(p.name, p.uri, this.filterQuery))
          );
        })
        .map(g => new GroupNode(g));

      if (matchingGroups.length === 0) {
        return [new MessageNode(vscode.l10n.t('No matches for “{0}”', this.filterQuery))];
      }
      return matchingGroups;
    }

    if (node.kind === 'group') {
      const { projects, errors } = await this.resolve(node.group);
      const showing = this.isShowingHidden(node.group);

      let filtered = projects.filter(p => !p.hidden || showing);
      const groupNameMatches = this.filterQuery && node.group.name.toLowerCase().includes(this.filterQuery);
      if (this.filterQuery && !groupNameMatches) {
        filtered = filtered.filter(p => matchesFilter(p.name, p.uri, this.filterQuery));
      }

      const items: Node[] = buildNodes(filtered, node.group, 0);
      if (hasHardError(errors)) {
        this.scheduleRetry(node.group.name);
      } else {
        this.retries.delete(node.group.name);
      }

      if (!this.filterQuery) {
        for (const e of errors) {
          items.push(new MessageNode(`⚠ ${e.path}: ${e.message}`, undefined, true));
        }
      }
      if (items.length === 0) {
        items.push(new MessageNode(vscode.l10n.t('No projects found')));
      }
      return items;
    }

    if (node.kind === 'folder') {
      return node.children;
    }

    return [];
  }

  /** Den Baumknoten zu einem geöffneten Ordner suchen, für treeView.reveal(). */
  async findProject(uri: vscode.Uri): Promise<ProjectNode | undefined> {
    const groups = [...(await readGroups(this.context))].sort(byOrder);
    const resolved = await Promise.all(groups.map(g => this.resolve(g)));
    for (const [i, group] of groups.entries()) {
      // Bewusst über den gebauten Baum und nicht über die flache Liste: nur so
      // hängt am Treffer die Elternkette, die treeView.reveal() braucht, um den
      // Aufklapper darüber zu öffnen.
      const visible = resolved[i].projects.filter(p => !p.hidden || this.isShowingHidden(group));
      const hit = findNode(buildNodes(visible, group, 0), uri);
      if (hit) {
        return hit;
      }
    }
    return undefined;
  }

  handleDrag(source: readonly Node[], dataTransfer: vscode.DataTransfer): void {
    // Nur Gruppen sind sortierbar – Projekte ergeben sich aus den Pfad-Mustern.
    const names = source.filter((n): n is GroupNode => n.kind === 'group').map(n => n.group.name);
    if (names.length > 0) {
      dataTransfer.set(TREE_MIME, new vscode.DataTransferItem(names));
    }
  }

  async handleDrop(target: Node | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
    const names = dataTransfer.get(TREE_MIME)?.value as string[] | undefined;
    if (!names || names.length === 0) {
      return;
    }

    // Abwurf auf ein Projekt zählt als Abwurf auf dessen Gruppe, auf leere
    // Fläche als "ans Ende".
    const targetName = target && target.kind !== 'message' ? target.group.name : undefined;
    if (targetName && names.includes(targetName)) {
      return;
    }

    const groups = await readGroupsForWrite(this.context);
    if (!groups) {
      return;
    }
    groups.sort(byOrder);
    const moving = groups.filter(g => names.includes(g.name));
    const rest = groups.filter(g => !names.includes(g.name));
    if (moving.length === 0) {
      return;
    }

    const insertAt = targetName ? rest.findIndex(g => g.name === targetName) : -1;
    rest.splice(insertAt < 0 ? rest.length : insertAt, 0, ...moving);
    rest.forEach((g, i) => {
      g.order = i + 1;
    });

    await writeGroups(this.context, rest);
    this.refresh();
  }
}
