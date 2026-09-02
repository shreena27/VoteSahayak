// Runs the ERD-derived integrity checks (src/content/schema.js) against the
// actual content files, so a bad edit to forms.json/cards.json fails fast
// instead of surfacing as a broken Action Card at runtime.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateForms, validateCards, validateWizardContent, validateUpdates, validateChatChips, validateQaBank } from '../src/content/schema.js';
import { CHAT_CHIPS } from '../src/content/chatContent.js';
import { QA_BANK } from '../src/content/qaBank.js';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.join(rootDir, '..', 'src', 'content');

function readJson(fileName) {
  return JSON.parse(readFileSync(path.join(contentDir, fileName), 'utf8'));
}

const forms = readJson('forms.json');
const cards = readJson('cards.json');
const tasks = readJson('tasks.json');
const questions = readJson('questions.json');
const options = readJson('options.json');
const updates = readJson('updates.json');

const formResult = validateForms(forms);
const cardResult = validateCards(cards, forms);
const wizardResult = validateWizardContent(tasks, questions, options, cards);
const updateResult = validateUpdates(updates);
const chatResult = validateChatChips(CHAT_CHIPS);
const qaResult = validateQaBank(QA_BANK);

// CHAT_CHIPS and QA_BANK share one qa_id namespace once embed.mjs merges them
// into a single corpus (a chip is retrievable by free text too, per step 13's
// design) — a collision would make /api/ask's lookup ambiguous.
const chipIds = new Set(CHAT_CHIPS.map((c) => c.id));
const corpusIdErrors = QA_BANK.filter((e) => chipIds.has(e.id)).map(
  (e) => `qaBank.js: "${e.id}" collides with a chatContent.js chip id — the embed corpus needs one shared id namespace`,
);

const errors = [
  ...formResult.errors,
  ...cardResult.errors,
  ...wizardResult.errors,
  ...updateResult.errors,
  ...chatResult.errors,
  ...qaResult.errors,
  ...corpusIdErrors,
];
const staleWarnings = [
  ...formResult.staleWarnings,
  ...cardResult.staleWarnings,
  ...updateResult.staleWarnings,
  ...chatResult.staleWarnings,
  ...qaResult.staleWarnings,
];

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

console.log(
  `Content OK: ${forms.length} form(s), ${cards.length} card(s), ${tasks.length} task(s), ${questions.length} question(s), ${options.length} option(s), ${updates.length} update(s), ${CHAT_CHIPS.length} chat chip(s), ${QA_BANK.length} QA bank entries, 0 errors, ${staleWarnings.length} stale warning(s).`,
);
