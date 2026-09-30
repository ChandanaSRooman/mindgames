/**
 * The free-text date/time labels the UI renders for a mentorship session,
 * derived from the real timestamp so the two can never disagree. If the card
 * said "Thu 12 Jun" while scheduled_at pointed at Friday, the reminder would
 * fire on the day nobody was expecting.
 *
 * Formatted in IST because that is what every label already in the table
 * says, and what the audience is in. Shared by the edit route and the seed.
 * The frontend has the same formatter in frontend/src/lib/format.ts
 * (sessionLabels) — the two apps can't share code, so keep them in step.
 */
export function labelsFor(when: Date): { dateLabel: string; timeLabel: string } {
  const opts = { timeZone: 'Asia/Kolkata' } as const
  return {
    // en-IN renders "Fri, 20 Nov, 2026" — the comma before the year is not
    // how every label already in this table is written ("Fri, 26 Sep 2026").
    dateLabel: when
      .toLocaleDateString('en-IN', { ...opts, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      .replace(/,(\s\d{4})$/, '$1')
      // Newer ICU data spells September "Sept" in en-IN; stored labels say "Sep".
      .replace('Sept', 'Sep'),
    // en-IN gives a lowercase "pm"; existing labels are "8:00 PM IST".
    timeLabel: `${when
      .toLocaleTimeString('en-IN', { ...opts, hour: 'numeric', minute: '2-digit' })
      .toUpperCase()} IST`,
  }
}
