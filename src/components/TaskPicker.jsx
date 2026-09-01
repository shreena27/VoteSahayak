import { useEffect, useRef } from 'react'
import { useLanguage, useTranslation } from '../i18n/hooks.js'
import tasks from '../content/tasks.json'
import './shared.css'
import './Home.css'

/**
 * Screen 4a from the locked mockup: the task picker shown between Home's
 * "My details are wrong, or I've moved" row and the actual wizard, so a
 * user who moved doesn't get force-routed into the "correct my details"
 * branch. Every task listed here is real, authored content (`tasks.json`) —
 * Phase 2 step 8a completed the full 5-task set (correct-details,
 * update-address, new-registration, remove-name, nri), so there's no
 * remaining "not built yet" stub row on this screen.
 *
 * @param {{ onSelectTask: (taskId: string) => void, onBack: () => void }} props
 */
export function TaskPicker({ onSelectTask, onBack }) {
  const { lang } = useLanguage()
  const { t } = useTranslation()
  const activeLang = lang ?? 'en'
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
    </div>
  )
}
