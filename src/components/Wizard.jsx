import { useEffect, useMemo, useRef, useState } from 'react'
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
 * `‹` behaves consistently on both the question screen and the terminal card
 * screen: it steps back to the previous question (so an answer can be
 * revised) rather than exiting the whole flow, and only exits (to the task
 * picker) once there's no previous question left. "Back to home" is a
 * separate, explicit escape hatch that always jumps straight to Home.
 *
 * @param {{ taskId: string, onExit: () => void, onExitToHome: () => void }} props
 */
export function Wizard({ taskId, onExit, onExitToHome }) {
  const { lang } = useLanguage()
  const { t } = useTranslation()
  const activeLang = lang ?? 'en'

  const task = useMemo(() => getTask(taskId, tasks), [taskId])
  const firstQuestion = useMemo(() => getFirstQuestion(taskId, questions), [taskId])

  // `screen` is either a question in progress or the terminal card. `history`
  // is the stack of prior question ids, so Back can retrace the path exactly
  // (a `next` id alone doesn't tell you where you came FROM) — this now
  // covers the card screen too, since Back from a card revises the last
  // answer instead of exiting the flow.
  const [screen, setScreen] = useState(() => (firstQuestion ? { type: 'question', id: firstQuestion.id } : null))
  const [history, setHistory] = useState([])
  const [selected, setSelected] = useState([])
  // What was actually picked at each question, keyed by question id — not
  // just which `next` to follow. Lets Back restore a multi-select's previous
  // selections instead of wiping them, and gives later steps a real record
  // of the user's answers to condition content on (rather than the terminal
  // card asserting specifics the user may not have picked).
  const [answers, setAnswers] = useState({})

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

  // Fires once per question actually shown, ever — a ref (not state) tracks
  // which question ids have already been counted for THIS wizard attempt, so
  // going back and revisiting a question (or returning to it via a
  // different path) never double-counts the funnel.
  const trackedQuestionIds = useRef(new Set())
  useEffect(() => {
    if (currentQuestion && !trackedQuestionIds.current.has(currentQuestion.id)) {
      trackedQuestionIds.current.add(currentQuestion.id)
      trackWizardStep(taskId, stepNumber)
    }
  }, [currentQuestion, taskId, stepNumber])

  // Move focus to the question heading on every question change, so
  // keyboard/screen-reader users don't get stranded on <body> after an
  // auto-advance or Continue click. The card screen's equivalent focus
  // target is the Action Card's own headline — ActionCard manages that
  // itself on mount, since it's the "new content" that just appeared there,
  // the same way the question text (not the static task title) is here.
  const questionHeadingRef = useRef(null)
  useEffect(() => {
    if (screen?.type === 'question') questionHeadingRef.current?.focus()
  }, [screen])

  if (!task || !screen) {
    // Content is malformed (no questions for this task) — validate:content
    // should have already caught this at author time, so this is a last-
    // resort guard, not the expected path.
    return (
      <div className="wizard-screen">
        <button type="button" className="btn-text" onClick={onExitToHome}>
          {t('wizard.backToHome')}
        </button>
      </div>
    )
  }

  function goToQuestion(questionId, fromQuestionId) {
    setHistory((h) => [...h, fromQuestionId])
    const nextQuestion = getQuestion(questionId, questions)
    setSelected(nextQuestion?.multi_select ? (answers[questionId] ?? []) : [])
    setScreen({ type: 'question', id: questionId })
  }

  function goToCard(cardId, fromQuestionId) {
    setHistory((h) => [...h, fromQuestionId])
    setScreen({ type: 'card', id: cardId })
  }

  function handleAdvance(optionNext) {
    const resolved = resolveNext(optionNext, questions, cards)
    if (!resolved) return
    if (resolved.type === 'question') goToQuestion(resolved.question.id, currentQuestion.id)
    else goToCard(resolved.card.id, currentQuestion.id)
  }

  function recordAnswer(questionId, optionIds) {
    setAnswers((a) => ({ ...a, [questionId]: optionIds }))
  }

  function handleSingleChoice(option) {
    recordAnswer(currentQuestion.id, [option.id])
    handleAdvance(option.next)
  }

  function toggleMultiSelect(optionId) {
    setSelected((s) => (s.includes(optionId) ? s.filter((id) => id !== optionId) : [...s, optionId]))
  }

  function handleMultiContinue() {
    // Content validation (validateWizardContent) now enforces that every
    // option on a multi-select question shares one `next`, so routing is
    // deterministic regardless of which combination was picked — this just
    // needs any one of the selected options to read `next` from.
    recordAnswer(currentQuestion.id, selected)
    const chosen = currentOptions.find((o) => selected.includes(o.id))
    if (chosen) handleAdvance(chosen.next)
  }

  function handleBack() {
    if (history.length === 0) {
      onExit()
      return
    }
    const prevId = history[history.length - 1]
    const prevQuestion = getQuestion(prevId, questions)
    setHistory((h) => h.slice(0, -1))
    setSelected(prevQuestion?.multi_select ? (answers[prevId] ?? []) : [])
    setScreen({ type: 'question', id: prevId })
  }

  if (screen.type === 'card') {
    const card = cards.find((c) => c.id === screen.id)
    return (
      <div className="wizard-screen wizard-result">
        <div className="app-header">
          <button type="button" className="back" onClick={handleBack} aria-label={t('wizard.back')}>
            ‹
          </button>
          <h1 className="title">{activeLang === 'hi' ? task.title_hi : task.title_en}</h1>
        </div>
        {card ? (
          <ActionCard card={card} forms={forms} />
        ) : (
          <p>{t('wizard.backToHome')}</p>
        )}
        <div className="back-home">
          <button type="button" className="btn-text" onClick={onExitToHome}>
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
        <h1 className="title">{activeLang === 'hi' ? task.title_hi : task.title_en}</h1>
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

      <h2
        className="wizard-question wizard-slide"
        key={currentQuestion.id}
        ref={questionHeadingRef}
        tabIndex={-1}
      >
        {activeLang === 'hi' ? currentQuestion.text_hi : currentQuestion.text_en}
      </h2>
      {/* Visually-hidden live region so screen readers announce the new
          question even for users who land here via something other than
          focus (e.g. a screen reader's own "next heading" navigation,
          which doesn't always trigger on a programmatic .focus() alone). */}
      <div className="sr-only" aria-live="polite">
        {activeLang === 'hi' ? currentQuestion.text_hi : currentQuestion.text_en}
      </div>

      <div className={`chip-row${!currentQuestion.multi_select && currentOptions.length === 2 ? ' stacked' : ''}`}>
        {currentOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`chip${selected.includes(option.id) ? ' sel' : ''}`}
            aria-pressed={currentQuestion.multi_select ? selected.includes(option.id) : undefined}
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
