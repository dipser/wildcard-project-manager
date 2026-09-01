import * as vscode from 'vscode';

const CACHE_FILE_NAME = 'projects-cache.json';

/** Ein zwischengespeichertes Projekt: mehr als Name und Uri wird nicht gebraucht. */
export interface CachedProject {
  name: string;
  uri: string;
  /**
   * Die Ebenen des Namens, damit der Baum auch aus dem Cache seine Form behält.
   * Optional: Einträge aus einer älteren Fassung haben das Feld nicht und
   * landen dann flach auf oberster Ebene.
   */
  parts?: string[];
}

type CacheData = Record<string, CachedProject[]>;

/**
 * Merkt sich je Gruppe die zuletzt fehlerfrei geladene Projektliste.
 *
 * Sinn der Sache: Eine Remote-Verbindung steht beim Start oft noch nicht, und
 * eine leere Gruppe mit Fehlermeldung ist deutlich weniger wert als die Liste
 * von gestern.
 *
 * Bewusst als Datei neben `projects.json` und nicht im `globalState`: dort ist
 * der Cache einsehbar, kopierbar und im Zweifel einfach löschbar.
 *
 * Bewusst nur Name und Uri: `hidden` und die Icon-Einstellungen kommen aus der
 * Konfiguration und werden beim Anzeigen frisch angewendet, damit ein Cache-
 * Eintrag nie eine veraltete Einstellung überlebt.
 */
export class ProjectCache {
  /**
   * Der Inhalt der Datei, einmal je Sitzung gelesen. Ohne diese Kopie würden
   * zwei Gruppen, die gleichzeitig fertig laden, sich gegenseitig überschreiben.
   *
   * Bewusst das Promise und nicht sein Ergebnis: sonst lesen zwei gleichzeitig
   * startende Gruppen die Datei jede für sich, arbeiten auf getrennten Objekten
   * und der zweite Schreibvorgang wirft den Eintrag des ersten weg.
   */
  private data: Promise<CacheData> | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

  get uri(): vscode.Uri {
    return vscode.Uri.joinPath(this.context.globalStorageUri, CACHE_FILE_NAME);
  }

  async get(groupName: string): Promise<CachedProject[]> {
    return (await this.load())[groupName] ?? [];
  }

  async set(groupName: string, projects: CachedProject[]): Promise<void> {
    const data = await this.load();
    data[groupName] = projects;
    try {
      await vscode.workspace.fs.createDirectory(this.context.globalStorageUri);
      await vscode.workspace.fs.writeFile(
        this.uri,
        Buffer.from(JSON.stringify(data, null, 2), 'utf8')
      );
    } catch {
      // Ein nicht schreibbarer Cache ist ärgerlich, aber kein Grund, die
      // Projektliste mit einer Fehlermeldung zu überschreiben.
    }
  }

  private load(): Promise<CacheData> {
    this.data ??= this.read();
    return this.data;
  }

  private async read(): Promise<CacheData> {
    try {
      const raw = await vscode.workspace.fs.readFile(this.uri);
      const parsed = JSON.parse(Buffer.from(raw).toString('utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }

      // Beim ersten Start gibt es die Datei nicht, und von Hand editiert kann
      // alles Mögliche darin stehen. Ein kaputter Cache darf nur bedeuten, dass
      // es nichts zu zeigen gibt – er darf nicht später beim Uri.parse die
      // ganze Gruppe durch eine Fehlerzeile ersetzen.
      const data: CacheData = {};
      for (const [groupName, entries] of Object.entries(parsed)) {
        if (!Array.isArray(entries)) {
          continue;
        }
        data[groupName] = entries
          .filter(
            (entry): entry is CachedProject =>
              typeof entry?.name === 'string' && typeof entry?.uri === 'string'
          )
          .map(entry => ({
            ...entry,
            parts:
              Array.isArray(entry.parts) && entry.parts.every(part => typeof part === 'string')
                ? entry.parts
                : undefined
          }));
      }
      return data;
    } catch {
      return {};
    }
  }
}
