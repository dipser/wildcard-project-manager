/**
 * Farbdaten für die Icon-Farbe – bewusst in einem eigenen Modul ohne
 * `vscode`-Import, damit die Übersetzungs-Skripte die Labels aus dem
 * kompilierten Modul lesen können. Die Labels landen über
 * `vscode.l10n.t(entry.label)` in der UI, also über eine Variable: ein
 * Extractor findet sie im Quelltext nicht, `scripts/i18n-lib.js` schon.
 */

/**
 * Farben, die als eigener Menueeintrag im Untermenue stehen. Bewusst nur die,
 * fuer die es einen farblich ehrlichen Kreis-Emoji gibt - Menues rendern keine
 * Icons, und ein Emoji in der falschen Farbe ist schlechter als keins.
 * Der Suffix verbindet Befehls-Id und Farbe.
 */
export const COLOR_COMMANDS: { suffix: string; colorId: string }[] = [
  { suffix: 'None', colorId: '' },
  { suffix: 'Dimmed', colorId: 'disabledForeground' },
  { suffix: 'Red', colorId: 'charts.red' },
  { suffix: 'Orange', colorId: 'charts.orange' },
  { suffix: 'Yellow', colorId: 'charts.yellow' },
  { suffix: 'Green', colorId: 'charts.green' },
  { suffix: 'Blue', colorId: 'charts.blue' },
  { suffix: 'Purple', colorId: 'charts.purple' },
  { suffix: 'Gray', colorId: 'charts.foreground' }
];

/**
 * Die vollstaendige Palette fuer "Weitere Farben…". Hier stimmt die Darstellung,
 * weil QuickPick-Eintraege ein echtes ThemeIcon in der jeweiligen Farbe zeigen
 * koennen - inklusive der Toene, die charts.* gar nicht hat.
 */
export const COLOR_PALETTE: { label: string; colorId: string }[] = [
  { label: 'Default Color', colorId: '' },
  { label: 'Dimmed', colorId: 'disabledForeground' },
  { label: 'Gray', colorId: 'charts.foreground' },
  { label: 'Red', colorId: 'charts.red' },
  { label: 'Orange', colorId: 'charts.orange' },
  { label: 'Yellow', colorId: 'charts.yellow' },
  { label: 'Green', colorId: 'charts.green' },
  { label: 'Blue', colorId: 'charts.blue' },
  { label: 'Purple', colorId: 'charts.purple' },
  { label: 'Terminal Black', colorId: 'terminal.ansiBlack' },
  { label: 'Terminal Red', colorId: 'terminal.ansiRed' },
  { label: 'Terminal Green', colorId: 'terminal.ansiGreen' },
  { label: 'Terminal Yellow', colorId: 'terminal.ansiYellow' },
  { label: 'Terminal Blue', colorId: 'terminal.ansiBlue' },
  { label: 'Terminal Magenta', colorId: 'terminal.ansiMagenta' },
  { label: 'Terminal Cyan', colorId: 'terminal.ansiCyan' },
  { label: 'Terminal White', colorId: 'terminal.ansiWhite' },
  { label: 'Terminal Bright Black', colorId: 'terminal.ansiBrightBlack' },
  { label: 'Terminal Bright Red', colorId: 'terminal.ansiBrightRed' },
  { label: 'Terminal Bright Green', colorId: 'terminal.ansiBrightGreen' },
  { label: 'Terminal Bright Yellow', colorId: 'terminal.ansiBrightYellow' },
  { label: 'Terminal Bright Blue', colorId: 'terminal.ansiBrightBlue' },
  { label: 'Terminal Bright Magenta', colorId: 'terminal.ansiBrightMagenta' },
  { label: 'Terminal Bright Cyan', colorId: 'terminal.ansiBrightCyan' },
  { label: 'Terminal Bright White', colorId: 'terminal.ansiBrightWhite' }
];
