import * as vscode from 'vscode';
import { ProjectGroup, ProjectSettings } from './config';
import { globMatch } from './glob';
import { ProjectCache } from './projectCache';
import { parseProjectPath } from './uri';

export interface ResolvedProject {
  name: string;
  uri: vscode.Uri;
  /** Trifft auf ein Muster aus `hidden` zu – wird nur auf Wunsch angezeigt. */
  hidden: boolean;
  /** Stammt aus dem Cache, weil der Pfad gerade nicht lesbar ist. */
  stale?: boolean;
  settings?: ProjectSettings;
}

/**
 * Die wirksamen Einstellungen eines Projekts: erst der exakte Name, danach die
 * Muster-Schlüssel wie "test-*".
 */
export function findSettings(
  settings: Record<string, ProjectSettings> | undefined,
  name: string
): ProjectSettings | undefined {
  if (!settings) {
    return undefined;
  }
  if (settings[name]) {
    return settings[name];
  }
  for (const [pattern, entry] of Object.entries(settings)) {
    if (globMatch(pattern, name)) {
      return entry;
    }
  }
  return undefined;
}

const READ_TIMEOUT_MS = 3000;

/**
 * readDirectory auf einem Remote-Pfad wirft nicht, wenn die Verbindung noch
 * nicht steht – es antwortet schlicht nie. Ohne Zeitlimit bleibt die Gruppe
 * dann dauerhaft ohne jede Zeile stehen, weil das Promise offen ist. Mit dem
 * Limit wird daraus ein Fehler, auf den die Ansicht reagieren kann.
 *
 * Bewusst knapp bemessen: solange es läuft, steht die Gruppe leer da. Lieber
 * nach drei Sekunden den Cache zeigen und im Hintergrund weiter nachladen.
 */
async function readDirectoryWithTimeout(
  uri: vscode.Uri
): Promise<[string, vscode.FileType][]> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      vscode.workspace.fs.readDirectory(uri),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                vscode.l10n.t('No response after {0} s – remote connection not ready yet?', READ_TIMEOUT_MS / 1000)
              )
            ),
          READ_TIMEOUT_MS
        );
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export interface ResolveError {
  path: string;
  message: string;
}

export interface ResolveResult {
  projects: ResolvedProject[];
  errors: ResolveError[];
}

/** Alle Projekte eines einzelnen Konfigurationspfads – mit oder ohne Platzhalter. */
async function readPath(rawPath: string): Promise<{ name: string; uri: vscode.Uri }[]> {
  const uri = parseProjectPath(rawPath);
  const path = uri.path.replace(/\/+$/, '');
  const idx = path.lastIndexOf('/');
  const dirPath = idx >= 0 ? path.substring(0, idx) || '/' : '/';
  const lastSeg = idx >= 0 ? path.substring(idx + 1) : path;

  if (!lastSeg.includes('*') && !lastSeg.includes('?')) {
    return [{ name: lastSeg || uri.authority || rawPath, uri }];
  }

  const dirUri = uri.with({ path: dirPath });
  const entries = await readDirectoryWithTimeout(dirUri);
  return entries
    .filter(([name, type]) => (type & vscode.FileType.Directory) !== 0 && globMatch(lastSeg, name))
    .map(([name]) => ({ name, uri: vscode.Uri.joinPath(dirUri, name) }));
}

export async function resolveGroup(
  group: ProjectGroup,
  cache?: ProjectCache
): Promise<ResolveResult> {
  const projects: ResolvedProject[] = [];
  const errors: ResolveError[] = [];
  const hidden = group.hidden ?? [];
  // Überlappende Muster (z. B. "/var/www/*" und "/var/www/shop") würden denselben
  // Ordner zweimal liefern – im Baum sind doppelte Einträge nicht nur unschön,
  // sondern kollidieren auch mit der TreeItem-Id.
  const seen = new Set<string>();

  const add = (name: string, uri: vscode.Uri, stale?: boolean): void => {
    const key = uri.toString();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    projects.push({
      name,
      uri,
      hidden: hidden.some(h => globMatch(h, name)),
      stale,
      settings: findSettings(group.settings, name)
    });
  };

  // Bewusst alle Pfade gleichzeitig: nacheinander summieren sich die Zeitlimits
  // einer Gruppe auf (zwei nicht erreichbare Remote-Pfade = doppelte Wartezeit),
  // und so lange bleibt die Gruppe ohne jede Zeile stehen.
  type PathResult = { rawPath: string; found?: { name: string; uri: vscode.Uri }[]; message?: string };
  const results = await Promise.all<PathResult>(
    (group.paths ?? []).map(async rawPath => {
      try {
        return { rawPath, found: await readPath(rawPath) };
      } catch (err: any) {
        return { rawPath, message: err?.message ?? String(err) };
      }
    })
  );

  // Auswerten in der Reihenfolge der Konfiguration, damit bei überlappenden
  // Mustern immer derselbe Pfad gewinnt – unabhängig davon, wer zuerst fertig war.
  for (const result of results) {
    if (result.message !== undefined) {
      errors.push({ path: result.rawPath, message: result.message });
      continue;
    }
    for (const { name, uri } of result.found ?? []) {
      add(name, uri);
    }
  }

  if (cache) {
    if (errors.length === 0) {
      await cache.set(
        group.name,
        projects.map(p => ({ name: p.name, uri: p.uri.toString() }))
      );
    } else {
      // Nur ergänzen, nicht ersetzen: schlägt einer von mehreren Pfaden fehl,
      // bleiben die frisch geladenen Projekte die aktuelleren.
      for (const cached of await cache.get(group.name)) {
        add(cached.name, vscode.Uri.parse(cached.uri), true);
      }
    }
  }

  // Versteckte ans Ende, damit die gewohnte Reihenfolge beim Einblenden gleich
  // bleibt. Innerhalb dessen natürlich sortiert: "projekt-2" vor "projekt-10".
  projects.sort(
    (a, b) =>
      Number(a.hidden) - Number(b.hidden) ||
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );
  return { projects, errors };
}
