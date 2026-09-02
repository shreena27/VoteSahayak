import { useId } from 'react'

// The circular "stamp" on every Action Card. Ported from the locked mockup
// (vote-sahayak-mockups-v1.html) rather than redesigned: three concentric
// rings, "VOTE SAHAYAK" curved along a top arc, three stars, and a two-line
// label (e.g. "CHECKED" / "01 SEP 2026"). Both text lines carry an explicit
// `textLength` so they physically cannot overflow the inner circle no
// matter what font a device substitutes — this project hit that exact bug
// once already (mid-range Android + Noto Sans Devanagari overran the ring)
// and fixed it the same way; don't drop the constraint when touching this.
//
// The seal's own text ("CHECKED" / "VERIFIED", "VOTE SAHAYAK") stays fixed
// English by design, like a real ink stamp's engraving — it is not run
// through t(), unlike the rest of the card.
export function Seal({ label, date }) {
  const dateText = formatSealDate(date)
  // Two Seals can render on the same page (App.jsx currently shows every
  // card in cards.json) — a hardcoded "sealArcTop" id would collide across
  // instances, so each instance gets its own via useId().
  const arcId = `sealArcTop-${useId()}`
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label={`${label} ${dateText}`}>
      <circle cx="60" cy="60" r="55" fill="none" stroke="currentColor" strokeWidth="4.5" strokeDasharray="3.5 4.2" />
      <circle cx="60" cy="60" r="49" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="60" cy="60" r="34" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <defs>
        <path id={arcId} d="M22.5,60 A37.5,37.5 0 0 1 97.5,60" />
      </defs>
      <text fontSize="9.8" fontWeight="700" letterSpacing="2.2" fill="currentColor">
        <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
          VOTE SAHAYAK
        </textPath>
      </text>
      <text x="60" y="97" fontSize="9" textAnchor="middle" fill="currentColor">
        {'★ ★ ★'}
      </text>
      <text
        x="60"
        y="59"
        fontSize="11.8"
        fontWeight="800"
        textAnchor="middle"
        textLength="46"
        lengthAdjust="spacingAndGlyphs"
        fill="currentColor"
      >
        {label}
      </text>
      <text
        x="60"
        y="72"
        fontSize="7.6"
        fontWeight="600"
        textAnchor="middle"
        textLength="44"
        lengthAdjust="spacingAndGlyphs"
        fill="currentColor"
      >
        {dateText}
      </text>
    </svg>
  )
}

/** "2026-09-01" -> "01 SEP 2026", matching the mockup's seal date format. */
function formatSealDate(isoDate) {
  const [y, m, d] = isoDate.split('-')
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${d} ${months[Number(m) - 1]} ${y}`
}
