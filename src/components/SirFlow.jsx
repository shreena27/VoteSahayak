import { useEffect, useRef, useState } from 'react'
import { useLanguage, useTranslation } from '../i18n/hooks.js'
import { generateNameVariants } from '../lib/nameVariants.js'
import { formatDisplayDate } from '../content/schema.js'
import { trackFlowStarted, trackSirOutcomePicked, trackOfficialLinkTapped } from '../lib/analytics.js'
import { ActionCard } from './ActionCard.jsx'
import states from '../content/states.json'
import cards from '../content/cards.json'
import forms from '../content/forms.json'
import './shared.css'
import './Wizard.css'
import './SirFlow.css'

// There's no live database this app (or anyone else) can query for SIR
// status — confirmed directly against apisetu.gov.in/data.gov.in during this
// project's research, and re-confirmed by a live walkthrough of the real
// portal. So this whole flow is a guided redirect-and-interpret: prep the
// citizen with exactly what the official search needs (only State + Elector
// Full Name + CAPTCHA are actually required on the real form; everything
// else on that page is optional narrowing), send them to the real site, and
// hand back a calm, accurate explanation for whatever they saw there.
// Outcome ids match the ERD's SIR_OUTCOME.id enum exactly (`found-active`,
// `found-inactive`, `found-misspelled`, `not-found`, `could-not-complete`)
// and are used verbatim as: this map's keys, each card's id suffix, the
// i18n string key suffix, and the Mixpanel `sir_outcome_picked` payload
// value — one vocabulary everywhere, not translated between layers, so a
// funnel query can actually join outcome events to card views.
const OUTCOME_TO_CARD_ID = {
  'found-active': 'card-sir-found-active',
  'found-inactive': 'card-sir-found-inactive',
  'found-misspelled': 'card-sir-found-misspelled',
  'not-found': 'card-sir-not-found',
  'could-not-complete': 'card-sir-could-not-complete',
}

const OUTCOME_ORDER = ['found-active', 'found-inactive', 'found-misspelled', 'not-found', 'could-not-complete']
const OUTCOME_GLYPH = { 'found-active': '✓', 'found-inactive': '⚠', 'found-misspelled': '✎', 'not-found': '✕', 'could-not-complete': '↻' }
const OUTCOME_TONE_CLASS = {
  'found-active': 'ok',
  'found-inactive': 'accent',
  'found-misspelled': 'amber',
  'not-found': 'danger',
  'could-not-complete': 'neutral',
}

// The real SIR search deep link (not just the base portal) — confirmed live
// (200) directly, not assumed. There's no live API to keep this current
// (re-confirmed elsewhere in this project's research), so it's a curated,
// dated value like every other official URL in this app's content, not a
// live-fetched one.
const OFFICIAL_SIR_SEARCH_URL = 'https://voters.eci.gov.in/searchinsir/s2ua4dpdf-jk4qwodse'
const OFFICIAL_SIR_SEARCH_URL_VERIFIED_ON = '2026-09-02'

/**
 * The SIR (Special Intensive Revision) risk-check flow — Phase 2 step 9.
 * Screens: name entry (+ spelling-variant suggestions) -> state pick ->
 * redirect cheat-sheet -> outbound link to the real official search -> "what
 * did you see?" 5-outcome picker -> a calm, accurate Action Card for
 * whichever outcome was picked.
 *
 * `‹` steps back one screen at a time, same back/history pattern as Wizard;
 * only exits the whole flow (to Home) once there's no previous screen left.
 *
 * @param {{ onExitToHome: () => void, onStartTask: (taskId: string) => void }} props
 *   `onStartTask` routes into the Wizard for a given task id — used from the
 *   "found, spelled differently" outcome card to send the citizen straight
 *   into the correction flow instead of leaving them with nowhere to act on
 *   a confirmed spelling mismatch.
 */
export function SirFlow({ onExitToHome, onStartTask }) {
  const { lang } = useLanguage()
  const { t } = useTranslation()
  const activeLang = lang ?? 'en'

  const [screen, setScreen] = useState('name')
  const [history, setHistory] = useState([])
  const [name, setName] = useState('')
  const [stateCode, setStateCode] = useState('')
  const [district, setDistrict] = useState('')
  const [showDistrictField, setShowDistrictField] = useState(false)
  const [outcomeId, setOutcomeId] = useState(null)

  useEffect(() => {
    trackFlowStarted('sir-check')
  }, [])

  const headingRef = useRef(null)
  useEffect(() => {
    // 'card' intentionally has no target here — ActionCard focuses its own
    // headline on mount (see the comment on the h1 above).
    if (screen !== 'card') headingRef.current?.focus()
  }, [screen])

  const variants = name.trim() ? generateNameVariants(name) : []
  const selectedState = states.find((s) => s.code === stateCode) ?? null
  const stateName = selectedState ? (activeLang === 'hi' ? selectedState.name_hi : selectedState.name_en) : ''

  function goTo(next) {
    setHistory((h) => [...h, screen])
    setScreen(next)
  }

  function handleBack() {
    if (history.length === 0) {
      onExitToHome()
      return
    }
    const prev = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    setScreen(prev)
  }

  function handleOpenOfficialSearch() {
    trackOfficialLinkTapped('sir-search')
    window.open(OFFICIAL_SIR_SEARCH_URL, '_blank', 'noopener,noreferrer')
  }

  function handlePickOutcome(id) {
    trackSirOutcomePicked(id)
    setOutcomeId(id)
    goTo('card')
  }

  function handleOpenNotice() {
    trackFlowStarted('sir-notice')
    goTo('notice')
  }

  const TITLE_BY_SCREEN = {
    name: t('sir.title'),
    state: t('sir.title'),
    cheatsheet: t('sir.title'),
    outcomes: t('sir.outcomes.title'),
    card: t('sir.result.title'),
    notice: t('sir.notice.title'),
  }

  return (
    <div className="wizard-screen sir-flow">
      <div className="app-header">
        <button type="button" className="back" onClick={handleBack} aria-label={t('wizard.back')}>
          ‹
        </button>
        {/* Outcomes is the one screen with no more specific on-page heading
            of its own (its whole body is a list of tappable outcome cards),
            so the app-header title itself is the focus target there. Every
            other screen focuses its own more specific content below — see
            each screen's own ref. The card screen focuses nothing here;
            ActionCard manages its own headline focus on mount, same pattern
            Wizard.jsx already uses for its card screen. */}
        <h1 className="title" ref={screen === 'outcomes' ? headingRef : undefined} tabIndex={screen === 'outcomes' ? -1 : undefined}>
          {TITLE_BY_SCREEN[screen]}
        </h1>
      </div>

      {screen === 'name' && (
        <div className="wizard-slide">
          <div className="preflight">
            <div className="glyph" aria-hidden="true">
              🗂️
            </div>
            <div className="txt">
              <b>{t('sir.preflight.title')}</b>
              {t('sir.preflight.body')}
            </div>
          </div>

          <div className="field">
            {/* Focus target for this screen: the field label is the actual
                "new content" a keyboard/screen-reader user needs announced,
                same role the wizard question heading plays for its screens
                — the app-header's h1 above stays "Check my SIR risk" across
                three screens in a row, so it isn't a useful focus target on
                its own here. */}
            <label htmlFor="sir-name" ref={headingRef} tabIndex={-1}>
              {t('sir.name.label')}
            </label>
            <input id="sir-name" type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            <div className="helper">{t('sir.name.helper')}</div>
          </div>

          {variants.length > 0 && (
            <div className="variant-box">
              <div className="lbl">{t('sir.variants.label')}</div>
              <div className="variant-list">
                {variants.map((v) => (
                  <span className="variant-chip" key={v}>
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 26 }}>
            <button type="button" className="btn-primary" disabled={!name.trim()} onClick={() => goTo('state')}>
              {t('wizard.continue')}
            </button>
          </div>
          <div style={{ marginTop: 14, textAlign: 'center' }}>
            <button type="button" className="btn-text" onClick={handleOpenNotice}>
              {t('sir.noticeLink')}
            </button>
          </div>
        </div>
      )}

      {screen === 'notice' && (
        <div className="wizard-result">
          {(() => {
            const card = cards.find((c) => c.id === 'card-sir-notice')
            if (!card) return <p>{t('wizard.backToHome')}</p>
            return <ActionCard card={card} forms={forms} />
          })()}
          <div className="back-home">
            <button type="button" className="btn-text" onClick={onExitToHome}>
              {t('wizard.backToHome')}
            </button>
          </div>
        </div>
      )}

      {screen === 'state' && (
        <div className="wizard-slide">
          <div className="field">
            <label htmlFor="sir-state" ref={headingRef} tabIndex={-1}>
              {t('sir.state.label')}
            </label>
            <select id="sir-state" value={stateCode} onChange={(e) => setStateCode(e.target.value)}>
              <option value="" disabled>
                {t('sir.state.placeholder')}
              </option>
              {states.map((s) => (
                <option key={s.code} value={s.code}>
                  {activeLang === 'hi' ? s.name_hi : s.name_en}
                </option>
              ))}
            </select>
          </div>

          {showDistrictField ? (
            <div className="field">
              <label htmlFor="sir-district">{t('sir.district.label')}</label>
              <input
                id="sir-district"
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              />
            </div>
          ) : (
            <div className="field">
              <label className="muted-label">{t('sir.district.label')}</label>
              <button type="button" className="btn-text" style={{ padding: '2px 0' }} onClick={() => setShowDistrictField(true)}>
                {t('sir.district.add')}
              </button>
            </div>
          )}

          <div style={{ marginTop: 26 }}>
            <button type="button" className="btn-primary" disabled={!stateCode} onClick={() => goTo('cheatsheet')}>
              {t('wizard.continue')}
            </button>
          </div>
        </div>
      )}

      {screen === 'cheatsheet' && (
        <div className="wizard-slide">
          <p className="cheatsheet-intro" ref={headingRef} tabIndex={-1}>
            {t('sir.cheatsheet.intro')}
          </p>
          <div className="cheat-box">
            <div className="cheat-row">
              <span className="k">{t('sir.cheatsheet.state')}</span>
              <span className="v">{stateName}</span>
            </div>
            <div className="cheat-row">
              <span className="k">{t('sir.cheatsheet.name')}</span>
              <span className="v">{name}</span>
            </div>
            {district && (
              <div className="cheat-row">
                <span className="k">{t('sir.district.label')}</span>
                <span className="v">{district}</span>
              </div>
            )}
            <div className="cheat-row">
              <span className="k">{t('sir.cheatsheet.captcha')}</span>
              <span className="v">{t('sir.cheatsheet.captchaValue')}</span>
            </div>
          </div>
          <p className="cheatsheet-note">{t('sir.cheatsheet.captchaNote')}</p>

          {variants.length > 0 && (
            <div className="variant-box">
              <div className="lbl">{t('sir.variants.label')}</div>
              <div className="variant-list">
                {variants.map((v) => (
                  <span className="variant-chip" key={v}>
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 18 }}>
            <button type="button" className="btn-primary" onClick={handleOpenOfficialSearch}>
              {t('sir.cheatsheet.openSearch')}
            </button>
            <div className="cheatsheet-link-verified">
              {t('sir.cheatsheet.linkVerified')} {formatDisplayDate(OFFICIAL_SIR_SEARCH_URL_VERIFIED_ON, activeLang)}
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn-text" onClick={() => goTo('outcomes')}>
              {t('sir.cheatsheet.done')}
            </button>
          </div>
        </div>
      )}

      {screen === 'outcomes' && (
        <div className="wizard-slide">
          {OUTCOME_ORDER.map((id) => (
            <button type="button" key={id} className={`outcome-card tone-${OUTCOME_TONE_CLASS[id]}`} onClick={() => handlePickOutcome(id)}>
              <span className="g" aria-hidden="true">
                {OUTCOME_GLYPH[id]}
              </span>
              <span className="outcome-text">
                <h4>{t(`sir.outcomes.${id}.title`)}</h4>
                <p>{t(`sir.outcomes.${id}.desc`)}</p>
              </span>
            </button>
          ))}
        </div>
      )}

      {screen === 'card' && outcomeId && (
        <div className="wizard-result">
          {(() => {
            const card = cards.find((c) => c.id === OUTCOME_TO_CARD_ID[outcomeId])
            if (!card) return <p>{t('wizard.backToHome')}</p>
            return (
              <ActionCard
                card={card}
                forms={forms}
                tagSuffix={stateName || undefined}
                extraRows={[
                  { k: t('sir.nameChecked'), v: name },
                  ...(stateName ? [{ k: t('sir.stateChecked'), v: stateName }] : []),
                ]}
              />
            )
          })()}
          {outcomeId === 'found-misspelled' && (
            <div style={{ marginTop: 18 }}>
              <button type="button" className="btn-secondary" onClick={() => onStartTask('correct-details')}>
                {t('sir.outcomes.found-misspelled.fixLink')}
              </button>
            </div>
          )}
          {outcomeId === 'not-found' && (
            <div style={{ marginTop: 18 }}>
              <button type="button" className="btn-secondary" onClick={() => onStartTask('new-registration')}>
                {t('sir.outcomes.not-found.registerLink')}
              </button>
            </div>
          )}
          <div className="back-home">
            <button type="button" className="btn-text" onClick={onExitToHome}>
              {t('wizard.backToHome')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
