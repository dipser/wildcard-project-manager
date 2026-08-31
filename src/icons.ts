/**
 * Auswahl gebräuchlicher Codicons für den Icon-Dialog, thematisch gruppiert.
 *
 * Bewusst eine kuratierte Liste und nicht der komplette Satz: VS Code liefert
 * keine Möglichkeit, die verfügbaren Codicons zur Laufzeit abzufragen, und
 * mehrere hundert Einträge zum Durchscrollen helfen niemandem. Wer ein Icon
 * braucht, das hier fehlt, gibt die ID über „Eigene Codicon-ID…“ direkt ein.
 *
 * Vollständige Übersicht: https://microsoft.github.io/vscode-codicons/dist/codicon.html
 */
export interface IconCatalogGroup {
  title: string;
  ids: string[];
}

export const ICON_CATALOG: IconCatalogGroup[] = [
  {
    title: 'Folders & Projects',
    ids: [
      'folder',
      'folder-opened',
      'folder-active',
      'new-folder',
      'project',
      'repo',
      'package',
      'archive',
      'files',
      'briefcase',
      'home'
    ]
  },
  {
    title: 'Code & Development',
    ids: [
      'code',
      'file-code',
      'terminal',
      'terminal-bash',
      'debug',
      'bug',
      'beaker',
      'git-branch',
      'git-merge',
      'git-pull-request',
      'source-control',
      'extensions',
      'vm',
      'wand'
    ]
  },
  {
    title: 'Server & Data',
    ids: [
      'server',
      'server-environment',
      'server-process',
      'database',
      'cloud',
      'remote',
      'remote-explorer',
      'globe',
      'radio-tower',
      'plug',
      'pulse',
      'graph',
      'dashboard'
    ]
  },
  {
    title: 'Web & Communication',
    ids: [
      'browser',
      'window',
      'link',
      'rss',
      'mail',
      'comment',
      'comment-discussion',
      'megaphone',
      'broadcast',
      'organization',
      'github'
    ]
  },
  {
    title: 'Tools & Status',
    ids: [
      'tools',
      'wrench',
      'gear',
      'settings-gear',
      'checklist',
      'tasklist',
      'list-unordered',
      'calendar',
      'history',
      'watch',
      'shield',
      'lock',
      'key',
      'law',
      'verified',
      'warning',
      'info'
    ]
  },
  {
    title: 'Markers & Shapes',
    ids: [
      'star-full',
      'star-empty',
      'heart',
      'bookmark',
      'tag',
      'pin',
      'flame',
      'rocket',
      'zap',
      'lightbulb',
      'telescope',
      'milestone',
      'circle-filled',
      'circle-outline',
      'primitive-square',
      'paintcan',
      'symbol-color',
      'color-mode',
      'smiley',
      'gift',
      'mortar-board'
    ]
  }
];
