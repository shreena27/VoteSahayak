import { useEffect, useRef, useState } from 'react'
import { useLanguage, useTranslation } from '../i18n/hooks.js'
import tasks from '../content/tasks.json'
import './shared.css'
import './Home.css'

/**
 * Screen 4a from the locked mockup: the task picker shown between Home's
 * "My details are wrong, or I've moved" row and the actual wizard, so a
 * user who moved doesn't get force-routed into the "correct my details"
 * branch. Only the tasks that actually have real content (`tasks.json`) are
 * real destinations; "New registration" (Form 6) has no authored content
 * yet — that's Phase 2 step 8a's job, not this screen's — so it gets the
 * same honest "not built yet" treatment Home already uses for the SIR-check
 * row and the chat bubble, rather than a dead link or fabricated content.
 *
 * @param {{ onSelectTask: (taskId: string) => void, onBack: () => void }} props
 */
export function TaskPicker({ onSelectTask, onBack }) {
  const { lang } = useLanguage()
  const { t } = useTranslation()
  const activeLang = lang ?? 'en'
  const [comingSoon, setComingSoon] = useState(null)
  const headingRef = useRef(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <div className="home-screen">
      <div className="app-header">
        <button type="button" className="back" onClick={onBack} aria-label={t('wizard.back')}>
          ‹
        </button>
        <h1 className="title" ref={headingRef} tabIndex={-1}>
          {t('wizard.taskPicker.title')}
        </h1>
      </div>

      {comingSoon && (
        <div className="urgency-strip" style={{ background: 'var(--surface-alt)', borderColor: 'var(--border-strong)' }} role="status">
          <div className="glyph" aria-hidden="true">
            🚧
          </div>
          <div className="txt">{comingSoon}</div>
        </div>
      )}

      {tasks.map((task) => (
        <button key={task.id} type="button" className="menu-row" onClick={() => onSelectTask(task.id)}>
          <div className="ico" aria-hidden="true">
            {task.icon}
          </div>
          <div className="txt">
            <h2>{activeLang === 'hi' ? task.title_hi : task.title_en}</h2>
            <p>{activeLang === 'hi' ? task.subtitle_hi : task.subtitle_en}</p>
          </div>
          <div className="chev" aria-hidden="true">
            ›
          </div>
        </button>
      ))}

      <button type="button" className="menu-row" onClick={() => setComingSoon(t('home.sirComingSoon'))}>
        <div className="ico" aria-hidden="true">
          🆕
        </div>
        <div className="txt">
          <h2>{t('wizard.taskPicker.newReg.title')}</h2>
          <p>{t('wizard.taskPicker.newReg.subtitle')}</p>
        </div>
        <div className="chev" aria-hidden="true">
          ›
        </div>
      </button>
    </div>
  )
}
