// Runs the ERD-derived integrity checks (src/content/schema.js) against the
// actual content files, so a bad edit to forms.json/cards.json fails fast
// instead of surfacing as a broken Action Card at runtime.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateForms, validateCards } from '../src/content/schema.js';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.join(rootDir, '..', 'src', 'content');

function readJson(fileName) {
  return JSON.parse(readFileSync(path.join(contentDir, fileName), 'utf8'));
}

const forms = readJson('forms.json');
const cards = readJson('cards.json');

const formResult = validateForms(forms);
const cardResult = validateCards(cards, forms);

const errors = [...formResult.errors, ...cardResult.errors];
const staleWarnings = [...formResult.staleWarnings, ...cardResult.staleWarnings];

for (const warning of staleWarnings) {
  console.warn(`STALE: ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`ERROR: ${error}`);
  }
  console.error(`\n${errors.length} content error(s) found.`);
  process.exit(1);
}

console.log(`Content OK: ${forms.length} form(s), ${cards.length} card(s), 0 errors, ${staleWarnings.length} stale warning(s).`);
