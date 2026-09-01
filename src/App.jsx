import { useLanguage, useTranslation } from './i18n/hooks.js'

function App() {
  const { lang, setLang } = useLanguage()
  const { t } = useTranslation()

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-3">
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--accent-ink)' }}>
        {t('app.name')}
      </h1>
      <p style={{ color: 'var(--ink-secondary)' }}>{t('app.tagline')}</p>

      {/* Temporary: proves the i18n plumbing end-to-end. The real language-picker
          screen (a later build step) replaces this. */}
      <div className="flex gap-2 mt-4" data-testid="lang-toggle">
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
    </main>
  )
}

export default App
