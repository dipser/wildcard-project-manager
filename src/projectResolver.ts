import * as vscode from 'vscode';
import { ProjectGroup, ProjectSettings } from './config';
import { globMatch } from './glob';
import { ProjectCache } from './projectCache';
import { parseProjectPath } from './uri';

export interface ResolvedProject {
  /**
   * Der volle Name inklusive der übergeordneten Ebenen
   * ("domain.com/sub.domain.com") – Schlüssel für `hidden` und `settings`,
   * und damit auch dann eindeutig, wenn zwei Domains dieselbe Unterseite haben.
   */
  name: string;
  /** Was im Baum steht: bei mehreren Ebenen nur die unterste. */
  label: string;
  /** Die vom Muster getroffenen Verzeichnisnamen, von oben nach unten. */
  parts: string[];
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
  /**
   * Ein einzelner nicht lesbarer Unterordner. Die übrigen Zweige sind deswegen
   * nicht weniger aktuell – so ein Fehler darf also weder den Cache blockieren
   * noch die Nachladeversuche auslösen.
   */
  soft?: boolean;
}

export interface ResolveResult {
  projects: ResolvedProject[];
  errors: ResolveError[];
}

/** Ob die Gruppe wirklich nicht geladen werden konnte – siehe `soft`. */
export function hasHardError(errors: ResolveError[]): boolean {
  return errors.some(e => !e.soft);
}

/** Höchstens so viele Verzeichnisse gleichzeitig lesen. */
const READ_CONCURRENCY = 8;

/**
 * Wie `Promise.all`, aber mit Obergrenze. Ein Muster über zwei Platzhalter-
 * Ebenen liest auf einem Server mit hundert Domains sonst hundert Verzeichnisse
 * gleichzeitig – die drängeln sich alle durch dieselbe SSH-Verbindung und laufen
 * dann reihenweise in das Zeitlimit, obwohl gar nichts kaputt ist.
 */
async function mapLimit<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(READ_CONCURRENCY, items.length) }, () => worker())
  );
  return results;
}

/**
 * Trennt die Ebenen im Namen, wenn ein Muster über mehrere Ebenen geht.
 *
 * Bewusst der Schrägstrich und kein Zierzeichen: der Name ist der Schlüssel für
 * `hidden` und `settings`, und als solcher pfadförmig. Ein Trenner wie " - "
 * käme irgendwann auch in einem echten Ordnernamen vor und wäre dort nicht mehr
 * von einer Ebenengrenze zu unterscheiden.
 */
const NAME_SEPARATOR = '/';

interface FoundProject {
  name: string;
  /** Die getroffenen Verzeichnisnamen, von oben nach unten. */
  parts: string[];
  uri: vscode.Uri;
}

interface PathResult {
  found: FoundProject[];
  /** Anzahl der Unterordner, die sich nicht lesen ließen. */
  unreadable: number;
}

/**
 * Alle Projekte eines einzelnen Konfigurationspfads – mit oder ohne Platzhalter.
 *
 * Platzhalter dürfen in jedem Segment stehen. Der Pfad wird dazu ab dem ersten
 * Platzhalter Ebene für Ebene abgelaufen: jedes überlebende Verzeichnis wird
 * gelesen und sein Inhalt gegen das nächste Segment gefiltert. Literale Segmente
 * sind dabei nichts anderes als Muster, die genau einen Namen treffen – deshalb
 * braucht ein Pfad wie "Stern, dann httpdocs" keinen Sonderfall, und ob es den
 * Ordner überhaupt gibt, beantwortet dieselbe Auflistung gleich mit.
 *
 * Der Name ist der Weg unterhalb des letzten festen Verzeichnisses. Bei einer
 * Ebene bleibt das der Ordnername wie bisher, bei zweien wird daraus
 * "domain.com/subdomain.domain.com".
 */
async function readPath(rawPath: string): Promise<PathResult> {
  const uri = parseProjectPath(rawPath);
  const path = uri.path.replace(/\/+$/, '');
  const segments = path.split('/');
  const firstPattern = segments.findIndex(seg => seg.includes('*'));

  if (firstPattern < 0) {
    const name = segments[segments.length - 1] || uri.authority || rawPath;
    return { found: [{ name, parts: [name], uri }], unreadable: 0 };
  }

  const baseUri = uri.with({ path: segments.slice(0, firstPattern).join('/') || '/' });
  let level = [{ uri: baseUri, parts: [] as string[] }];
  let unreadable = 0;

  for (const [depth, pattern] of segments.slice(firstPattern).entries()) {
    const listings = await mapLimit(level, async dir => {
      try {
        return await readDirectoryWithTimeout(dir.uri);
      } catch (err) {
        // Das feste Basisverzeichnis ist die Probe aufs Exempel: geht das nicht,
        // stimmt der Pfad nicht oder die Verbindung steht nicht – das gehört als
        // Fehler an die Gruppe. Weiter unten ist ein nicht lesbarer Ordner
        // dagegen ein Normalfall (auf Plesk gehören etliche davon root), der die
        // übrigen Domains nicht mit in den Fehlerzustand ziehen darf.
        if (depth === 0) {
          throw err;
        }
        unreadable++;
        return [];
      }
    });

    level = level.flatMap((dir, i) =>
      listings[i]
        .filter(([name, type]) => (type & vscode.FileType.Directory) !== 0 && globMatch(pattern, name))
        .map(([name]) => ({ uri: vscode.Uri.joinPath(dir.uri, name), parts: [...dir.parts, name] }))
    );
  }

  return {
    found: level.map(dir => ({
      name: dir.parts.join(NAME_SEPARATOR),
      parts: dir.parts,
      uri: dir.uri
    })),
    unreadable
  };
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

  const add = (name: string, parts: string[], uri: vscode.Uri, stale?: boolean): void => {
    const key = uri.toString();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    // Ein Muster darf jede Ebene meinen, nicht nur die unterste: "domain.com"
    // blendet die ganze Domain aus, "domain.com/logs" genau einen Eintrag, und
    // das kürzere "logs" alle gleichnamigen unter jeder Domain.
    const label = parts[parts.length - 1] ?? name;
    const keys = parts.map((_, i) => parts.slice(0, i + 1).join(NAME_SEPARATOR));
    keys.push(label);
    projects.push({
      name,
      label,
      parts,
      uri,
      hidden: hidden.some(h => keys.some(key => globMatch(h, key))),
      stale,
      settings: findSettings(group.settings, name) ?? findSettings(group.settings, label)
    });
  };

  // Bewusst alle Pfade gleichzeitig: nacheinander summieren sich die Zeitlimits
  // einer Gruppe auf (zwei nicht erreichbare Remote-Pfade = doppelte Wartezeit),
  // und so lange bleibt die Gruppe ohne jede Zeile stehen.
  type Result = { rawPath: string; result?: PathResult; message?: string };
  const results = await Promise.all<Result>(
    (group.paths ?? []).map(async rawPath => {
      try {
        return { rawPath, result: await readPath(rawPath) };
      } catch (err: any) {
        return { rawPath, message: err?.message ?? String(err) };
      }
    })
  );

  // Auswerten in der Reihenfolge der Konfiguration, damit bei überlappenden
  // Mustern immer derselbe Pfad gewinnt – unabhängig davon, wer zuerst fertig war.
  for (const { rawPath, result, message } of results) {
    if (message !== undefined) {
      errors.push({ path: rawPath, message });
      continue;
    }
    if (result && result.unreadable > 0) {
      errors.push({
        path: rawPath,
        message: vscode.l10n.t('{0} subfolders could not be read and were skipped.', result.unreadable),
        soft: true
      });
    }
    for (const { name, parts, uri } of result?.found ?? []) {
      add(name, parts, uri);
    }
  }

  if (cache) {
    if (!hasHardError(errors)) {
      await cache.set(
        group.name,
        projects.map(p => ({ name: p.name, parts: p.parts, uri: p.uri.toString() }))
      );
    } else {
      // Nur ergänzen, nicht ersetzen: schlägt einer von mehreren Pfaden fehl,
      // bleiben die frisch geladenen Projekte die aktuelleren.
      for (const cached of await cache.get(group.name)) {
        add(cached.name, cached.parts ?? [cached.name], vscode.Uri.parse(cached.uri), true);
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
