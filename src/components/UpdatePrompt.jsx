import { useRegisterSW } from 'virtual:pwa-register/react'
import { useTranslation } from '../i18n/hooks.js'
import './shared.css'

// How often an already-open tab re-checks for a waiting service worker.
// The scenario this exists for is a phone that installed the app earlier
// in the day and has just been sitting there — a load-time-only check
// never sees a fix shipped after that load. 30 minutes matches the
// day-of-testing cadence without hammering the update check.
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000

/**
 * Phase 3 step 16: a visible, on-brand "new version available" prompt —
 * deliberately NOT vite-plugin-pwa's autoUpdate mode (see vite.config.js),
 * so the fix round after Friday's test actually reaches phones that
 * installed earlier that day rather than silently queuing behind a tab
 * nobody refreshes. Mounted once at the app root so it can surface on any
 * screen, since an update can become available at any time.
 *
 * Rendered LAST in App.jsx's children (not first) so its buttons don't sit
 * ahead of the real screen's content in tab order while invisible — and
 * the container itself always renders (toggling only `hidden`), rather
 * than mounting fresh once `needRefresh` flips, so the `role="status"`
 * region is genuinely observed changing rather than inserted pre-filled,
 * which is what screen readers reliably announce.
 */
export function UpdatePrompt() {
  const { t } = useTranslation()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // Check on load too, not just on the next visit.
      registration.update()
      // And periodically while the tab stays open (this component mounts
      // once at the app root for the app's lifetime, so there's no unmount
      // to clean this interval up on — that's fine, it's meant to keep
      // running for as long as the tab is open).
      setInterval(() => registration.update(), UPDATE_CHECK_INTERVAL_MS)
    },
  })

  return (
    <div className="update-toast" role="status" hidden={!needRefresh}>
      {needRefresh && (
        <>
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
        </>
      )}
    </div>
  )
}
