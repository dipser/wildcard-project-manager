/**
 * Gemeinsame Basis für i18n-scan und i18n-merge.
 *
 * Kernidee: `l10n/.i18n-state.json` merkt sich pro Sprache und Key den
 * Fingerprint des *englischen* Quelltexts, aus dem die Übersetzung entstanden
 * ist. Daraus folgen die beiden Regeln, die dieses Setup erfüllen soll:
 *
 *   - Quelltext unverändert  -> Übersetzung wird nie angefasst (Handarbeit bleibt)
 *   - Quelltext geändert     -> Übersetzung wird neu erzeugt (Änderung greift durch)
 *
 * Ein „locked"-Flag braucht es dafür nicht: der Fingerprint deckt beide Fälle ab.
 */

const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/**
 * Zielsprachen: alle Sprachen, für die VS Code ein Language Pack anbietet.
 * Andere ergänzen lohnt nicht – nur diese lassen sich als Anzeigesprache
 * einstellen, alles darüber hinaus bekäme nie ein Nutzer zu sehen.
 */
const LANGUAGES = [
  'cs',
  'de',
  'es',
  'fr',
  'hu',
  'it',
  'ja',
  'ko',
  'pl',
  'pt-br',
  'ru',
  'tr',
  'zh-cn',
  'zh-tw'
];

const STATE_FILE = path.join(ROOT, 'l10n', '.i18n-state.json');
const TODO_FILE = path.join(ROOT, 'l10n', '_todo.json');
const BASE_BUNDLE = path.join(ROOT, 'l10n', 'bundle.l10n.json');

/** Die beiden Übersetzungsflächen der Extension. */
const SURFACES = {
  nls: lang => path.join(ROOT, lang ? `package.nls.${lang}.json` : 'package.nls.json'),
  bundle: lang => path.join(ROOT, 'l10n', lang ? `bundle.l10n.${lang}.json` : 'bundle.l10n.json')
};

const fingerprint = source => crypto.createHash('sha1').update(source, 'utf8').digest('hex').slice(0, 12);

const readJson = (file, fallback) =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;

/**
 * Schreibt JSON in stabiler Reihenfolge – sonst rauscht jeder Lauf durch den
 * Diff. `order` ist die Schlüsselfolge der englischen Quelle: die Zieldateien
 * stehen dann Zeile für Zeile parallel zum Original, was das Gegenlesen einer
 * fremden Sprache erheblich erleichtert. Ohne `order` wird alphabetisch sortiert.
 */
function orderedCopy(data, order = []) {
  const rest = Object.keys(data)
    .filter(key => !order.includes(key))
    .sort((a, b) => a.localeCompare(b));
  const ordered = {};
  for (const key of [...order, ...rest]) {
    if (key in data) {
      ordered[key] = data[key];
    }
  }
  return ordered;
}

function writeJson(file, data, order = []) {
  fs.writeFileSync(file, JSON.stringify(orderedCopy(data, order), null, 2) + '\n', 'utf8');
}

/**
 * Strings, die über eine Variable in `vscode.l10n.t()` landen und die der
 * Extractor deshalb nicht sehen kann. Sie werden aus den kompilierten Modulen
 * gelesen statt in einer Handliste dupliziert – so kann kein neuer Icon-Katalog
 * oder Farbeintrag unbemerkt untenrum durchrutschen.
 */
function dynamicStrings() {
  const dist = path.join(ROOT, 'dist');
  if (!fs.existsSync(path.join(dist, 'icons.js')) || !fs.existsSync(path.join(dist, 'colors.js'))) {
    throw new Error('dist/ fehlt oder ist veraltet – bitte zuerst `npm run compile`.');
  }
  const { ICON_CATALOG } = require(path.join(dist, 'icons.js'));
  const { COLOR_PALETTE } = require(path.join(dist, 'colors.js'));
  return [...ICON_CATALOG.map(g => g.title), ...COLOR_PALETTE.map(c => c.label)];
}

/**
 * Baut die englische Basis: Extractor-Ausgabe plus die dynamischen Strings.
 * Schreibt `l10n/bundle.l10n.json`, damit die Quelle versioniert und
 * nachvollziehbar ist statt nur implizit in den Keys der Zieldateien zu stecken.
 */
function buildBaseBundle() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'l10n-'));
  try {
    execFileSync('npx', ['@vscode/l10n-dev', 'export', '-o', tmp, './src'], {
      cwd: ROOT,
      stdio: 'pipe'
    });
    const extracted = readJson(path.join(tmp, 'bundle.l10n.json'), {});
    const bundle = orderedCopy({
      ...extracted,
      ...Object.fromEntries(dynamicStrings().map(value => [value, value]))
    });
    writeJson(BASE_BUNDLE, bundle);
    return bundle;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** Die englischen Quelltexte beider Flächen, key -> englischer Text. */
function readSources() {
  const bundle = buildBaseBundle();
  return {
    nls: readJson(SURFACES.nls(), {}),
    // Im Bundle ist der englische Text zugleich der Key.
    bundle: Object.fromEntries(Object.keys(bundle).map(key => [key, key]))
  };
}

const readState = () => readJson(STATE_FILE, {});

function writeState(state) {
  const ordered = {};
  for (const surface of Object.keys(state).sort()) {
    ordered[surface] = {};
    for (const lang of Object.keys(state[surface]).sort()) {
      ordered[surface][lang] = Object.fromEntries(
        Object.entries(state[surface][lang]).sort(([a], [b]) => a.localeCompare(b))
      );
    }
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(ordered, null, 2) + '\n', 'utf8');
}

module.exports = {
  ROOT,
  LANGUAGES,
  SURFACES,
  STATE_FILE,
  TODO_FILE,
  BASE_BUNDLE,
  fingerprint,
  readJson,
  writeJson,
  readSources,
  readState,
  writeState
};
