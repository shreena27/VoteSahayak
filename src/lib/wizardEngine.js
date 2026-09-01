// Pure content-lookup helpers for the wizard engine — no React, no state.
// The wizard UI (src/components/Wizard.jsx) owns the actual step state and
// only calls into these to answer "what's next," so the routing logic stays
// testable independent of rendering.

/**
 * @param {string} taskId
 * @param {import('../content/schema.js').Task[]} tasks
 */
export function getTask(taskId, tasks) {
  return tasks.find((t) => t.id === taskId) ?? null
}

/**
 * @param {string} taskId
 * @param {import('../content/schema.js').Question[]} questions
 */
export function getQuestionsForTask(taskId, questions) {
  return questions.filter((q) => q.task_id === taskId).sort((a, b) => a.order - b.order)
}

/**
 * @param {string} questionId
 * @param {import('../content/schema.js').Question[]} questions
 */
export function getQuestion(questionId, questions) {
  return questions.find((q) => q.id === questionId) ?? null
}

/**
 * @param {string} questionId
 * @param {import('../content/schema.js').Option[]} options
 */
export function getOptionsForQuestion(questionId, options) {
  return options.filter((o) => o.question_id === questionId)
}

/**
 * Resolves an OPTION.next id to either the next question or the terminal
 * card, since the ERD deliberately overloads that one field with both
 * meanings ("next question id or card payload id").
 * @param {string} nextId
 * @param {import('../content/schema.js').Question[]} questions
 * @param {import('../content/schema.js').CardPayload[]} cards
 * @returns {{ type: 'question', question: object } | { type: 'card', card: object } | null}
 */
export function resolveNext(nextId, questions, cards) {
  const question = questions.find((q) => q.id === nextId)
  const card = cards.find((c) => c.id === nextId)
  if (question && card) {
    // validateWizardContent rejects this at content-authoring time; this is a
    // defensive runtime guard so a collision fails loudly instead of the
    // engine silently always picking the question and swallowing the card.
    throw new Error(`wizardEngine.resolveNext: id "${nextId}" resolves to both a question and a card — content is malformed`)
  }
  if (question) return { type: 'question', question }
  if (card) return { type: 'card', card }
  return null
}

/**
 * The first question of a task, i.e. where the wizard begins.
 * @param {string} taskId
 * @param {import('../content/schema.js').Question[]} questions
 */
export function getFirstQuestion(taskId, questions) {
  return getQuestionsForTask(taskId, questions)[0] ?? null
}
