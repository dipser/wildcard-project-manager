#!/usr/bin/env node
/**
 * Gleicht die Sprachdateien gegen die englische Quelle ab und schreibt alles,
 * was zu übersetzen ist, nach `l10n/_todo.json`.
 *
 * Nebenbei hält es den Bestand sauber: die englische Basis wird neu gebaut,
 * verwaiste Keys fliegen raus, und Übersetzungen ohne State-Eintrag werden als
 * aktuell übernommen (fehlender State heißt „vor diesem Setup entstanden",
 * nicht „veraltet" – sonst würde der erste Lauf die vorhandene Handarbeit
 * überschreiben).
 */

const fs = require('fs');
const {
  LANGUAGES,
  SURFACES,
  TODO_FILE,
  BASE_BUNDLE,
  fingerprint,
  readJson,
  writeJson,
  readSources,
  readState,
  writeState
} = require('./i18n-lib');

const sources = readSources();
const state = readState();
const todo = {};
let todoCount = 0;
let adopted = 0;
const removed = [];

for (const surface of Object.keys(SURFACES)) {
  state[surface] ??= {};

  for (const lang of LANGUAGES) {
    const file = SURFACES[surface](lang);
    const target = readJson(file, {});
    const known = (state[surface][lang] ??= {});

    for (const [key, english] of Object.entries(sources[surface])) {
      const current = fingerprint(english);

      if (!(key in target)) {
        (todo[lang] ??= {})[surface] ??= {};
        todo[lang][surface][key] = { en: english, t: '' };
        todoCount++;
      } else if (!(key in known)) {
        known[key] = current;
        adopted++;
      } else if (known[key] !== current) {
        (todo[lang] ??= {})[surface] ??= {};
        todo[lang][surface][key] = { en: english, t: '', was: target[key] };
        todoCount++;
      }
    }

    for (const key of Object.keys(target)) {
      if (!(key in sources[surface])) {
        delete target[key];
        delete known[key];
        removed.push(`${lang}/${surface}: ${key}`);
      }
    }

    if (fs.existsSync(file)) {
      writeJson(file, target, Object.keys(sources[surface]));
    }
  }
}

writeState(state);

if (todoCount > 0) {
  fs.writeFileSync(TODO_FILE, JSON.stringify(todo, null, 2) + '\n', 'utf8');
} else if (fs.existsSync(TODO_FILE)) {
  fs.unlinkSync(TODO_FILE);
}

console.log(`Basis:      ${BASE_BUNDLE.replace(process.cwd() + '/', '')}`);
console.log(`Sprachen:   ${LANGUAGES.join(', ')}`);
if (adopted) {
  console.log(`Übernommen: ${adopted} vorhandene Übersetzungen als aktuell markiert`);
}
if (removed.length) {
  console.log(`Entfernt:   ${removed.length} verwaiste Keys`);
  removed.forEach(entry => console.log(`            ${entry}`));
}
if (todoCount === 0) {
  console.log('Offen:      nichts – alle Sprachen sind aktuell.');
} else {
  console.log(`Offen:      ${todoCount} Strings in l10n/_todo.json`);
  for (const [lang, surfaces] of Object.entries(todo)) {
    const n = Object.values(surfaces).reduce((sum, s) => sum + Object.keys(s).length, 0);
    console.log(`            ${lang}: ${n}`);
  }
}
