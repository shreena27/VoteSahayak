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

/**
 * @typedef {Object} Task
 * @property {string} id       - PK, e.g. "correct-details", "update-address"
 * @property {string} title_en
 * @property {string} title_hi
 * @property {string} icon
 * @property {string} subtitle_en - one-line description shown on the task-picker row, e.g. "Wrong name, date of birth, or photo · Form 8"
 * @property {string} subtitle_hi
 * @property {string} preflight_en - "keep ready before you start" copy shown on the task's first question screen; per-task (not global) since what to keep ready genuinely differs by task — a shared string here previously showed "correct details" proof guidance on every task, including Update-address, which needs address proof instead
 * @property {string} preflight_hi
 */

/**
 * @typedef {Object} Question
 * @property {string} id
 * @property {string} task_id     - FK into tasks.json
 * @property {string} text_en
 * @property {string} text_hi
 * @property {boolean} multi_select - true keeps a Continue button; false auto-advances on tap
 * @property {number} order
 */

/**
 * @typedef {Object} Option
 * @property {string} id
 * @property {string} question_id - FK into questions.json
 * @property {string} label_en
 * @property {string} label_hi
 * @property {string} next        - the next QUESTION id, or a CARD_PAYLOAD id when this option ends the flow
 */

/**
 * @typedef {Object} UpdateItem
 * @property {string} id
 * @property {string|null} state_id  - FK into a future STATE_INFO table; null = national-level update (state-scoped SIR updates are Phase 2 step 9's job, not this step's)
 * @property {string} headline_en    - short bold lead-in shown above text_en in the urgency strip (matches the locked mockup's <b>SIR in progress</b> pattern), e.g. "SIR, Phase II"
 * @property {string} headline_hi
 * @property {string} text_en
 * @property {string} text_hi
 * @property {string|null} last_date - ISO date; null when there's no pending deadline to show (a calm/settled update, not an active countdown) — never a countdown timer either way, per this project's locked "no fake urgency" rule
 * @property {string} verified_on    - ISO date
 * @property {string} source_url     - must be an official source; ECI notifications only, per this project's no-news decision
 */

const STALE_AFTER_DAYS = 30;

const DISPLAY_MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Hindi doesn't abbreviate month names the way English does, so these are
// full names rather than 3-letter forms — matches how the rest of this
// project's Hindi UI copy reads (never truncated/transliterated shorthand).
const DISPLAY_MONTHS_HI = [
  'जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
  'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर',
];

/**
 * Formats an already-validated "YYYY-MM-DD" date for display (e.g. "1 Sep
 * 2026" / "1 सितंबर 2026"). Shared by the Action Card footer and the Home
 * screen's urgency strip so the two "last verified" displays never drift
 * into two different formats — and so neither one silently shows an English
 * month name inside otherwise-Hindi text (the same class of bug already
 * fixed once for form names, see Form.name_hi).
 * @param {string} isoDate
 * @param {"en"|"hi"} [lang] - defaults to "en" when omitted/unset (matches
 *   this project's other lang-optional call sites, e.g. before a language
 *   choice is made)
 * @returns {string}
 */
export function formatDisplayDate(isoDate, lang) {
  const [y, m, d] = isoDate.split('-');
  const months = lang === 'hi' ? DISPLAY_MONTHS_HI : DISPLAY_MONTHS_EN;
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
}

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

/**
 * Checks tasks.json/questions.json/options.json together against the ERD's
 * TASK/QUESTION/OPTION shape and FK rules — every `question.task_id` must
 * resolve to a real task, every `option.next` must resolve to either a real
 * question or a real card, every task must have at least one question, and
 * every question must have at least one option (a single-choice question
 * needs at least two, since one option offers no real choice).
 *
 * Multi-select routing rule: the wizard engine's Continue button advances
 * once, using whichever selected option's `next` it finds first — so every
 * option on a given multi-select question MUST share one `next` value, or
 * routing becomes dependent on tap order (a real bug this validator now
 * catches at author time instead of at runtime).
 *
 * option.next is scoped per task: it must resolve to either a card, or a
 * question belonging to the SAME task as the option's own question — this
 * catches a typo'd `next` that would otherwise render a different task's
 * question under the wrong task's title. Every question in a task must also
 * be reachable by walking `next` from that task's first question, and no
 * question id may collide with a card id (the engine resolves question-first
 * and would otherwise silently swallow a same-id card).
 *
 * @param {Task[]} tasks
 * @param {Question[]} questions
 * @param {Option[]} options
 * @param {CardPayload[]} cards - for option.next FK validation
 * @returns {{errors: string[]}}
 */
export function validateWizardContent(tasks, questions, options, cards) {
  const errors = [];
  const taskIds = new Set();
  const questionIds = new Set();
  const cardIds = new Set(cards.map((c) => c.id));

  for (const task of tasks) {
    const label = task?.id ?? '(missing id)';
    for (const field of ['id', 'title_en', 'title_hi', 'icon', 'subtitle_en', 'subtitle_hi', 'preflight_en', 'preflight_hi']) {
      if (!task[field]) errors.push(`tasks.json: "${label}" is missing required field "${field}"`);
    }
    if (task.id) {
      if (taskIds.has(task.id)) errors.push(`tasks.json: duplicate id "${task.id}"`);
      taskIds.add(task.id);
    }
  }

  const questionsByTask = new Map();
  const taskIdByQuestionId = new Map();
  for (const q of questions) {
    const label = q?.id ?? '(missing id)';
    for (const field of ['id', 'task_id', 'text_en', 'text_hi']) {
      if (!q[field]) errors.push(`questions.json: "${label}" is missing required field "${field}"`);
    }
    if (typeof q.multi_select !== 'boolean') {
      errors.push(`questions.json: "${label}" must have a boolean multi_select`);
    }
    if (typeof q.order !== 'number') {
      errors.push(`questions.json: "${label}" must have a numeric order`);
    }
    if (q.id) {
      if (questionIds.has(q.id)) errors.push(`questions.json: duplicate id "${q.id}"`);
      questionIds.add(q.id);
      if (cardIds.has(q.id)) {
        errors.push(`questions.json: "${q.id}" collides with a cards.json id of the same value — ids must be unique across questions and cards`);
      }
    }
    if (q.task_id && !taskIds.has(q.task_id)) {
      errors.push(`questions.json: "${label}" references unknown task_id "${q.task_id}"`);
    }
    if (q.task_id) {
      if (!questionsByTask.has(q.task_id)) questionsByTask.set(q.task_id, []);
      questionsByTask.get(q.task_id).push(q);
      if (q.id) taskIdByQuestionId.set(q.id, q.task_id);
    }
  }
  for (const task of tasks) {
    if (!questionsByTask.get(task.id)?.length) {
      errors.push(`questions.json: task "${task.id}" has no questions`);
    }
  }

  const optionsByQuestion = new Map();
  for (const opt of options) {
    const label = opt?.id ?? '(missing id)';
    for (const field of ['id', 'question_id', 'label_en', 'label_hi', 'next']) {
      if (!opt[field]) errors.push(`options.json: "${label}" is missing required field "${field}"`);
    }
    if (opt.question_id && !questionIds.has(opt.question_id)) {
      errors.push(`options.json: "${label}" references unknown question_id "${opt.question_id}"`);
    }
    const ownTaskId = opt.question_id ? taskIdByQuestionId.get(opt.question_id) : undefined;
    if (opt.next) {
      const isQuestion = questionIds.has(opt.next);
      const isCard = cardIds.has(opt.next);
      if (!isQuestion && !isCard) {
        errors.push(`options.json: "${label}".next ("${opt.next}") doesn't resolve to any known question or card`);
      } else if (isQuestion && ownTaskId && taskIdByQuestionId.get(opt.next) !== ownTaskId) {
        errors.push(
          `options.json: "${label}".next ("${opt.next}") points to a question in a different task ("${taskIdByQuestionId.get(opt.next)}") than its own ("${ownTaskId}")`,
        );
      }
    }
    if (opt.question_id) {
      if (!optionsByQuestion.has(opt.question_id)) optionsByQuestion.set(opt.question_id, []);
      optionsByQuestion.get(opt.question_id).push(opt);
    }
  }
  for (const q of questions) {
    const opts = optionsByQuestion.get(q.id) ?? [];
    if (opts.length === 0) {
      errors.push(`options.json: question "${q.id}" has no options`);
    } else if (!q.multi_select && opts.length < 2) {
      errors.push(`options.json: single-choice question "${q.id}" needs at least 2 options to be a real choice`);
    } else if (q.multi_select) {
      if (opts.length < 2) {
        // A multi-select with only one possible option offers no real
        // "select some of these" choice — it's a single-choice question
        // wearing the wrong UI (Continue button, no auto-advance) for no
        // reason. Author it as single-choice instead.
        errors.push(
          `options.json: multi-select question "${q.id}" has only 1 option — a multi-select needs at least 2 real choices, otherwise author it as single-choice`,
        );
      }
      const distinctNext = new Set(opts.map((o) => o.next).filter(Boolean));
      if (distinctNext.size > 1) {
        errors.push(
          `options.json: multi-select question "${q.id}" has options pointing at different "next" targets (${[...distinctNext].join(', ')}) — the wizard engine advances once on whichever selected option it finds first, so all options on a multi-select question must share one "next"`,
        );
      }
    }
  }

  // Reachability, duplicate-order, and termination checks all walk each
  // task's own question set, so they share one loop.
  for (const task of tasks) {
    const taskQuestions = questionsByTask.get(task.id) ?? [];
    if (taskQuestions.length === 0) continue;

    // Duplicate `order`: leaves "which question is first" ambiguous between
    // this validator (which picks the lowest `order`) and a future author
    // eyeballing the file — a silent authoring mistake, not a runtime crash,
    // so it's cheap to let slip through without this check.
    const seenOrders = new Map();
    for (const q of taskQuestions) {
      if (typeof q.order !== 'number') continue; // already flagged above
      if (seenOrders.has(q.order)) {
        errors.push(
          `questions.json: "${q.id}" and "${seenOrders.get(q.order)}" in task "${task.id}" both have order ${q.order} — question order must be unique within a task`,
        );
      } else {
        seenOrders.set(q.order, q.id);
      }
    }

    const sorted = [...taskQuestions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const first = sorted[0];

    // Reachability: every question in a task must be reachable by walking
    // `next` from that task's own first question (lowest `order`) — an
    // orphaned question (nothing routes to it) would otherwise pass every
    // other check while never actually being shown to a user.
    const reachable = new Set([first.id]);
    const queue = [first.id];
    while (queue.length > 0) {
      const qid = queue.pop();
      for (const opt of optionsByQuestion.get(qid) ?? []) {
        if (opt.next && questionIds.has(opt.next) && !reachable.has(opt.next)) {
          reachable.add(opt.next);
          queue.push(opt.next);
        }
      }
    }
    for (const q of sorted) {
      if (!reachable.has(q.id)) {
        errors.push(`questions.json: "${q.id}" in task "${task.id}" is unreachable — no option's "next" ever routes to it from that task's first question`);
      }
    }

    // Termination: every option's `next`, followed all the way to its end,
    // must reach a card — no dead ends (a question whose every path stops
    // short of a card) and no cycles (e.g. q1 -> q2 -> q1) that let a user
    // loop forever without ever finishing. `visiting` marks nodes on the
    // current DFS path; revisiting one of those is a cycle, which never
    // terminates through that edge. `terminates` is memoized per question
    // since the graph is static for the length of one validation run.
    const terminates = new Map();
    const visiting = new Set();
    function questionTerminates(questionId) {
      if (terminates.has(questionId)) return terminates.get(questionId);
      if (visiting.has(questionId)) return false; // cycle: this edge never resolves
      visiting.add(questionId);
      const opts = optionsByQuestion.get(questionId) ?? [];
      let ok = opts.length > 0;
      for (const opt of opts) {
        if (!opt.next) {
          ok = false;
        } else if (cardIds.has(opt.next)) {
          // terminates immediately via this option
        } else if (questionIds.has(opt.next)) {
          if (!questionTerminates(opt.next)) ok = false;
        } else {
          ok = false; // unresolvable next, already reported above
        }
      }
      visiting.delete(questionId);
      terminates.set(questionId, ok);
      return ok;
    }
    for (const q of sorted) {
      if (reachable.has(q.id) && !questionTerminates(q.id)) {
        errors.push(
          `options.json: task "${task.id}" has a question ("${q.id}") where at least one path never reaches a card — either a dead end or a routing cycle (e.g. "next" pointing back to an earlier question) that a user could get stuck in`,
        );
      }
    }
  }

  return { errors: errors.map((e) => e) };
}

/**
 * Checks updates.json against the ERD's UPDATE_ITEM shape. `last_date` and
 * `state_id` are both intentionally nullable (see the UpdateItem typedef);
 * `verified_on` and `source_url` are not.
 * @param {UpdateItem[]} updates
 * @returns {{errors: string[], staleWarnings: string[]}}
 */
export function validateUpdates(updates) {
  const errors = [];
  const staleWarnings = [];
  const seenIds = new Set();

  for (const update of updates) {
    const label = update?.id ?? '(missing id)';
    for (const field of ['id', 'headline_en', 'headline_hi', 'text_en', 'text_hi', 'verified_on', 'source_url']) {
      if (!update[field]) errors.push(`updates.json: "${label}" is missing required field "${field}"`);
    }
    if (update.id) {
      if (seenIds.has(update.id)) errors.push(`updates.json: duplicate id "${update.id}"`);
      seenIds.add(update.id);
    }
    if (update.last_date != null && !isValidIsoDate(update.last_date)) {
      errors.push(`updates.json: "${label}" has an invalid last_date ("${update.last_date}")`);
    }
    if (update.source_url && !/^https:\/\//.test(update.source_url)) {
      errors.push(`updates.json: "${label}".source_url must be an https:// URL ("${update.source_url}")`);
    }
    checkVerifiedOnDate(label, 'verified_on', update.verified_on, errors, staleWarnings);
  }

  return {
    errors: errors.map((e) => (e.startsWith('updates.json') ? e : `updates.json: ${e}`)),
    staleWarnings: staleWarnings.map((w) => `updates.json: ${w}`),
  };
}
