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

export const collegeComingUp: CollegeComingItem[] = [
  {
    id: 'fafsa-opens',
    dateLabel: 'Usually Oct 1',
    title: 'FAFSA / Illinois Alternative App opens',
    source: 'aid',
  },
  {
    id: 'michigan-visit',
    dateLabel: 'Oct 14–15',
    title: 'College visit — Michigan',
    source: 'plan',
  },
  {
    id: 'psat',
    dateLabel: 'Oct · soph/junior',
    title: 'PSAT 10 / 11',
    source: 'plan',
  },
  {
    id: 'nu-visit',
    dateLabel: 'Nov 5',
    title: 'College visit — Northwestern',
    source: 'plan',
  },
  {
    id: 'fair',
    dateLabel: 'Mar 9',
    title: 'Postsecondary Fair (confirm with counseling)',
    source: 'plan',
  },
  {
    id: 'act',
    dateLabel: 'Apr · junior',
    title: 'ACT — graduation requirement',
    source: 'plan',
  },
]

export const collegeAid = {
  status: 'Not started',
  timeline: [
    { when: 'Usually Oct 1', what: 'FAFSA & Illinois Alternative App open' },
    { when: 'Oct – Nov', what: 'Complete and submit application' },
    { when: 'Dec – Feb', what: 'Verification if selected — submit docs on time' },
    { when: 'Jan – Apr', what: 'Review financial aid offers' },
    {
      when: 'Feb – May',
      what: 'Typical offer window (4-year colleges)',
    },
    { when: 'Apr – May 1', what: 'Decide, accept one offer, decline others' },
    { when: 'Every year', what: 'Re-file FAFSA / Alternative App in college' },
  ] satisfies TimelineRow[],
  resources: [
    { label: 'StudentAid.gov', href: 'https://studentaid.gov' },
    { label: 'FAFSA', href: 'https://www.fafsa.gov' },
    {
      label: 'Create FSA ID',
      href: 'https://www.studentaid.gov/fsa-id',
    },
    {
      label: 'Illinois Alternative App',
      href: 'https://www.isac.org/AlternativeApp',
    },
    {
      label: 'ISAC Student Portal',
      href: 'https://studentportal.isac.org',
    },
    {
      label: 'Federal aid estimator',
      href: 'https://studentaid.gov/aid-estimator/',
    },
  ] satisfies ResourceLink[],
}

export const collegePlan = {
  timeline: [
    { when: 'Oct · soph & junior', what: 'PSAT 10 / 11' },
    { when: 'Oct 14–15', what: 'College visit — Michigan' },
    { when: 'Nov 5', what: 'College visit — Northwestern' },
    { when: 'Mar 9', what: 'Postsecondary Fair (confirm date)' },
    {
      when: 'Apr · 9th & 10th',
      what: 'PreACT 9 and 10 Secure',
    },
    {
      when: 'Apr · junior',
      what: 'ACT 11 — CPS graduation requirement',
    },
    { when: 'May', what: 'AP exams (year you take the course)' },
  ] satisfies TimelineRow[],
  reminders: [
    'SchooLinks parent access: cps.edu/parents → Forgot Password (Aspen email)',
    'Favor depth in activities; use summers (programs, work, volunteer)',
    'AP / Dual Credit / Honors when ready — grades matter most',
  ],
  resources: [
    {
      label: 'CPS parents / SchooLinks',
      href: 'https://www.cps.edu/parents',
    },
    {
      label: 'Net Price Calculator',
      href: 'https://bigfuture.collegeboard.org/pay-for-college/get-started/net-price-calculator',
    },
    {
      label: 'What is SAI?',
      href: 'https://studentaid.gov/help-center/answers/article/what-is-sai',
    },
    {
      label: 'Illinois job search',
      href: 'https://www.illinois.gov/employment/find-jobs.html',
    },
    {
      label: 'IL apprenticeships',
      href: 'https://ides.illinois.gov/jobs-workforce/apprenticeships.html',
    },
  ] satisfies ResourceLink[],
}
