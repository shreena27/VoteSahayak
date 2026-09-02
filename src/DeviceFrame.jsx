import { useEffect, useState } from 'react'
import './App.css'

/* Desktop-only phone-frame chrome around the real app. Below the frame's own
   640px breakpoint (App.css) this whole component still renders, but every
   element here is visually a no-op — same reasoning as App.css itself: real
   phone users are the actual audience and must see zero difference.

   The status bar's clock/signal/wifi/battery are decorative hardware
   chrome, not real content — aria-hidden, and never anything a screen-reader
   user needs announced. Time is the visitor's own real local time (their
   desktop clock), not a fixed placeholder, since a hardcoded "9:41" reads as
   fake the moment anyone looks twice. */

function SignalIcon() {
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="none" aria-hidden="true">
      <rect x="0" y="7" width="2.6" height="4" rx="0.6" fill="currentColor" />
      <rect x="4.4" y="5" width="2.6" height="6" rx="0.6" fill="currentColor" />
      <rect x="8.8" y="2.5" width="2.6" height="8.5" rx="0.6" fill="currentColor" />
      <rect x="13.2" y="0" width="2.6" height="11" rx="0.6" fill="currentColor" />
    </svg>
  )
}

function WifiIcon() {
  return (
    <svg width="15" height="11" viewBox="0 0 15 11" fill="none" aria-hidden="true">
      <path d="M1 4C5 0.3 10 0.3 14 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3.3 6.6C6 4.2 9 4.2 11.7 6.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7.5" cy="9.4" r="1.2" fill="currentColor" />
    </svg>
  )
}

function BatteryIcon() {
  return (
    <svg width="24" height="11" viewBox="0 0 24 11" fill="none" aria-hidden="true">
      <rect x="0.75" y="0.75" width="19.5" height="9.5" rx="2.5" stroke="currentColor" strokeWidth="1.1" opacity="0.5" />
      <rect x="2.3" y="2.3" width="14.5" height="6.4" rx="1.2" fill="currentColor" />
      <rect x="21" y="3.5" width="2" height="4" rx="1" fill="currentColor" opacity="0.5" />
    </svg>
  )
}

/**
 * @param {{ children: React.ReactNode, fixedOverlay?: React.ReactNode }} props
 *   `fixedOverlay` renders as a sibling of the scrollable area, inside
 *   .app-frame — for position:fixed content (chat bubble, update toast)
 *   that must stay pinned to the frame, not scroll away with `children`.
 */
export function DeviceFrame({ children, fixedOverlay }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="app-frame-backdrop">
      <div className="app-frame-shell">
        <div className="app-frame">
          <div className="app-frame-statusbar" aria-hidden="true">
            <span className="time">{now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="icons">
              <SignalIcon />
              <WifiIcon />
              <BatteryIcon />
            </span>
          </div>
          <div className="app-frame-scroll">{children}</div>
          {fixedOverlay}
        </div>
      </div>
    </div>
  )
}
