// Content schema for the author-curated knowledge base, matching the entities
// and integrity rules in `Downloads/Final Case study/ERD - Vote Sahayak.md`.
// Plain JS + JSDoc (no TypeScript) so editors get type hints without a build
// step; `validateContent()` below is what actually enforces the ERD's
// integrity rules at author time, since JSDoc alone doesn't check JSON files.

/**
 * @typedef {Object} Form
 * @property {string} id            - PK, e.g. "form-6", "form-8"
 * @property {string} name          - e.g. "Form 8"
 * @property {string} name_hi       - e.g. "फॉर्म 8" — the same name in Hindi, for UI spots (like the wizard-result tag) that must not show an untranslated "FORM 8" inside otherwise-Hindi text
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
 * @property {string} [action_value] - e.g. "tel:1950", an official URL; required when action_kind is "tel"/"url". "save"/"share" are self-contained UI actions and don't carry one.
 */

/**
 * @typedef {Object} RejectionTag
 * @property {string} id
 * @property {string} label_en   - short amber caution chip text, from the rejection taxonomy
 * @property {string} label_hi
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
 * @property {RejectionTag[]} rejection_tags - amber caution chips, from the rejection taxonomy; empty array when there's nothing to warn about (e.g. a calm "found-active" outcome)
 * @property {DocumentReq[]} document_requirements - denormalized here (not a separate top-level array) since each card authors its own document list; field names still match the ERD's DOCUMENT_REQ entity minus the redundant card_id FK
 * @property {Step[]} steps         - denormalized for the same reason as document_requirements; matches the ERD's STEP entity minus card_id
 * @property {string} source_line   - e.g. "Source: Election Commission of India"; shown in the UI's permanent trust footer. Names the card's primary authoritative source — a claim inside the card that comes from elsewhere (a press account, a research estimate) is attributed inline in that claim's own text instead, not folded into this single line.
 * @property {string} verified_on   - ISO date "YYYY-MM-DD"
 */

const STALE_AFTER_DAYS = 30;

/**
 * Rejects both malformed strings and impossible calendar dates (e.g.
 * "2026-02-30"), which `new Date(...)` would otherwise silently roll over
 * to a nearby valid date instead of flagging.
 * @param {string} isoDate
 * @returns {boolean}
 */
export function isValidIsoDate(isoDate) {
  if (typeof isoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  const [y, m, d] = isoDate.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getUTCFullYear() === y &&
    parsed.getUTCMonth() === m - 1 &&
    parsed.getUTCDate() === d
  );
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Today's calendar date in IST ("YYYY-MM-DD") — this app's real audience and
 * content authors are IST-based, so "is this date in the future" has to use
 * IST calendar-date semantics, not a raw UTC instant comparison. A raw
 * `new Date(isoDate).getTime() > Date.now()` check wrongly flags a
 * same-IST-day date as "future" for the first ~5.5 hours of every IST day,
 * because `new Date("YYYY-MM-DD")` parses as UTC midnight, which falls 5:30
 * *before* that date's real IST midnight.
 * @returns {string}
 */
export function todayIsoDateIST() {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * @param {string} isoDate - must already be a valid ISO date; caller checks that first
 * @returns {boolean}
 */
export function isFutureDate(isoDate) {
  return isoDate > todayIsoDateIST();
}

/**
 * The ERD's rule: "any date older than 30 days renders with a visible stale
 * flag in the UI." Exported so the Action Card component applies exactly
 * the same staleness math as the content validator, not a second copy of it.
 *
 * Compares calendar-date values (both `isoDate` and today's IST date parsed
 * at UTC midnight), not a raw `Date.now()` instant — the same IST-vs-UTC
 * mismatch `isFutureDate` was fixed for otherwise makes a same-day-verified
 * card go stale ~18.5 hours early. See `todayIsoDateIST` above.
 * @param {string} isoDate - must already be a valid, non-future ISO date; caller checks that first
 * @returns {boolean}
 */
export function isStale(isoDate) {
  const verifiedMs = new Date(isoDate).getTime();
  const todayMs = new Date(todayIsoDateIST()).getTime();
  const ageDays = (todayMs - verifiedMs) / (24 * 60 * 60 * 1000);
  return ageDays > STALE_AFTER_DAYS;
}

/**
 * Validates a verified-on style date field, pushing to errors/staleWarnings
 * as appropriate. Shared by validateForms and validateCards so the three
 * failure modes (malformed, future, stale) are checked identically everywhere.
 * @param {string} label
 * @param {string} fieldName
 * @param {string} value
 * @param {string[]} errors
 * @param {string[]} staleWarnings
 */
function checkVerifiedOnDate(label, fieldName, value, errors, staleWarnings) {
  if (!value) return;
  if (!isValidIsoDate(value)) {
    errors.push(`"${label}" has an invalid ${fieldName} ("${value}")`);
    return;
  }
  if (isFutureDate(value)) {
    errors.push(`"${label}" has a ${fieldName} in the future ("${value}") — a verified-on date can't be later than today`);
    return;
  }
  if (isStale(value)) {
    staleWarnings.push(`"${label}" was last verified over ${STALE_AFTER_DAYS} days ago (${fieldName}: "${value}")`);
  }
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
    for (const field of ['id', 'name', 'name_hi', 'purpose_en', 'purpose_hi', 'official_url', 'url_verified_on']) {
      if (!form[field]) errors.push(`forms.json: "${label}" is missing required field "${field}"`);
    }
    if (form.id) {
      if (seenIds.has(form.id)) errors.push(`forms.json: duplicate id "${form.id}"`);
      seenIds.add(form.id);
    }
    checkVerifiedOnDate(label, 'url_verified_on', form.url_verified_on, errors, staleWarnings);
  }

  return {
    errors: errors.map((e) => (e.startsWith('forms.json') ? e : `forms.json: ${e}`)),
    staleWarnings: staleWarnings.map((w) => `forms.json: ${w}`),
  };
}

/**
 * Checks a cards.json array against the ERD's CARD_PAYLOAD shape (plus its
 * denormalized DOCUMENT_REQ/STEP/RejectionTag children) and integrity rules.
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
      if (!card[field]) errors.push(`"${label}" is missing required field "${field}"`);
    }
    if (card.id) {
      if (seenIds.has(card.id)) errors.push(`duplicate id "${card.id}"`);
      seenIds.add(card.id);
    }
    if (card.kind && !validKinds.has(card.kind)) {
      errors.push(`"${label}" has an invalid kind ("${card.kind}")`);
    }
    if (card.form_id != null && !formIds.has(card.form_id)) {
      errors.push(`"${label}" references unknown form_id "${card.form_id}"`);
    }

    if (!Array.isArray(card.rejection_tags)) {
      errors.push(`"${label}".rejection_tags must be an array (use [] when there's nothing to flag)`);
    } else {
      for (const tag of card.rejection_tags) {
        const tagLabel = tag?.id ?? '(missing id)';
        for (const field of ['id', 'label_en', 'label_hi']) {
          if (!tag?.[field]) errors.push(`"${label}" rejection_tag "${tagLabel}" is missing required field "${field}"`);
        }
      }
    }

    if (!Array.isArray(card.document_requirements)) {
      errors.push(`"${label}".document_requirements must be an array`);
    } else {
      for (const doc of card.document_requirements) {
        const docLabel = doc?.id ?? '(missing id)';
        for (const field of ['id', 'label_en', 'label_hi']) {
          if (!doc?.[field]) errors.push(`"${label}" document_requirement "${docLabel}" is missing required field "${field}"`);
        }
        if (typeof doc?.any_one_of !== 'boolean') {
          errors.push(`"${label}" document_requirement "${docLabel}" must have a boolean any_one_of`);
        }
      }
    }

    if (!Array.isArray(card.steps) || card.steps.length === 0) {
      errors.push(`"${label}".steps must be a non-empty array`);
    } else {
      for (const step of card.steps) {
        const stepLabel = step?.id ?? '(missing id)';
        for (const field of ['id', 'text_en', 'text_hi', 'icon']) {
          if (!step?.[field]) errors.push(`"${label}" step "${stepLabel}" is missing required field "${field}"`);
        }
        if (typeof step?.order !== 'number') {
          errors.push(`"${label}" step "${stepLabel}" must have a numeric order`);
        }
        if (step?.action_kind && !validActionKinds.has(step.action_kind)) {
          errors.push(`"${label}" step "${stepLabel}" has an invalid action_kind ("${step.action_kind}")`);
        } else if (step?.action_kind === 'tel' || step?.action_kind === 'url') {
          // "save"/"share" are self-contained UI actions (a button click), not
          // a navigation target, so only tel/url need a real action_value.
          if (!step.action_value) {
            errors.push(`"${label}" step "${stepLabel}" has action_kind "${step.action_kind}" but no action_value`);
          } else if (step.action_kind === 'tel' && !step.action_value.startsWith('tel:')) {
            errors.push(`"${label}" step "${stepLabel}" has action_kind "tel" but action_value doesn't start with "tel:" ("${step.action_value}")`);
          } else if (
            step.action_kind === 'url' &&
            !/^https?:\/\//.test(step.action_value)
          ) {
            // Closes off a javascript:/data:/etc. injection surface — this is
            // trusted author-curated content today, but the check is cheap
            // and stays correct if content authoring ever becomes less
            // trusted (e.g. a future CMS).
            errors.push(`"${label}" step "${stepLabel}" has action_kind "url" but action_value isn't an http(s) URL ("${step.action_value}")`);
          }
        }
      }
    }

    checkVerifiedOnDate(label, 'verified_on', card.verified_on, errors, staleWarnings);
  }

  return {
    errors: errors.map((e) => (e.startsWith('cards.json') ? e : `cards.json: ${e}`)),
    staleWarnings: staleWarnings.map((w) => `cards.json: ${w}`),
  };
}
