import { useState } from 'react'
import { useLanguage, useTranslation } from '../i18n/hooks.js'
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
 * "equal peer" decision), but neither has a working destination yet: the SIR
 * flow is Phase 2 step 9 and Chunav Saathi is Phase 3 step 12. Tapping either
 * shows an honest "not built yet" notice instead of doing nothing or
 * navigating somewhere broken.
 *
 * @param {{ onStartTask: (taskId: string) => void }} props
 */
export function Home({ onStartTask }) {
  const { lang } = useLanguage()
  const { t } = useTranslation()
  const activeLang = lang ?? 'en'
  const [comingSoon, setComingSoon] = useState(null)

  const update = updates[0] ?? null

  return (
    <div className="home-screen">
      <div className="home-title">{t('app.name')}</div>

      {update && (
        <div className="urgency-strip">
          <div className="glyph" aria-hidden="true">
            📅
          </div>
          <div className="txt">{activeLang === 'hi' ? update.text_hi : update.text_en}</div>
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

      <button type="button" className="menu-row" onClick={() => setComingSoon(t('home.sirComingSoon'))}>
        <div className="ico" aria-hidden="true">
          🔍
        </div>
        <div className="txt">
          <h3>{t('home.sirRow.title')}</h3>
          <p>{t('home.sirRow.subtitle')}</p>
        </div>
        <div className="chev" aria-hidden="true">
          ›
        </div>
      </button>

      <button type="button" className="menu-row" onClick={() => onStartTask('correct-details')}>
        <div className="ico" aria-hidden="true">
          📝
        </div>
        <div className="txt">
          <h3>{t('home.wizardRow.title')}</h3>
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
