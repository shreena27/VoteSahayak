import { useEffect, useMemo, useState } from 'react'
import { useLanguage, useTranslation } from '../i18n/hooks.js'
import { ActionCard } from './ActionCard.jsx'
import { getTask, getQuestion, getFirstQuestion, getOptionsForQuestion, resolveNext } from '../lib/wizardEngine.js'
import { trackFlowStarted, trackWizardStep } from '../lib/analytics.js'
import tasks from '../content/tasks.json'
import questions from '../content/questions.json'
import options from '../content/options.json'
import cards from '../content/cards.json'
import forms from '../content/forms.json'
import './shared.css'
import './Wizard.css'

/**
 * The wizard engine — question/option renderer driven entirely by content
 * JSON (tasks.json/questions.json/options.json), not hardcoded to one task.
 * Single-choice questions auto-advance on tap; multi-select questions show
 * selections plus an explicit Continue. Ends by rendering the real
 * ActionCard for whichever card the chosen path resolves to.
 *
 * @param {{ taskId: string, onExit: () => void }} props
 */
export function Wizard({ taskId, onExit }) {
  const { lang } = useLanguage()
  const { t } = useTranslation()
  const activeLang = lang ?? 'en'

  const task = useMemo(() => getTask(taskId, tasks), [taskId])
  const firstQuestion = useMemo(() => getFirstQuestion(taskId, questions), [taskId])

  // `screen` is either a question in progress or the terminal card. `history`
  // is the stack of prior question ids, so Back can retrace the path exactly
  // (a `next` id alone doesn't tell you where you came FROM).
  const [screen, setScreen] = useState(() => (firstQuestion ? { type: 'question', id: firstQuestion.id } : null))
  const [history, setHistory] = useState([])
  const [selected, setSelected] = useState([])

  // Fires once per task actually starting, not per re-render. Deliberately
  // scoped to `taskId` only — a stable dependency for the lifetime of one
  // Wizard mount.
  useEffect(() => {
    trackFlowStarted(taskId)
  }, [taskId])

  const currentQuestionId = screen?.type === 'question' ? screen.id : null
  const currentQuestion = useMemo(
    () => (currentQuestionId ? getQuestion(currentQuestionId, questions) : null),
    [currentQuestionId],
  )
  const currentOptions = currentQuestion ? getOptionsForQuestion(currentQuestion.id, options) : []
  const stepNumber = currentQuestion ? history.length + 1 : history.length

  // Fires once per question actually shown. `history.length` (which
  // `stepNumber` is derived from) always changes together with `screen` in
  // the same batched update — `goToQuestion`/`handleBack` both set them in
  // one handler call — so `currentQuestionId` alone is a complete, correctly
  // narrow trigger; this isn't a suppressed lint warning, `currentQuestion`
  // and `stepNumber` are genuinely included via their own stable inputs.
  useEffect(() => {
    if (currentQuestion) trackWizardStep(taskId, stepNumber)
  }, [currentQuestion, taskId, stepNumber])

  if (!task || !screen) {
    // Content is malformed (no questions for this task) — validate:content
    // should have already caught this at author time, so this is a last-
    // resort guard, not the expected path.
    return (
      <div className="wizard-screen">
        <button type="button" className="btn-text" onClick={onExit}>
          {t('wizard.backToHome')}
        </button>
      </div>
    )
  }

  function goToQuestion(questionId, fromQuestionId) {
    setHistory((h) => [...h, fromQuestionId])
    setSelected([])
    setScreen({ type: 'question', id: questionId })
  }

  function goToCard(cardId) {
    setScreen({ type: 'card', id: cardId })
  }

  function handleAdvance(optionNext) {
    const resolved = resolveNext(optionNext, questions, cards)
    if (!resolved) return
    if (resolved.type === 'question') goToQuestion(resolved.question.id, currentQuestion.id)
    else goToCard(resolved.card.id)
  }

  function handleSingleChoice(option) {
    handleAdvance(option.next)
  }

  function toggleMultiSelect(optionId) {
    setSelected((s) => (s.includes(optionId) ? s.filter((id) => id !== optionId) : [...s, optionId]))
  }

  function handleMultiContinue() {
    // All options on a given multi-select question share the same `next` in
    // this content (see the wizard content validator's note on this) — take
    // whichever selected option's `next` is available, falling back to the
    // first option's if somehow nothing is selected yet (Continue is only
    // reachable once something's picked, per the disabled state below, but
    // this keeps the function itself correct in isolation).
    const chosenId = selected[0] ?? currentOptions[0]?.id
    const chosen = currentOptions.find((o) => o.id === chosenId)
    if (chosen) handleAdvance(chosen.next)
  }

  function handleBack() {
    if (history.length === 0) {
      onExit()
      return
    }
    const prevId = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    setSelected([])
    setScreen({ type: 'question', id: prevId })
  }

  if (screen.type === 'card') {
    const card = cards.find((c) => c.id === screen.id)
    return (
      <div className="wizard-screen wizard-result">
        <div className="app-header">
          <button type="button" className="back" onClick={onExit} aria-label={t('wizard.back')}>
            ‹
          </button>
          <div className="title">{activeLang === 'hi' ? task.title_hi : task.title_en}</div>
        </div>
        {card ? (
          <ActionCard card={card} forms={forms} />
        ) : (
          <p>{t('wizard.backToHome')}</p>
        )}
        <div className="back-home">
          <button type="button" className="btn-text" onClick={onExit}>
            {t('wizard.backToHome')}
          </button>
        </div>
      </div>
    )
  }

  const isFirstQuestion = history.length === 0

  return (
    <div className="wizard-screen">
      <div className="app-header">
        <button type="button" className="back" onClick={handleBack} aria-label={t('wizard.back')}>
          ‹
        </button>
        <div className="title">{activeLang === 'hi' ? task.title_hi : task.title_en}</div>
      </div>

      {isFirstQuestion && (
        <div className="preflight">
          <div className="glyph" aria-hidden="true">
            🗂️
          </div>
          <div className="txt">
            <b>{t('wizard.preflight.label')}</b>
            {t('wizard.preflight.body')}
          </div>
        </div>
      )}

      <h3 className="wizard-question wizard-slide" key={currentQuestion.id}>
        {activeLang === 'hi' ? currentQuestion.text_hi : currentQuestion.text_en}
      </h3>

      <div className={`chip-row${!currentQuestion.multi_select && currentOptions.length === 2 ? ' stacked' : ''}`}>
        {currentOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`chip${selected.includes(option.id) ? ' sel' : ''}`}
            onClick={() => (currentQuestion.multi_select ? toggleMultiSelect(option.id) : handleSingleChoice(option))}
          >
            {activeLang === 'hi' ? option.label_hi : option.label_en}
          </button>
        ))}
      </div>

      {currentQuestion.multi_select ? (
        <>
          <button type="button" className="btn-primary" onClick={handleMultiContinue} disabled={selected.length === 0}>
            {t('wizard.continue')}
          </button>
          <p className="advance-hint">{t('wizard.multiSelectHint')}</p>
        </>
      ) : (
        <p className="advance-hint">{t('wizard.singleSelectHint')}</p>
      )}
    </div>
  )
}
