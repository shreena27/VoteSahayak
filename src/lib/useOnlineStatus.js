import { useEffect, useState } from 'react'

/**
 * Tracks live connectivity via the browser's online/offline events, seeded
 * from `navigator.onLine`. Used to switch Home into its offline state (per
 * the locked mockup's "6a · Offline / slow connection" screen): saved
 * Action Cards stay reachable, everything that needs a live fetch doesn't
 * pretend to work.
 *
 * `navigator.onLine` only reflects actual network-interface state, not
 * "can reach the internet" — a real captive-portal/DNS failure can still
 * report `true`. That's a known, accepted limitation of the browser API
 * itself, not something this hook can correct for.
 * @returns {boolean}
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))

  useEffect(() => {
    function goOnline() {
      setOnline(true)
    }
    function goOffline() {
      setOnline(false)
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}
