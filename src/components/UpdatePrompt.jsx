import { useRegisterSW } from 'virtual:pwa-register/react'
import { useTranslation } from '../i18n/hooks.js'
import './shared.css'

/**
 * Phase 3 step 16: a visible, on-brand "new version available" prompt —
 * deliberately NOT vite-plugin-pwa's autoUpdate mode (see vite.config.js),
 * so the fix round after Friday's test actually reaches phones that
 * installed earlier that day rather than silently queuing behind a tab
 * nobody refreshes. Mounted once at the app root so it can surface on any
 * screen, since an update can become available at any time.
 */
export function UpdatePrompt() {
  const { t } = useTranslation()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for a waiting worker on load too, not just on the next visit —
      // matters for the "test the update path once before testing day"
      // requirement: a manual refresh right after deploying a fix should
      // surface the prompt immediately, not only on some later visit.
      registration?.update()
    },
  })

  if (!needRefresh) return null

  return (
    <div className="update-toast" role="status">
      <div className="txt">
        <b>{t('update.title')}</b>
        {t('update.body')}
      </div>
      <div className="actions">
        <button type="button" className="dismiss" onClick={() => setNeedRefresh(false)}>
          {t('update.dismiss')}
        </button>
        <button type="button" className="reload" onClick={() => updateServiceWorker(true)}>
          {t('update.reload')}
        </button>
      </div>
    </div>
  )
}
