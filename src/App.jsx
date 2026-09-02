import { useLanguage, useTranslation } from './i18n/hooks.js'
import { ActionCard } from './components/ActionCard.jsx'
import forms from './content/forms.json'
import cards from './content/cards.json'

function App() {
  const { lang, setLang } = useLanguage()
  const { t } = useTranslation()

  return (
    <main className="min-h-screen flex flex-col items-center gap-6 py-8 px-4">
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--accent-ink)' }}>
          {t('app.name')}
        </h1>
        <p style={{ color: 'var(--ink-secondary)' }}>{t('app.tagline')}</p>

        {/* Temporary: proves the i18n plumbing end-to-end. The real language-picker
            screen (a later build step) replaces this. */}
        <div className="flex gap-2 mt-1" data-testid="lang-toggle">
          <button
            type="button"
            onClick={() => setLang('en')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: lang === 'en' ? 'var(--accent-soft)' : 'var(--surface)',
            }}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLang('hi')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: lang === 'hi' ? 'var(--accent-soft)' : 'var(--surface)',
            }}
          >
            हिन्दी
          </button>
        </div>
      </div>

      {/* Temporary: proves the Action Card renders every real card in cards.json
          off the schema, in both languages. The real wizard/SIR-flow screens
          that produce a card (a later build step) replace this list. */}
      <div className="flex flex-col items-center gap-8 w-full" data-testid="action-card-demo">
        {cards.map((card) => (
          <ActionCard key={card.id} card={card} forms={forms} />
        ))}
      </div>
    </main>
  )
}

export default App
