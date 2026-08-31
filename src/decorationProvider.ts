import * as vscode from 'vscode';
import { uriKey } from './uri';

export class CurrentProjectDecorationProvider implements vscode.FileDecorationProvider {
  private current = new Set<string>();

  private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri[] | undefined>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  setCurrent(uris: vscode.Uri[]): void {
    // Über die normalisierte Form: derselbe Ordner kommt je nach Herkunft
    // kodiert oder unkodiert und mit oder ohne Schrägstrich am Ende an.
    this.current = new Set(uris.map(uriKey));
    this._onDidChangeFileDecorations.fire(undefined);
  }

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (this.current.has(uriKey(uri))) {
      return {
        badge: '✓',
        color: new vscode.ThemeColor('charts.green'),
        tooltip: vscode.l10n.t('Currently open project')
      };
    }
    return undefined;
  }
}
