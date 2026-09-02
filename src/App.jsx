import { useState } from 'react'
import { useLanguage, useTranslation } from './i18n/hooks.js'
import { Home } from './components/Home.jsx'
import { TaskPicker } from './components/TaskPicker.jsx'
import { Wizard } from './components/Wizard.jsx'
import { SirFlow } from './components/SirFlow.jsx'
import { Chat } from './components/Chat.jsx'
import { ActionCard } from './components/ActionCard.jsx'
import { UpdatePrompt } from './components/UpdatePrompt.jsx'
import forms from './content/forms.json'

function App() {
  const { lang, setLang } = useLanguage()
  const { t } = useTranslation()
  // 'home' | 'picker' | 'wizard' | 'sir' | 'chat' | 'savedCard' — the picker is its
  // own step between Home's wizard-entry row and the actual wizard, so Back
  // from the wizard's first question returns to the picker (to try a
  // different task), not all the way past it to Home. 'sir' owns its own
  // internal screen stack (SirFlow), same as 'wizard' does for Wizard.
  // 'savedCard' renders a device-local SAVED_CARD snapshot straight from
  // Home's offline state — deliberately NOT routed through Wizard/SirFlow's
  // own card lookups, since a saved snapshot must render exactly as it was
  // when saved, not whatever cards.json says today (the ERD's own rule).
  const [view, setView] = useState('home')
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [activeSavedCard, setActiveSavedCard] = useState(null)

  return (
    <>
      {/* Temporary: proves the i18n plumbing end-to-end and lets both
          languages be reviewed on the real Home/Wizard screens below. The
          real language-picker screen (a later build step) replaces this. */}
      <div className="flex justify-center gap-2 py-2" data-testid="lang-toggle" style={{ borderBottom: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={() => setLang('en')}
          style={{
            padding: '4px 12px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: lang === 'en' ? 'var(--accent-soft)' : 'var(--surface)',
            fontSize: '12px',
          }}
        >
          English
        </button>
        <button
          type="button"
          onClick={() => setLang('hi')}
          style={{
            padding: '4px 12px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: lang === 'hi' ? 'var(--accent-soft)' : 'var(--surface)',
            fontSize: '12px',
          }}
        >
          हिन्दी
        </button>
      </div>

      {!lang ? (
        <main className="min-h-screen flex items-center justify-center">
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--accent-ink)' }}>
            {t('app.name')}
          </h1>
        </main>
      ) : view === 'wizard' ? (
        <Wizard
          taskId={activeTaskId}
          onExit={() => setView('picker')}
          onExitToHome={() => setView('home')}
        />
      ) : view === 'picker' ? (
        <TaskPicker
          onSelectTask={(taskId) => {
            setActiveTaskId(taskId)
            setView('wizard')
          }}
          onBack={() => setView('home')}
        />
      ) : view === 'sir' ? (
        <SirFlow
          onExitToHome={() => setView('home')}
          onStartTask={(taskId) => {
            setActiveTaskId(taskId)
            setView('wizard')
          }}
        />
      ) : view === 'chat' ? (
        <Chat onClose={() => setView('home')} onOpenSir={() => setView('sir')} />
      ) : view === 'savedCard' && activeSavedCard ? (
        <div className="wizard-screen">
          <div className="app-header">
            <button type="button" className="back" onClick={() => setView('home')} aria-label={t('wizard.back')}>
              ‹
            </button>
            <h1 className="title">{t('offline.savedCardsHeading')}</h1>
          </div>
          <div className="wizard-result">
            <ActionCard card={activeSavedCard.payload_snapshot} forms={forms} />
            <div className="back-home">
              <button type="button" className="btn-text" onClick={() => setView('home')}>
                {t('wizard.backToHome')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <Home
          onOpenPicker={() => setView('picker')}
          onOpenSir={() => setView('sir')}
          onOpenChat={() => setView('chat')}
          onOpenSavedCard={(entry) => {
            setActiveSavedCard(entry)
            setView('savedCard')
          }}
        />
      )}

      {/* Rendered last, not first: the toast's own container always exists
          in the DOM (see UpdatePrompt.jsx) so its buttons don't sit ahead
          of the real screen's content in tab order while invisible. */}
      <UpdatePrompt />
    </>
  )
}

export default App
