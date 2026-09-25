import { ClipboardList, Compass, HandHeart, Route, Sparkles, Target, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Content for the "what is Career Guidance" walkthrough.
 *
 * Kept as data next to the other career helpers (same pattern as
 * SERVICE_ICONS in careerServices.ts) so the overlay component stays a
 * renderer — copy changes here, layout changes there.
 */

export interface IntroPoint {
  icon: LucideIcon
  title: string
  body: string
}

export interface IntroStep {
  /** Short label for the step rail. */
  tab: string
  icon: LucideIcon
  heading: string
  /** One-line answer to the question this step asks. */
  lead: string
  points: IntroPoint[]
}

export const CAREER_INTRO_STEPS: IntroStep[] = [
  {
    tab: 'What it is',
    icon: Compass,
    heading: 'Career Guidance is your personal plan',
    lead: 'Not a course and not a job board — a step-by-step route from where you are today to the role you actually want.',
    points: [
      {
        icon: ClipboardList,
        title: 'It starts with a few questions',
        body: 'Where you are now, what you want next, how many hours a week you really have, and the kind of help you like.',
      },
      {
        icon: Route,
        title: 'It ends with a roadmap',
        body: 'Your goal broken into ordered stages, each sized to the time you told us you can give.',
      },
      {
        icon: Users,
        title: 'And it is backed by people',
        body: 'Rooman alumni who already made a similar move are matched to the stage you are on.',
      },
    ],
  },
  {
    tab: 'How it works',
    icon: Sparkles,
    heading: 'Three steps, and the first one is the only long one',
    lead: 'The assessment takes 5–10 minutes and saves after every step, so you can stop halfway and come back.',
    points: [
      {
        icon: ClipboardList,
        title: '1 · Take the assessment',
        body: 'Your profile fills in your skills and experience automatically — you will not retype what RooConnect already knows.',
      },
      {
        icon: Route,
        title: '2 · Get your roadmap',
        body: 'Stages are generated from your answers. Rename, reorder, pause or remove any of them — the plan is yours to shape.',
      },
      {
        icon: HandHeart,
        title: '3 · Bring in alumni',
        body: 'Each stage shows alumni who can help and services you can book. Booking runs through the normal mentorship flow.',
      },
    ],
  },
  {
    tab: 'Why it helps',
    icon: Target,
    heading: 'What you get out of it',
    lead: 'The point is to turn "I want to switch into AI" into something you can act on this week.',
    points: [
      {
        icon: Target,
        title: 'A next step that is never vague',
        body: 'There is always exactly one stage marked as your current focus, with what to do in it.',
      },
      {
        icon: Users,
        title: 'People who took your path',
        body: 'Matching is based on real alumni career histories, not a generic list of mentors.',
      },
      {
        icon: Sparkles,
        title: 'Progress you can see',
        body: 'Mark stages done as you go, so the plan reflects where you actually are months from now.',
      },
    ],
  },
  {
    tab: 'What to do',
    icon: HandHeart,
    heading: 'Start here',
    lead: 'You can change every answer later — retaking the assessment rebuilds the roadmap, it does not lock you in.',
    points: [
      {
        icon: ClipboardList,
        title: 'Take the assessment',
        body: 'Set aside 5–10 minutes. Answer honestly about your hours — an over-optimistic plan is the one people abandon.',
      },
      {
        icon: Route,
        title: 'Shape the roadmap',
        body: 'Read the stages and edit anything that does not fit. A plan you edited is a plan you will follow.',
      },
      {
        icon: Users,
        title: 'Reach out to one person',
        body: 'Book a single session with an alumnus on your current stage. That one conversation is what makes the plan move.',
      },
    ],
  },
]

/** localStorage key: the walkthrough opens by itself only on a first visit.
 *  After that it is on-demand via the header button. */
export const CAREER_INTRO_SEEN_KEY = 'rooconnect.careerIntroSeen'
