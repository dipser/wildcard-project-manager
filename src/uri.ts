import * as vscode from 'vscode';

/**
 * Schreibweise für die Konfigurationsdatei: lesbar statt prozentkodiert, also
 * "ssh-remote+myremoteserver" statt "ssh-remote%2Bmyremoteserver" und "c:/…" statt
 * "c%3A/…".
 *
 * toString(true) allein genügt dafür nicht. Es unterdrückt zwar das Kodieren,
 * gibt authority und path aber unverändert weiter – und je nachdem, auf
 * welchem Weg eine Uri bei der UI-Extension ankommt (RPC-Serialisierung,
 * Uri.parse einer bereits kodierten Zeichenkette), sind die Bestandteile
 * schon kodiert. Deshalb hier explizit dekodieren.
 */
export function formatUriForConfig(uri: vscode.Uri): string {
  return uri
    .with({ authority: decodePercent(uri.authority), path: decodePercent(uri.path) })
    .toString(true);
}

function decodePercent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    // Unvollständige Escape-Sequenzen (einzelnes "%") unverändert lassen,
    // statt den ganzen Vorgang abzubrechen.
    return value;
  }
}

/**
 * Einen Konfigurationseintrag als Uri lesen. Ohne Schema ("/var/www/*",
 * "C:\Projekte\*") wird ein lokaler Pfad angenommen – der Test verlangt
 * "://", damit der Windows-Laufwerksbuchstabe in "c:/…" nicht als Schema
 * durchgeht.
 */
export function parseProjectPath(rawPath: string): vscode.Uri {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(rawPath)
    ? vscode.Uri.parse(rawPath, true)
    : vscode.Uri.file(rawPath);
}

/**
 * Vergleich zweier Uris über die normalisierte Form: dieselbe Ressource kann
 * je nach Herkunft kodiert oder unkodiert und mit oder ohne Schrägstrich am
 * Ende ankommen.
 */
export function sameUri(a: vscode.Uri, b: vscode.Uri): boolean {
  return uriKey(a) === uriKey(b);
}

/** Vergleichsform einer Uri – als Schlüssel für Mengen und Nachschlagetabellen. */
export function uriKey(uri: vscode.Uri): string {
  return formatUriForConfig(uri).replace(/\/+$/, '');
}
