import { useState } from 'react'
import { useLanguage, useTranslation } from '../i18n/hooks.js'
import { formatDisplayDate } from '../content/schema.js'
import { useOnlineStatus } from '../lib/useOnlineStatus.js'
import { readSavedCards } from '../lib/savedCards.js'
import updates from '../content/updates.json'
import './shared.css'
import './Home.css'

/**
 * The Home screen — a deliberate 2-row PEER menu (SIR-check row is not made
 * visually dominant, even though it's the more time-sensitive one; that
 * trade-off was discussed and locked, not an oversight) plus a dated urgency
 * strip and a persistent chat companion bubble.
 *
 * The SIR-check row and the chat bubble are both real, fully-styled per the
 * locked design (not dimmed — dimming one row would itself violate the
 * "equal peer" decision). The SIR flow is real as of Phase 2 step 9; Chunav
 * Saathi is still Phase 3 step 12, so its bubble still shows an honest "not
 * built yet" notice rather than doing nothing or navigating somewhere
 * broken.
 *
 * While offline, this swaps the urgency strip + menu rows for the locked
 * mockup's "6a · Offline / slow connection" state: an offline banner plus
 * the list of saved Action Cards (device-local, so they render with zero
 * network) — per the PRD's own offline edge case ("offline renders saved
 * cards"). The chat bubble still shows (it's just an honest stub either
 * way, nothing there depends on connectivity).
 *
 * @param {{ onOpenPicker: () => void, onOpenSir: () => void, onOpenSavedCard: (entry: {id: string, payload_snapshot: object, saved_on: string}) => void }} props
 */
export function Home({ onOpenPicker, onOpenSir, onOpenSavedCard }) {
  const { lang } = useLanguage()
  const { t } = useTranslation()
  const activeLang = lang ?? 'en'
  const [comingSoon, setComingSoon] = useState(null)
  const online = useOnlineStatus()

  const update = updates[0] ?? null
  const savedCards = online ? [] : readSavedCards()

  if (!online) {
    return (
      <div className="home-screen">
        <h1 className="home-title">{t('app.name')}</h1>

        <div className="offline-banner" role="status">
          <div className="glyph" aria-hidden="true">
            📡
          </div>
          <div className="txt">
            <b>{t('offline.title')}</b>
            {t('offline.body')}
            <br />
            <br />
            <button type="button" className="btn-text" style={{ padding: 0 }} onClick={() => window.location.reload()}>
              {t('offline.retry')}
            </button>
          </div>
        </div>

        <div className="saved-cards-heading">{t('offline.savedCardsHeading')}</div>
        {savedCards.length === 0 ? (
          <p className="saved-cards-empty">{t('offline.savedCardsEmpty')}</p>
        ) : (
          savedCards.map((entry) => {
            const payload = entry.payload_snapshot
            const headline = activeLang === 'hi' ? payload.headline_hi : payload.headline_en
            return (
              <button type="button" key={entry.id} className="saved-card-summary" onClick={() => onOpenSavedCard(entry)}>
                <span className="receipt-tag">{t(`card.tag.${toTagKey(payload.kind)}`)}</span>
                <h3>{headline}</h3>
                <div className="saved-on">
                  {t('offline.savedOn')} {formatDisplayDate(entry.saved_on, activeLang)}
                </div>
              </button>
            )
          })
        )}

        <button type="button" className="chat-bubble" onClick={() => setComingSoon(t('home.chatComingSoon'))}>
          <span className="avi" aria-hidden="true">
            🗳️
          </span>
          {t('chat.name')}
        </button>
        {comingSoon && (
          <div className="urgency-strip" style={{ background: 'var(--surface-alt)', borderColor: 'var(--border-strong)' }} role="status">
            <div className="glyph" aria-hidden="true">
              🚧
            </div>
            <div className="txt">{comingSoon}</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="home-screen">
      <h1 className="home-title">{t('app.name')}</h1>

      {update && (
        <div className="urgency-strip">
          <div className="glyph" aria-hidden="true">
            📅
          </div>
          <div className="txt">
            <b>{activeLang === 'hi' ? update.headline_hi : update.headline_en}</b>
            {activeLang === 'hi' ? update.text_hi : update.text_en}
            <span className="verified">
              {t('card.verified')} {formatDisplayDate(update.verified_on, activeLang)}
            </span>
          </div>
        </div>
      )}

      {comingSoon && (
        <div className="urgency-strip" style={{ background: 'var(--surface-alt)', borderColor: 'var(--border-strong)' }} role="status">
          <div className="glyph" aria-hidden="true">
            🚧
          </div>
          <div className="txt">{comingSoon}</div>
        </div>
      )}

      <button type="button" className="menu-row" onClick={onOpenSir}>
        <div className="ico" aria-hidden="true">
          🔍
        </div>
        <div className="txt">
          <h2>{t('home.sirRow.title')}</h2>
          <p>{t('home.sirRow.subtitle')}</p>
        </div>
        <div className="chev" aria-hidden="true">
          ›
        </div>
      </button>

      <button type="button" className="menu-row" onClick={onOpenPicker}>
        <div className="ico" aria-hidden="true">
          📝
        </div>
        <div className="txt">
          <h2>{t('home.wizardRow.title')}</h2>
          <p>{t('home.wizardRow.subtitle')}</p>
        </div>
        <div className="chev" aria-hidden="true">
          ›
        </div>
      </button>

      <button type="button" className="chat-bubble" onClick={() => setComingSoon(t('home.chatComingSoon'))}>
        <span className="avi" aria-hidden="true">
          🗳️
        </span>
        {t('chat.name')}
      </button>
    </div>
  )
}

// Maps a CARD_PAYLOAD.kind to the `card.tag.*` string-key suffix ActionCard
// itself uses (see ActionCard.jsx's own `tag` derivation) — kept in sync by
// hand since there are only 4 kinds and adding a 5th is rare enough that a
// shared lookup table isn't worth the extra module for one 4-line map.
const TAG_KEY_BY_KIND = {
  'sir-outcome': 'sirOutcome',
  'sir-notice': 'sirNotice',
  'wizard-result': 'wizardResult',
  'gather-first': 'gatherFirst',
}

function toTagKey(kind) {
  return TAG_KEY_BY_KIND[kind] ?? 'sirOutcome'
}
