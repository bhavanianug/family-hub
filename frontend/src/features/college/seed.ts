/** Curated low-noise seed from Whitney Young decks — DB later. */

export type TimelineRow = {
  when: string
  what: string
}

export type ResourceLink = {
  label: string
  href: string
}

export type CollegeComingItem = {
  id: string
  dateLabel: string
  title: string
  source: 'aid' | 'plan'
}

/** One-off dates only — recurring aid/testing live in Aid / Plan. */
export const collegeComingUp: CollegeComingItem[] = [
  {
    id: 'michigan-visit',
    dateLabel: 'Oct 14–15',
    title: 'Michigan visit',
    source: 'plan',
  },
  {
    id: 'nu-visit',
    dateLabel: 'Nov 5',
    title: 'Northwestern visit',
    source: 'plan',
  },
  {
    id: 'fair',
    dateLabel: 'Mar 9',
    title: 'Postsecondary fair',
    source: 'plan',
  },
]

export const collegeAid = {
  status: 'Not started',
  timeline: [
    { when: 'Oct 1', what: 'FAFSA / Alternative App open' },
    { when: 'Oct – Nov', what: 'File' },
    { when: 'Dec – Feb', what: 'Verification (if selected)' },
    { when: 'Jan – Apr', what: 'Aid offers' },
    { when: 'Apr – May 1', what: 'Accept / decline' },
    { when: 'Yearly', what: 'Re-file while in college' },
  ] satisfies TimelineRow[],
  reminders: [
    'Student + parent each need a StudentAid.gov account before filing',
    'Filing is free — don’t pay anyone',
    'Compare offers on out-of-pocket (grants vs loans), not sticker price',
  ],
  resources: [
    { label: 'StudentAid.gov', href: 'https://studentaid.gov' },
    { label: 'FAFSA', href: 'https://www.fafsa.gov' },
    { label: 'FSA ID', href: 'https://www.studentaid.gov/fsa-id' },
    {
      label: 'Illinois Alternative App',
      href: 'https://www.isac.org/AlternativeApp',
    },
    {
      label: 'ISAC portal',
      href: 'https://studentportal.isac.org',
    },
  ] satisfies ResourceLink[],
}

export const collegePlan = {
  timeline: [
    { when: 'Oct', what: 'PSAT 10 / 11' },
    { when: 'Apr', what: 'PreACT 9 / 10' },
    { when: 'Apr · junior', what: 'ACT (grad requirement)' },
    { when: 'May', what: 'AP exams' },
  ] satisfies TimelineRow[],
  reminders: [
    'SchooLinks: cps.edu/parents → Forgot Password (Aspen email)',
    'Depth in activities beats a long shallow list',
    'Scholarship red flags: don’t pay to apply; don’t share SSN casually',
  ],
  resources: [
    {
      label: 'SchooLinks (CPS parents)',
      href: 'https://www.cps.edu/parents',
    },
    {
      label: 'Net Price Calculator',
      href: 'https://bigfuture.collegeboard.org/pay-for-college/get-started/net-price-calculator',
    },
    {
      label: 'Aid estimator',
      href: 'https://studentaid.gov/aid-estimator/',
    },
  ] satisfies ResourceLink[],
}
