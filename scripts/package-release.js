#!/usr/bin/env node
/**
 * Legt `releases/` an und stellt sicher, dass dort nichts überschrieben wird.
 *
 * Ein abgelegtes .vsix ist ein Auslieferungsstand: die READMEs verlinken es,
 * und installiert ist es irgendwo auch schon. Derselbe Dateiname mit anderem
 * Inhalt macht daraus einen Stand, den niemand mehr zuordnen kann – also lieber
 * abbrechen und die Version anheben.
 */

const fs = require('fs');
const path = require('path');

const { name, version } = require('../package.json');

const dir = path.join(__dirname, '..', 'releases');
fs.mkdirSync(dir, { recursive: true });

const file = `${name}-${version}.vsix`;
if (fs.existsSync(path.join(dir, file))) {
  console.error(`releases/${file} gibt es schon.`);
  console.error(`Version in package.json anheben (derzeit ${version}) – oder die Datei bewusst löschen.`);
  process.exit(1);
}

console.log(`Ziel:       releases/${file}`);
