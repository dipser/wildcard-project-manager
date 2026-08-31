import * as vscode from 'vscode';

/**
 * Einstellungen eines einzelnen Projekts innerhalb einer Gruppe. Die Namen mit
 * Bindestrich sind bewusst so gewählt: sie stehen genau so in der
 * Konfigurationsdatei und sollen dort selbsterklärend sein.
 */
export interface ProjectSettings {
  /** Codicon-ID, z. B. "server" – leer bedeutet Standard-Icon. */
  'icon-image'?: string;
  /** Theme-Farb-Id, z. B. "charts.red" – leer bedeutet Standardfarbe. */
  'icon-color'?: string;
}

export interface ProjectGroup {
  name: string;
  paths: string[];
  hidden?: string[];
  order?: number;
  collapsed?: boolean;
  settings?: Record<string, ProjectSettings>;
}

const CONFIG_FILE_NAME = 'projects.json';

/** Startinhalt bei der Erstinstallation: bewusst keine Beispielgruppen, damit
 * niemand mit Pfaden startet, die es auf seinem Rechner nicht gibt. */
const DEFAULT_CONTENT = '[]\n';

export function getConfigUri(context: vscode.ExtensionContext): vscode.Uri {
  return vscode.Uri.joinPath(context.globalStorageUri, CONFIG_FILE_NAME);
}

export async function ensureConfigFile(context: vscode.ExtensionContext): Promise<vscode.Uri> {
  const uri = getConfigUri(context);
  try {
    await vscode.workspace.fs.stat(uri);
  } catch {
    await vscode.workspace.fs.createDirectory(context.globalStorageUri);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(DEFAULT_CONTENT, 'utf8'));
  }
  return uri;
}

export async function writeGroups(context: vscode.ExtensionContext, groups: ProjectGroup[]): Promise<void> {
  const uri = getConfigUri(context);
  await vscode.workspace.fs.createDirectory(context.globalStorageUri);
  const content = Buffer.from(JSON.stringify(groups, null, 2), 'utf8');
  await vscode.workspace.fs.writeFile(uri, content);
}

async function loadGroups(context: vscode.ExtensionContext): Promise<ProjectGroup[]> {
  // Das Anlegen gehört mit in die Fehlerbehandlung der Aufrufer: schlägt schon
  // das fehl, darf das nicht als abgelehntes Promise bei getChildren landen –
  // VS Code zeigt dann einen leeren Baum ganz ohne Hinweis.
  const uri = await ensureConfigFile(context);
  const raw = await vscode.workspace.fs.readFile(uri);
  const text = Buffer.from(raw).toString('utf8');
  const data = JSON.parse(text);
  if (!Array.isArray(data)) {
    throw new Error(vscode.l10n.t('Configuration must be an array of groups.'));
  }
  return data as ProjectGroup[];
}

function reportReadError(err: any): void {
  vscode.window.showErrorMessage(
    vscode.l10n.t('Wildcard Project Manager: Error reading the configuration – {0}', err?.message ?? err)
  );
}

/** Zum Anzeigen: ein Lesefehler bedeutet „nichts zu zeigen“. */
export async function readGroups(context: vscode.ExtensionContext): Promise<ProjectGroup[]> {
  try {
    return await loadGroups(context);
  } catch (err: any) {
    reportReadError(err);
    return [];
  }
}

/**
 * Zum Ändern: `undefined` statt einer leeren Liste, wenn die Datei nicht lesbar
 * ist. Wer auf einer leeren Liste weiterarbeitet und sie zurückschreibt, wirft
 * eine vorhandene, nur gerade kaputte Konfiguration endgültig weg.
 */
export async function readGroupsForWrite(
  context: vscode.ExtensionContext
): Promise<ProjectGroup[] | undefined> {
  try {
    return await loadGroups(context);
  } catch (err: any) {
    reportReadError(err);
    return undefined;
  }
}
