#!/usr/bin/env node
/**
 * Liest die ausgefüllte `l10n/_todo.json` zurück in die Sprachdateien und
 * schreibt die Fingerprints fort. Erst nach diesem Schritt gilt eine
 * Übersetzung als „aus diesem englischen Text entstanden".
 *
 * Einträge mit leerem `t` werden übersprungen – man kann also in mehreren
 * Etappen arbeiten, ohne den Rest zu verlieren.
 */

const fs = require('fs');
const {
  SURFACES,
  TODO_FILE,
  fingerprint,
  readJson,
  writeJson,
  readSources,
  readState,
  writeState
} = require('./i18n-lib');

if (!fs.existsSync(TODO_FILE)) {
  console.error('l10n/_todo.json fehlt – bitte zuerst `npm run i18n:scan`.');
  process.exit(1);
}

/**
 * Was in der Übersetzung wörtlich stehen bleiben muss: Platzhalter, Codicons
 * und Command-URIs. Ein fehlender Platzhalter fällt sonst erst auf, wenn ein
 * Nutzer die kaputte Meldung sieht.
 */
const LITERALS = [/\{\d+\}/g, /\$\([a-z0-9-]+\)/g, /command:[A-Za-z.]+/g];

function missingLiterals(english, translation) {
  const missing = [];
  for (const pattern of LITERALS) {
    for (const token of english.match(pattern) ?? []) {
      if (!translation.includes(token)) {
        missing.push(token);
      }
    }
  }
  return missing;
}

const todo = readJson(TODO_FILE, {});
const sources = readSources();
const state = readState();
const problems = [];
let merged = 0;
let skipped = 0;

for (const [lang, surfaces] of Object.entries(todo)) {
  for (const [surface, entries] of Object.entries(surfaces)) {
    const file = SURFACES[surface](lang);
    const target = readJson(file, {});
    const known = ((state[surface] ??= {})[lang] ??= {});
    let dirty = false;

    for (const [key, entry] of Object.entries(entries)) {
      if (!entry.t) {
        skipped++;
        continue;
      }
      const missing = missingLiterals(entry.en, entry.t);
      if (missing.length) {
        problems.push(`${lang}/${surface}: „${key}" – fehlt: ${missing.join(', ')}`);
        continue;
      }
      target[key] = entry.t;
      known[key] = fingerprint(entry.en);
      merged++;
      dirty = true;
    }

    if (dirty) {
      writeJson(file, target, Object.keys(sources[surface]));
    }
  }
}

if (problems.length) {
  console.error(`Nicht übernommen – Platzhalter fehlen (${problems.length}):`);
  problems.forEach(p => console.error(`  ${p}`));
}

writeState(state);
console.log(`Übernommen: ${merged} Strings`);
if (skipped) {
  console.log(`Offen:      ${skipped} noch leer`);
}
if (merged > 0 && skipped === 0 && problems.length === 0) {
  fs.unlinkSync(TODO_FILE);
  console.log('l10n/_todo.json abgeräumt.');
}
process.exit(problems.length ? 1 : 0);
