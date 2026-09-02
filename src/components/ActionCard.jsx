import { useEffect, useMemo, useRef, useState } from 'react'
import { useLanguage, useTranslation } from '../i18n/hooks.js'
import { isStale, formatDisplayDate } from '../content/schema.js'
import { Seal } from './Seal.jsx'
import { saveCard, isCardSaved } from '../lib/savedCards.js'
import { shareCard, renderCardAsFile } from '../lib/shareCard.js'
import { speak, stopSpeaking, isSpeechSupported } from '../lib/speak.js'
import { trackCardViewed, trackCardSaved, trackCardShared, trackCardListened } from '../lib/analytics.js'
import './ActionCard.css'

const STEP_ICON_MAP = {
  'external-link': '🔗',
  edit: '✏️',
  send: '📮',
  bookmark: '🔖',
  share: '📤',
  info: 'ℹ️',
}

// The seal's own text is a fixed English "stamp engraving" (see Seal.jsx),
// not run through t() — this only picks which of the two words applies.
// No CARD_PAYLOAD field carries this distinction, so it's derived from
// `kind`: sir-outcome is "you checked your status" (CHECKED); everything
// else is guidance/a document response that's been verified (VERIFIED).
const SEAL_LABEL_BY_KIND = {
  'sir-outcome': 'CHECKED',
  'sir-notice': 'VERIFIED',
  'wizard-result': 'VERIFIED',
  'gather-first': 'VERIFIED',
}

/**
 * The Action Card ("parchi") — renders any CARD_PAYLOAD from cards.json.
 * Payload-driven: every visible row, step, document, and rejection tag
 * comes from `card`, nothing is hardcoded to one example.
 *
 * @param {{ card: object, forms?: object[] }} props
 */
export function ActionCard({ card, forms = [] }) {
  const { lang } = useLanguage()
  const { t } = useTranslation()
  const activeLang = lang ?? 'en'
  const cardRef = useRef(null)
  const shareFileRef = useRef(null)
  const headlineRef = useRef(null)
  const [saveState, setSaveState] = useState(() => (isCardSaved(card.id) ? 'saved' : 'idle'))
  const [speaking, setSpeaking] = useState(false)

  const form = useMemo(() => forms.find((f) => f.id === card.form_id) ?? null, [forms, card.form_id])

  const headline = activeLang === 'hi' ? card.headline_hi : card.headline_en
  const meaning = activeLang === 'hi' ? card.meaning_hi : card.meaning_en
  const timeline = activeLang === 'hi' ? card.timeline_hi : card.timeline_en

  const tag = useMemo(() => {
    if (card.kind === 'wizard-result' && form) {
      const formName = activeLang === 'hi' ? form.name_hi : form.name
      return `${t('card.tag.wizardResult')} · ${formName}`
    }
    if (card.kind === 'sir-notice') return t('card.tag.sirNotice')
    if (card.kind === 'gather-first') return t('card.tag.gatherFirst')
    return t('card.tag.sirOutcome')
  }, [card.kind, form, t, activeLang])

  const sealLabel = SEAL_LABEL_BY_KIND[card.kind] ?? 'VERIFIED'
  const stale = isStale(card.verified_on)
  const ttsAvailable = isSpeechSupported()

  const orderedSteps = useMemo(() => [...card.steps].sort((a, b) => a.order - b.order), [card.steps])

  // Fires once per card actually rendering, not per language toggle
  // re-render — card.kind never changes without card.id also changing, so
  // this can't double-count a view on a language switch.
  useEffect(() => {
    trackCardViewed(card.kind)
  }, [card.id, card.kind])

  // Moves focus to the card's own headline whenever a (new) card renders —
  // this is the "new content just appeared" signal for the terminal wizard
  // screen, the same role the question heading's focus plays on every
  // question screen. Keyed on card.id (not mount-only) so this stays correct
  // if a future screen ever reuses one ActionCard instance across cards
  // without unmounting it.
  useEffect(() => {
    headlineRef.current?.focus()
  }, [card.id])

  // Best-effort background render so Share can respond within the same
  // click's user-activation gesture — iOS Safari requires navigator.share()
  // to be called with no `await` ahead of it in the handler, so we can't
  // render the share image on click. renderCardAsFile has its own internal
  // timeout guard, so a stalled render here can't hang the component; it
  // just leaves shareFileRef empty and handleShare falls back to a
  // text-only share. Re-runs on language change so the cached image never
  // shows the wrong language.
  useEffect(() => {
    if (!cardRef.current) return undefined
    let cancelled = false
    renderCardAsFile(cardRef.current).then((file) => {
      if (!cancelled) shareFileRef.current = file
    })
    return () => {
      cancelled = true
    }
  }, [activeLang])

  function handleListen() {
    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
      return
    }
    // The full spoken text, not just the headline/meaning/timeline summary —
    // the document checklist and steps are the actually-actionable part of
    // the card for the low-literacy audience this feature is for.
    const docLines =
      card.document_requirements.length > 0
        ? [t('card.documentsNeeded'), ...card.document_requirements.map((doc) => (activeLang === 'hi' ? doc.label_hi : doc.label_en))]
        : []
    const stepLines = orderedSteps.map((step) => (activeLang === 'hi' ? step.text_hi : step.text_en))
    const spokenText = [headline, meaning, timeline, ...docLines, ...stepLines].filter(Boolean).join('. ')
    const started = speak(spokenText, activeLang, () => setSpeaking(false))
    if (started) {
      setSpeaking(true)
      trackCardListened(card.id)
    }
  }

  function handleSave() {
    const saved = saveCard(card)
    setSaveState(saved ? 'saved' : 'failed')
    if (saved) trackCardSaved(card.id)
  }

  async function handleShare() {
    const officialLink = card.steps.find((s) => s.action_kind === 'url')?.action_value
    const waText = `${headline}\n\n${meaning}${officialLink ? `\n\n${officialLink}` : ''}`
    // Tracked on attempt, not on confirmed completion — JS can't observe
    // whether the native share sheet or the WhatsApp fallback actually
    // finished, only that the user triggered one of them.
    trackCardShared(card.id)
    // No `await` before this call — shareCard's first action is calling
    // navigator.share() synchronously off shareFileRef's already-resolved
    // value (or a text-only share if it isn't ready yet), which is what iOS
    // Safari's user-activation rules require.
    await shareCard({ headline, waText, precomputedFile: shareFileRef.current })
  }

  return (
    <div className="receipt" ref={cardRef}>
      <div className="receipt-inner">
        <span className="receipt-tag">{tag}</span>
        <h2 ref={headlineRef} tabIndex={-1}>
          {headline}
        </h2>
        {ttsAvailable && (
          <button type="button" className="listen-btn" onClick={handleListen} aria-pressed={speaking}>
            {speaking ? t('card.stopListening') : t('card.listen')}
          </button>
        )}

        <div className="receipt-meaning">{meaning}</div>

        <div className="receipt-row stack">
          <span className="k">{t('card.timeline')}</span>
          <span className="v">{timeline}</span>
        </div>

        {card.rejection_tags.length > 0 && (
          <>
            <div className="doclist-heading">{t('card.rejectionsHeading')}</div>
            <div className="receipt-rejects">
              {card.rejection_tags.map((tagItem) => (
                <span key={tagItem.id} className="reject-tag">
                  {activeLang === 'hi' ? tagItem.label_hi : tagItem.label_en}
                </span>
              ))}
            </div>
          </>
        )}

        {card.document_requirements.length > 0 && (
          <>
            <div className="doclist-heading">{t('card.documentsNeeded')}</div>
            <ul className="receipt-doclist">
              {card.document_requirements.map((doc) => (
                <li key={doc.id}>
                  <span className="box" />
                  <span>
                    {activeLang === 'hi' ? doc.label_hi : doc.label_en}
                    {doc.any_one_of && <span className="any-one-of">{t('card.documentsAnyOneOf')}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <ol className="receipt-steps">
          {orderedSteps.map((step, i) => (
            <li key={step.id}>
              <span className="n">{i + 1}</span>
              <span className="step-ico" aria-hidden="true">{STEP_ICON_MAP[step.icon] ?? '•'}</span>
              <span className="body">
                {activeLang === 'hi' ? step.text_hi : step.text_en}
                <br />
                {step.action_kind === 'tel' && (
                  <a className="step-act" href={step.action_value}>
                    {step.action_value.replace('tel:', '')}
                  </a>
                )}
                {step.action_kind === 'url' && (
                  <a className="step-act" href={step.action_value} target="_blank" rel="noopener noreferrer">
                    {t('card.open')}
                  </a>
                )}
                {step.action_kind === 'save' && (
                  <>
                    <button type="button" className="step-act" onClick={handleSave}>
                      {saveState === 'saved' ? t('card.saved') : saveState === 'failed' ? t('card.saveFailed') : t('card.save')}
                    </button>
                    {/* Visually redundant with the button's own label change
                        above — this exists so a screen-reader user hears the
                        save confirmation without having to re-focus the
                        button. */}
                    <span className="visually-hidden" role="status" aria-live="polite">
                      {saveState === 'saved' ? t('card.saveAnnounce') : ''}
                    </span>
                  </>
                )}
                {step.action_kind === 'share' && (
                  <button type="button" className="step-act" onClick={handleShare}>
                    {t('card.shareWhatsapp')}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ol>

        <div className="stamp-row">
          <div className="stamp">
            <Seal label={sealLabel} date={card.verified_on} />
          </div>
        </div>

        <div className="receipt-footer">
          <span>
            {activeLang === 'hi' ? card.source_line_hi : card.source_line} · {t('card.verified')} {formatDisplayDate(card.verified_on, activeLang)}
            {stale && <span className="stale-flag">{t('card.stale')}</span>}
          </span>
          <span>{t('card.helpline')}</span>
        </div>

        <div className="receipt-actions">
          <button type="button" className="btn-wa" onClick={handleShare}>
            <WhatsAppIcon />
            {t('card.shareWhatsapp')}
          </button>
        </div>
      </div>
    </div>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 16, height: 16 }} aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.9-1.4A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4l.9 2.1c.1.2.1.4 0 .6l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l2 .9c.2.1.4.2.4.3 0 .1 0 .5-.2 1.1z" />
    </svg>
  )
}
