// Content schema for the author-curated knowledge base, matching the entities
// and integrity rules in `Downloads/Final Case study/ERD - Vote Sahayak.md`.
// Plain JS + JSDoc (no TypeScript) so editors get type hints without a build
// step; `validateContent()` below is what actually enforces the ERD's
// integrity rules at author time, since JSDoc alone doesn't check JSON files.

/**
 * @typedef {Object} Form
 * @property {string} id            - PK, e.g. "form-6", "form-8"
 * @property {string} name          - e.g. "Form 8"
 * @property {string} purpose_en
 * @property {string} purpose_hi
 * @property {string} official_url
 * @property {string} url_verified_on - ISO date "YYYY-MM-DD"; the ERD's last-verified date system
 */

/**
 * @typedef {Object} DocumentReq
 * @property {string} id
 * @property {string} label_en
 * @property {string} label_hi
 * @property {boolean} any_one_of   - true when this entry is one option in a group where only one is needed (e.g. SIR notice: any one of Aadhaar/EPIC/Ration)
 */

/**
 * @typedef {Object} Step
 * @property {string} id
 * @property {number} order
 * @property {string} text_en
 * @property {string} text_hi
 * @property {string} icon
 * @property {"none"|"tel"|"url"|"share"|"save"} action_kind
 * @property {string} [action_value] - e.g. "tel:1950", an official URL; absent when action_kind is "none"
 */

/**
 * @typedef {Object} CardPayload
 * @property {string} id
 * @property {"sir-outcome"|"sir-notice"|"wizard-result"|"gather-first"} kind
 * @property {string} headline_en
 * @property {string} headline_hi
 * @property {string} meaning_en    - the calming plain-language paragraph
 * @property {string} meaning_hi
 * @property {string|null} form_id  - FK into forms.json; nullable, some SIR outcomes have none
 * @property {string} timeline_en
 * @property {string} timeline_hi
 * @property {string[]} rejection_tags - amber caution chips, from the rejection taxonomy; empty array when there's nothing to warn about (e.g. a calm "found-active" outcome)
 * @property {DocumentReq[]} document_requirements - denormalized here (not a separate top-level array) since each card authors its own document list; field names still match the ERD's DOCUMENT_REQ entity minus the redundant card_id FK
 * @property {Step[]} steps         - denormalized for the same reason as document_requirements; matches the ERD's STEP entity minus card_id
 * @property {string} source_line   - e.g. "Source: Election Commission of India"; shown in the UI's permanent trust footer
 * @property {string} verified_on   - ISO date "YYYY-MM-DD"
 */

const STALE_AFTER_DAYS = 30;

/**
 * @param {string} isoDate
 * @returns {boolean}
 */
function isValidIsoDate(isoDate) {
  if (typeof isoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  const parsed = new Date(isoDate);
  return !Number.isNaN(parsed.getTime());
}

/**
 * @param {string} isoDate
 * @returns {boolean}
 */
function isStale(isoDate) {
  const verified = new Date(isoDate);
  const ageMs = Date.now() - verified.getTime();
  return ageMs > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Checks a forms.json array against the ERD's FORM shape and its
 * "every official_url must carry a verified_on date" integrity rule.
 * @param {Form[]} forms
 * @returns {{errors: string[], staleWarnings: string[]}}
 */
export function validateForms(forms) {
  const errors = [];
  const staleWarnings = [];
  const seenIds = new Set();

  for (const form of forms) {
    const label = form?.id ?? '(missing id)';
    for (const field of ['id', 'name', 'purpose_en', 'purpose_hi', 'official_url', 'url_verified_on']) {
      if (!form[field]) errors.push(`forms.json: "${label}" is missing required field "${field}"`);
    }
    if (form.id) {
      if (seenIds.has(form.id)) errors.push(`forms.json: duplicate id "${form.id}"`);
      seenIds.add(form.id);
    }
    if (form.url_verified_on && !isValidIsoDate(form.url_verified_on)) {
      errors.push(`forms.json: "${label}" has an invalid url_verified_on ("${form.url_verified_on}")`);
    } else if (form.url_verified_on && isStale(form.url_verified_on)) {
      staleWarnings.push(`forms.json: "${label}" was last verified over ${STALE_AFTER_DAYS} days ago`);
    }
  }

  return { errors, staleWarnings };
}

/**
 * Checks a cards.json array against the ERD's CARD_PAYLOAD shape (plus its
 * denormalized DOCUMENT_REQ/STEP children) and integrity rules.
 * @param {CardPayload[]} cards
 * @param {Form[]} forms - for form_id FK validation
 * @returns {{errors: string[], staleWarnings: string[]}}
 */
export function validateCards(cards, forms) {
  const errors = [];
  const staleWarnings = [];
  const seenIds = new Set();
  const formIds = new Set(forms.map((f) => f.id));
  const validKinds = new Set(['sir-outcome', 'sir-notice', 'wizard-result', 'gather-first']);
  const validActionKinds = new Set(['none', 'tel', 'url', 'share', 'save']);

  for (const card of cards) {
    const label = card?.id ?? '(missing id)';
    for (const field of ['id', 'kind', 'headline_en', 'headline_hi', 'meaning_en', 'meaning_hi', 'timeline_en', 'timeline_hi', 'source_line', 'verified_on']) {
      if (!card[field]) errors.push(`cards.json: "${label}" is missing required field "${field}"`);
    }
    if (card.id) {
      if (seenIds.has(card.id)) errors.push(`cards.json: duplicate id "${card.id}"`);
      seenIds.add(card.id);
    }
    if (card.kind && !validKinds.has(card.kind)) {
      errors.push(`cards.json: "${label}" has an invalid kind ("${card.kind}")`);
    }
    if (card.form_id != null && !formIds.has(card.form_id)) {
      errors.push(`cards.json: "${label}" references unknown form_id "${card.form_id}"`);
    }
    if (!Array.isArray(card.rejection_tags)) {
      errors.push(`cards.json: "${label}".rejection_tags must be an array (use [] when there's nothing to flag)`);
    }
    if (!Array.isArray(card.document_requirements)) {
      errors.push(`cards.json: "${label}".document_requirements must be an array`);
    }
    if (!Array.isArray(card.steps) || card.steps.length === 0) {
      errors.push(`cards.json: "${label}".steps must be a non-empty array`);
    } else {
      for (const step of card.steps) {
        if (step.action_kind && !validActionKinds.has(step.action_kind)) {
          errors.push(`cards.json: "${label}" step "${step.id}" has an invalid action_kind ("${step.action_kind}")`);
        }
      }
    }
    if (card.verified_on && !isValidIsoDate(card.verified_on)) {
      errors.push(`cards.json: "${label}" has an invalid verified_on ("${card.verified_on}")`);
    } else if (card.verified_on && isStale(card.verified_on)) {
      staleWarnings.push(`cards.json: "${label}" was last verified over ${STALE_AFTER_DAYS} days ago`);
    }
  }

  return { errors, staleWarnings };
}
