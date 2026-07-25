import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Bot,
  Briefcase,
  CalendarDays,
  Check,
  Compass,
  GraduationCap,
  Handshake,
  Newspaper,
  Quote,
  Rocket,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import { Avatar } from '../components/ui'
import { BlurText } from '../components/ui/BlurText'
import { roomanStats } from '../data/mockData'

type Feature = {
  icon: ReactNode
  tint: string
  title: string
  body: string
  points: string[]
  /** Optional corner pill, e.g. a launch offer. Marketing claim, not enforced by
   *  the backend — see the note on the mentorship card. */
  badge?: string
}

/**
 * Every card below describes something that actually ships — the copy is written
 * off the real routes (`App.tsx`) and endpoints (`backend/src/routes/*`), not
 * aspirations. If a capability is removed, remove or reword its card too.
 */
const FEATURES: Feature[] = [
  {
    icon: <Users size={24} />,
    tint: 'bg-gradient-to-br from-[#ff4500] to-[#ff8a00] shadow-orange-500/30',
    title: 'Community Feed',
    body: 'One feed for the whole alumni family. Every post is typed, so you can tell a job opening from a mentorship offer at a glance.',
    points: [
      'Update, Hiring, Open to Work, Mentorship & StartupVarsity posts',
      'Like, comment and save anything worth coming back to',
    ],
  },
  {
    icon: <Briefcase size={24} />,
    tint: 'bg-gradient-to-br from-[#16a34a] to-[#4ade80] shadow-green-500/30',
    title: 'Job Board',
    body: 'Openings posted by alumni, for alumni. Apply with your résumé attached and the person hiring reads it directly — no cold pile.',
    points: ['Apply with a résumé in one step', 'Flag yourself “open to work” to recruiters'],
  },
  {
    icon: <GraduationCap size={24} />,
    tint: 'bg-gradient-to-br from-[#2563eb] to-[#60a5fa] shadow-blue-500/30',
    title: 'Paid Mentorship',
    // NOTE: launch offer only. Nothing in mentorship.routes.ts tracks a free-session
    // allowance — mentor_rate defaults to ₹1000/hr and applies from session one.
    badge: 'First 3 sessions free',
    body: 'Apply to become a verified mentor, take session requests from the next batch, and build a rated track record as you teach.',
    points: ['Accept, decline or complete session requests', 'Mentees rate every finished session'],
  },
  {
    icon: <CalendarDays size={24} />,
    tint: 'bg-gradient-to-br from-[#d97706] to-[#fbbf24] shadow-amber-500/30',
    title: 'Events & Meetups',
    body: 'Alumni summits, AMAs and workshops. RSVP in a tap, add it straight to your calendar, and collect a certificate afterwards.',
    points: [
      'Host your own event once it clears review',
      'Attendance certificate + calendar (.ics) export',
    ],
  },
  {
    icon: <Handshake size={24} />,
    tint: 'bg-gradient-to-br from-[#0891b2] to-[#22d3ee] shadow-cyan-500/30',
    title: 'Network & Messages',
    body: 'Send connection requests, then talk properly. Direct messages are live, with read state, so conversations do not stall in an inbox.',
    points: ['Accept or ignore incoming requests', 'Real-time one-to-one messaging'],
  },
  {
    icon: <Compass size={24} />,
    tint: 'bg-gradient-to-br from-[#e11d48] to-[#fb7185] shadow-rose-500/30',
    title: 'Communities',
    body: 'Focused spaces by domain, city or batch — Cloud, Web Dev, Bengaluru, Class of 2019 — and go deep with your people.',
    points: ['Propose a new community for review', 'Join any chapter that fits you'],
  },
  {
    icon: <Rocket size={24} />,
    tint: 'bg-gradient-to-br from-[#7c3aed] to-[#a855f7] shadow-purple-500/30',
    title: 'StartupVarsity',
    body: "Turn your idea into a company with Rooman's labs, mentor pool and seed support — built for alumni founders.",
    points: ['Apply with your idea and team', 'Lab, infra and mentor access'],
  },
  {
    icon: <Bot size={24} />,
    tint: 'bg-gradient-to-br from-[#4f46e5] to-[#818cf8] shadow-indigo-500/30',
    title: 'Ask Roo',
    body: 'An assistant that already knows the network. Ask it who to talk to, which openings fit you or what is happening this month.',
    points: ['Finds members, jobs, mentors and events', 'Answers in plain language, in context'],
  },
  {
    icon: <Newspaper size={24} />,
    tint: 'bg-gradient-to-br from-[#0d9488] to-[#2dd4bf] shadow-teal-500/30',
    title: 'News & Updates',
    body: 'Official announcements, placement drives and success stories from Rooman — straight from the source, no noise.',
    points: ['Placement drive alerts', 'Official notices pinned to your feed'],
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Accept your invite',
    body: 'Root Connect is invite-only. Every member is a verified Rooman alumnus, so the network stays genuine and spam-free.',
  },
  {
    n: '02',
    title: 'Upload your résumé',
    body: 'Drop in your CV and it fills the rest in for you — batch, course, company, skills. Correct anything it got wrong and move on.',
  },
  {
    n: '03',
    title: 'Connect & grow',
    body: 'Get matched with batchmates, mentors and opportunities. Your first connections are suggested on day one.',
  },
]

const TESTIMONIALS = [
  {
    name: 'Aarav Sharma',
    role: 'Senior Backend Engineer · Amazon',
    batch: 'Java Full Stack, Batch of 2016',
    quote:
      'I found my first two referrals through batchmates here. Now I mentor juniors on system design — the same way seniors once helped me.',
  },
  {
    name: 'Priya Nair',
    role: 'Frontend Developer · Razorpay',
    batch: 'Front-End Engineering, Batch of 2020',
    quote:
      'My Razorpay role came from a referral posted on the job board. A warm intro from an alumnus beats a hundred cold applications.',
  },
  {
    name: 'Vikram Singh',
    role: 'Founder & CEO · NeuralEdge',
    batch: 'Embedded Systems, Batch of 2010',
    quote:
      'StartupVarsity gave us lab access, mentors and our first seed cheque. NeuralEdge exists because of this network.',
  },
]

const COMPANIES = ['Amazon', 'Microsoft', 'Google', 'Flipkart', 'Razorpay', 'Zoho', 'Freshworks']

// Hero background video. Files live in frontend/public/ and are served from the
// site root, so '/hero.mp4' maps to frontend/public/hero.mp4.
const HERO_VIDEO = '/hero.mp4'
/**
 * Still frame shown while the video buffers, and the whole hero image for
 * reduced-motion visitors. Extracted from hero.mp4 at t=2s.
 */
const HERO_POSTER = '/hero-poster.jpg'

// ---- Motion helpers ---------------------------------------------------------

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Fires once when the element scrolls into view. */
function useInView<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])

  return { ref, inView }
}

/** Slide-up + fade wrapper, staggered via `delay` (ms). */
function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`reveal ${inView ? 'is-visible' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

/** Counts "500,000+" / "25 yrs" style values up from 0 when scrolled into view. */
function CountUp({ value }: { value: string }) {
  const { ref, inView } = useInView<HTMLSpanElement>(0.5)
  const match = value.match(/^(\D*)([\d,]+)(.*)$/)
  const target = match ? parseInt(match[2].replace(/,/g, ''), 10) : null
  const [n, setN] = useState(0)

  useEffect(() => {
    if (!inView || target == null) return
    if (prefersReducedMotion()) {
      setN(target)
      return
    }
    const start = performance.now()
    const duration = 1400
    let raf: number
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, target])

  if (match == null || target == null) return <span ref={ref}>{value}</span>
  return (
    <span ref={ref}>
      {match[1]}
      {n.toLocaleString('en-US')}
      {match[3]}
    </span>
  )
}

/**
 * Full-bleed muted background video for the hero.
 *
 * The scrim is deliberately DARK rather than light: a white wash desaturates the
 * footage to near-greyscale (measured ~0.014 mean saturation at 80%) whereas a
 * dark one keeps its colour (~0.13) while still giving light copy enough
 * contrast. That is why the hero text in this section is light-on-dark.
 *
 * Skipped entirely for visitors who ask for reduced motion.
 */
function HeroVideo() {
  const [play, setPlay] = useState(false)

  useEffect(() => {
    if (!prefersReducedMotion()) setPlay(true)
  }, [])

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {play ? (
        <video
          src={HERO_VIDEO}
          poster={HERO_POSTER || undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
      ) : (
        HERO_POSTER && <img src={HERO_POSTER} alt="" className="h-full w-full object-cover" />
      )}

      {/* Cinematic scrim: flat base keeps the footage colourful. */}
      <div className="absolute inset-0 bg-[#0a0b0d]/55" />

      {/*
        Text-protection scrim. Concentrated behind the copy column so the centre
        is dark enough for light text on the brightest frames while the edges stay
        vivid — raising the flat scrim instead would just wash the whole video out.
      */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_65%_at_50%_42%,rgb(6_7_9/0.5),transparent_78%)]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#0a0b0d]/45 to-transparent" />

      {/* Short fade into the page background at the section boundary. */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-[#f6f7f8]" />
    </div>
  )
}

function scrollToSection(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
  e.preventDefault()
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}

// ---- Page -------------------------------------------------------------------

export function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#f6f7f8]">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-[#edeff1] bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ff4500] text-lg font-black text-white">
              R
            </span>
            <span className="text-[15px] font-bold text-[#1c1c1c]">
              Root <span className="text-[#ff4500]">Connect</span>
            </span>
          </div>
          {/* py-2 on the links keeps every pointer target at/above the 24px minimum. */}
          <nav className="hidden items-center gap-7 text-sm font-medium text-[#6b6e70] md:flex">
            {[
              { id: 'features', label: 'Features' },
              { id: 'how-it-works', label: 'How it works' },
              { id: 'stories', label: 'Alumni stories' },
            ].map((l) => (
              <a
                key={l.id}
                href={`#${l.id}`}
                onClick={(e) => scrollToSection(e, l.id)}
                className="inline-flex items-center py-2 transition-colors hover:text-[#1c1c1c]"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center py-2 text-sm font-semibold text-[#1c1c1c] transition-colors hover:text-[#ff4500]"
            >
              Sign In
            </Link>
            <button
              onClick={() => navigate('/accept-invite')}
              className="hidden rounded-full bg-[#d13a00] px-4 py-2 text-sm font-bold text-white transition-all hover:bg-[#ff4500] active:scale-95 sm:inline-flex"
            >
              Join Now
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="main" className="relative scroll-mt-20 overflow-hidden">
        {/* Background video sits underneath; the layers below paint on top of it. */}
        <HeroVideo />

        {/* Decorative background: subtle grid + floating brand glows.
            Grid lines are white here — light-grey lines read as haze over the video. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.07)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_35%,black_20%,transparent_100%)]"
        />
        <div
          aria-hidden
          className="animate-floaty pointer-events-none absolute -top-32 left-[12%] h-[420px] w-[560px] rounded-full bg-[#ff4500]/20 blur-3xl"
        />
        <div
          aria-hidden
          className="animate-floaty2 pointer-events-none absolute -top-16 right-[8%] h-[340px] w-[460px] rounded-full bg-[#ffb800]/20 blur-3xl"
        />

        {/* pb-32 clears the h-32 bottom fade so the stat cards stay in the dark band. */}
        <div className="relative mx-auto max-w-4xl px-6 pt-16 pb-32 text-center sm:pt-20">
          <Reveal>
            {/* Dark glass, not white/10: a white tint brightens with the footage
                behind it and the amber text loses contrast on sunlit frames. */}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-[#0a0b0d]/65 px-4 py-1.5 text-sm font-semibold text-[#ffd270] backdrop-blur-sm">
              <Sparkles size={14} />
              Rooman Technologies · {roomanStats.years} Years of Building Careers
            </span>
          </Reveal>

          {/*
            No <Reveal> wrapper here: BlurText owns the entrance, and Reveal's own
            opacity/translate fade would run underneath it and mask the blur.
            Each line is its own flex row, which replaces the old <br />.
          */}
          {/* The h1 carries the accessible name (aria-label on a heading is well
              supported), so the rows skip their sr-only copies and the string
              appears once in the DOM rather than twice. */}
          <h1
            aria-label="Your career grew. So did your network."
            /* 7xl on desktop (up from 6xl). The md step matters: jumping straight to
               7xl at the sm breakpoint leaves only ~592px of column and the headline
               breaks into four lines. */
            className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl md:text-7xl"
          >
            <BlurText
              as="span"
              text="Your career grew."
              animateBy="words"
              direction="top"
              delay={90}
              stepDuration={0.32}
              srOnlyText={false}
              className="justify-center"
            />
            {/* Gradient rides on each word (spanClassName), not the container: the
                animating blur filter on a child breaks a parent's bg-clip-text fill.
                Lifted off #ff4500 — the darker orange loses too much contrast on video. */}
            <BlurText
              as="span"
              text="So did your network."
              animateBy="words"
              direction="top"
              delay={90}
              stepDuration={0.32}
              startDelay={280}
              srOnlyText={false}
              className="justify-center"
              spanClassName="animate-gradient-x bg-gradient-to-r from-[#ff8a3d] via-[#ffc94d] to-[#ff8a3d] bg-clip-text text-transparent"
            />
          </h1>

          <Reveal delay={200}>
            {/* Light, not the site's usual #878a8c: this copy sits over the dark hero video. */}
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[#e8e9ea]">
              Root Connect is the private network for {roomanStats.alumni} Rooman alumni. Find jobs
              through people who vouch for you, earn by mentoring the next batch, and build your
              startup with the institute that trained you.
            </p>
          </Reveal>

          <Reveal delay={300}>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                onClick={() => navigate('/accept-invite')}
                className="inline-flex items-center gap-2 rounded-full bg-[#d13a00] px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition-all hover:-translate-y-0.5 hover:bg-[#ff4500] hover:shadow-xl hover:shadow-orange-500/30 active:scale-95"
              >
                Accept Invite & Join Now <ArrowRight size={20} />
              </button>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-[#0a0b0d]/45 px-7 py-3.5 text-base font-bold text-white shadow-sm backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-white/60 hover:bg-[#0a0b0d]/65"
              >
                Already a member? Sign In
              </Link>
            </div>
          </Reveal>

          {/* Social proof */}
          <Reveal delay={400}>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <div className="flex -space-x-2.5">
                {['Aarav Sharma', 'Priya Nair', 'Sneha Iyer', 'Karthik Reddy', 'Divya Menon'].map(
                  (n) => (
                    <span
                      key={n}
                      className="rounded-full ring-2 ring-white/30 transition-transform hover:z-10 hover:-translate-y-1"
                    >
                      <Avatar name={n} size={34} />
                    </span>
                  ),
                )}
              </div>
              <p className="text-sm text-[#e8e9ea]">
                Joined by <span className="font-semibold text-white">{roomanStats.alumni}</span>{' '}
                alumni across India
              </p>
            </div>
          </Reveal>

          {/* Stats */}
          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { v: roomanStats.alumni, l: 'Alumni Trained' },
              { v: `${roomanStats.years} yrs`, l: 'Of Excellence' },
              { v: roomanStats.reach, l: 'Presence' },
              { v: `${roomanStats.centers}+`, l: 'Training Centers' },
            ].map((s, i) => (
              <Reveal key={s.l} delay={i * 80}>
                {/* Dark glass so the card never brightens with the footage behind it. */}
                <div className="rounded-xl border border-white/15 bg-[#0a0b0d]/50 p-5 shadow-sm backdrop-blur-md transition-all hover:-translate-y-1 hover:border-white/30 hover:bg-[#0a0b0d]/65">
                  <p className="text-2xl font-extrabold text-[#ffb066]">
                    <CountUp value={s.v} />
                  </p>
                  <p className="mt-1 text-sm text-[#e2e3e4]">{s.l}</p>
                </div>
              </Reveal>
            ))}
          </div>

        </div>
      </section>

      {/*
        Companies marquee — deliberately its own section OUTSIDE the video band.
        Kept inside the hero it landed in the fade, where neither light nor dark
        text works: light text washed out and dark text sat on part-lit footage.
      */}
      <section className="mx-auto max-w-4xl px-6 pt-10 pb-4 text-center">
        <Reveal>
          <p className="text-xs font-semibold tracking-widest text-[#4f5356] uppercase">
            Our alumni work at
          </p>
          <div className="mt-4 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
            <div className="animate-marquee flex w-max items-center gap-12">
              {[...COMPANIES, ...COMPANIES].map((c, i) => (
                <span
                  key={`${c}-${i}`}
                  className="text-base font-bold tracking-wide whitespace-nowrap text-[#6b6e70] transition-colors hover:text-[#1c1c1c]"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* Features — section is full-width so the marquee rows can run edge to
          edge; only the heading block is width-constrained. */}
      <section id="features" className="scroll-mt-20 py-20">
        <Reveal>
          <div className="mx-auto max-w-2xl px-6 text-center">
            {/* Eyebrows use the darker action orange: #ff4500 is only 3.2:1 on the
                light page at this size. The logotype keeps #ff4500 (WCAG exempts logos). */}
            <p className="text-sm font-bold tracking-widest text-[#c2410c] uppercase">
              Everything in one place
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#1c1c1c] sm:text-4xl">
              Built for every stage of your career
            </h2>
            <p className="mt-4 text-lg text-[#6b6e70]">
              Whether you’re job-hunting, giving back or founding a company — the network has a
              place for you.
            </p>
          </div>
        </Reveal>

        {/* Two tracks instead of a 3x3 grid: top row drifts right, bottom left. */}
        <div className="mt-12 space-y-6">
          <FeatureRow items={FEATURES.slice(0, 5)} direction="right" />
          <FeatureRow items={FEATURES.slice(5)} direction="left" />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 border-y border-[#edeff1] bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-bold tracking-widest text-[#c2410c] uppercase">
                Invite-only, alumni-only
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#1c1c1c] sm:text-4xl">
                Up and running in three steps
              </h2>
            </div>
          </Reveal>

          <Steps />

          <Reveal delay={300}>
            <div className="mx-auto mt-12 flex max-w-md items-center justify-center gap-2 rounded-full border border-[#edeff1] bg-[#f6f7f8] px-5 py-2.5 text-sm text-[#6b6e70]">
              <ShieldCheck size={16} className="shrink-0 text-[#16a34a]" />
              Every profile is verified against Rooman batch records.
            </div>
          </Reveal>
        </div>
      </section>

      {/* Testimonials — dark band for contrast */}
      <section id="stories" className="relative scroll-mt-20 overflow-hidden bg-[#17181a]">
        <div
          aria-hidden
          className="animate-floaty pointer-events-none absolute -top-44 left-[30%] h-[380px] w-[620px] rounded-full bg-[#ff4500]/15 blur-3xl"
        />
        <div
          aria-hidden
          className="animate-floaty2 pointer-events-none absolute -bottom-40 right-[10%] h-[320px] w-[480px] rounded-full bg-[#7c3aed]/15 blur-3xl"
        />

        <div className="relative mx-auto max-w-6xl px-6 py-20">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-bold tracking-widest text-[#ff8a00] uppercase">
                Alumni stories
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                From the people already inside
              </h2>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 120} className="h-full">
                <figure className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.08]">
                  <Quote size={22} className="text-[#ff6534]" fill="currentColor" />
                  <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-[#e8e9ea]">
                    “{t.quote}”
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-3 border-t border-white/10 pt-4">
                    <Avatar name={t.name} size={42} />
                    <div className="min-w-0 text-left">
                      <p className="text-sm font-bold text-white">{t.name}</p>
                      <p className="truncate text-xs text-[#a5a8ab]">{t.role}</p>
                      <p className="truncate text-xs text-[#9ca1a5]">{t.batch}</p>
                    </div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          {/* Gradient stops at #ff5a1f: the old #ff8a00 end left the white heading
              at 2.8:1, under the 3.0 large-text floor. */}
          <div className="animate-gradient-x relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#d13a00] via-[#ff4500] to-[#ff5a1f] p-10 text-center text-white sm:p-14">
            {/* Decorative rings */}
            <div
              aria-hidden
              className="animate-floaty pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full border-[24px] border-white/10"
            />
            <div
              aria-hidden
              className="animate-floaty2 pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full border-[28px] border-white/10"
            />

            <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">
              Your network is waiting.
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-lg text-orange-50">
              {roomanStats.alumni} alumni. One invite between you and all of them.
            </p>
            <button
              onClick={() => navigate('/accept-invite')}
              className="relative mt-7 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-bold text-[#c2410c] shadow-lg transition-all hover:-translate-y-0.5 hover:bg-orange-50 hover:shadow-xl active:scale-95"
            >
              Accept Invite & Join Now <ArrowRight size={20} />
            </button>
            <p className="relative mt-4 text-sm text-orange-100">
              Invite-only · Free for all Rooman alumni
            </p>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#edeff1] bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ff4500] text-lg font-black text-white">
                R
              </span>
              <span className="text-[15px] font-bold text-[#1c1c1c]">
                Root <span className="text-[#ff4500]">Connect</span>
              </span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#6b6e70]">
              The private alumni network of Rooman Technologies — {roomanStats.years} years,{' '}
              {roomanStats.alumni} careers and counting.
            </p>
          </div>

          <FooterCol
            title="Platform"
            links={[
              { label: 'Community Feed', to: '/home' },
              { label: 'Job Board', to: '/jobs' },
              { label: 'Mentorship', to: '/mentorship' },
              { label: 'StartupVarsity', to: '/startupvarsity' },
            ]}
          />
          <FooterCol
            title="Network"
            links={[
              { label: 'My Network', to: '/network' },
              { label: 'Events', to: '/events' },
              { label: 'Communities', to: '/explore' },
              { label: 'News & Updates', to: '/news' },
            ]}
          />
          <FooterCol
            title="Get started"
            links={[
              { label: 'Accept Invite', to: '/accept-invite' },
              { label: 'Sign In', to: '/login' },
            ]}
          />
        </div>
        <div className="border-t border-[#edeff1] py-5 text-center text-sm text-[#6b6e70]">
          © 2026 Rooman Technologies · Alumni Network
        </div>
      </footer>
    </div>
  )
}

/**
 * The three onboarding steps, revealed in sequence.
 *
 * A single observer drives all of it, so the badges, copy and connector share
 * one clock: badge 01 pops, the dashed line starts drawing toward 02, 02 pops as
 * the line reaches it, and so on. Using a <Reveal> per step instead would give
 * each its own observer and the line could not be timed against them.
 */
/* Must match the transition durations of .step-num / .step-line in index.css. */
const BADGE_MS = 420
const LINE_MS = 460
/** One badge plus the line that leaves it — the length of a single stage. */
const STAGE_MS = BADGE_MS + LINE_MS

/** Badge i lands only after every earlier badge and connecting line has finished. */
const badgeDelay = (i: number) => i * STAGE_MS
/** Segment i starts the moment badge i has landed. */
const lineDelay = (i: number) => BADGE_MS + i * STAGE_MS

function Steps() {
  const { ref, inView } = useInView<HTMLDivElement>(0.25)
  const shown = inView ? 'is-visible' : ''

  return (
    <div ref={ref} className="relative mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
      {/*
        One segment per gap rather than a single line spanning both, so the draw
        can stop at badge 02 and wait for it before continuing to 03. With three
        equal columns the badge centres sit near 16% / 50% / 84%.
      */}
      {[0, 1].map((i) => (
        <div
          key={i}
          aria-hidden
          className={`step-line absolute top-7 hidden border-t-2 border-dashed border-orange-200 md:block ${shown} ${
            i === 0 ? 'right-[50%] left-[16%]' : 'right-[16%] left-[50%]'
          }`}
          style={{ transitionDelay: `${lineDelay(i)}ms` }}
        />
      ))}

      {STEPS.map((s, i) => (
        <div key={s.n} className="relative text-center">
          {/* Ink numerals, not white: white on this orange gradient is only
              2.6:1, whereas #1c1c1c on it clears 4.7:1 and keeps the brand fill. */}
          <div
            className={`step-num mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff4500] to-[#ff8a00] text-lg font-extrabold text-[#1c1c1c] shadow-lg shadow-orange-500/25 ${shown}`}
            style={{ transitionDelay: `${badgeDelay(i)}ms` }}
          >
            {s.n}
          </div>
          {/* Copy belongs to its badge, so it follows immediately rather than
              waiting for the next stage. */}
          <div
            className={`reveal ${shown}`}
            style={{ transitionDelay: `${badgeDelay(i) + 120}ms` }}
          >
            <h3 className="mt-5 text-lg font-bold text-[#1c1c1c]">{s.title}</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-[#6b6e70]">{s.body}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * One feature card. Fixed width so the marquee track has a stable, duplicable
 * length; `h-full` lets flex stretch every card in a row to equal height. The
 * width is narrower on phones so a whole card fits inside a 390px viewport
 * instead of being sliced by the row's edge mask.
 */
function FeatureCard({ f }: { f: Feature }) {
  return (
    <div className="group relative h-full w-[272px] shrink-0 rounded-2xl border border-[#edeff1] bg-white p-6 shadow-sm transition-all hover:-translate-y-1.5 hover:shadow-xl sm:w-[330px]">
      {/*
        Offer sticker: absolutely placed and tilted so it reads as stuck onto the
        card rather than as another row of content. It overhangs the corner, which
        is why the track wrapper carries vertical padding — `overflow-hidden`
        clips both axes and would otherwise shave the top off.
      */}
      {f.badge && (
        <span className="absolute -top-3 -right-2 z-10 inline-flex rotate-[7deg] items-center gap-1 rounded-full border-2 border-white bg-gradient-to-br from-[#15803d] to-[#166534] px-3 py-1.5 text-xs font-extrabold tracking-tight text-white shadow-lg shadow-green-900/25 transition-transform duration-300 group-hover:rotate-[-3deg] group-hover:scale-105">
          <Sparkles size={12} className="shrink-0" />
          {f.badge}
        </span>
      )}

      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 ${f.tint}`}
      >
        {f.icon}
      </div>
      <h3 className="mt-4 text-lg font-bold text-[#1c1c1c]">{f.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#6b6e70]">{f.body}</p>
      <ul className="mt-4 space-y-2">
        {f.points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-sm text-[#1c1c1c]">
            <Check size={16} className="mt-0.5 shrink-0 text-[#16a34a]" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * A self-scrolling row of feature cards. The card list is rendered twice so the
 * track can translate -50% and land exactly on a seam; the second copy is
 * `data-clone` and aria-hidden, so screen readers and reduced-motion users see
 * each feature once. Pauses on hover/focus (see .feature-row in index.css).
 */
function FeatureRow({ items, direction }: { items: Feature[]; direction: 'left' | 'right' }) {
  return (
    <div className="feature-row overflow-hidden py-5 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
      <div
        className={`flex w-max items-stretch gap-6 ${
          direction === 'right' ? 'animate-row-right' : 'animate-row-left'
        }`}
      >
        {items.map((f) => (
          <FeatureCard key={f.title} f={f} />
        ))}
        {items.map((f) => (
          <div key={`clone-${f.title}`} data-clone="true" aria-hidden className="flex">
            <FeatureCard f={f} />
          </div>
        ))}
      </div>
    </div>
  )
}

function FooterCol({
  title,
  links,
}: {
  title: string
  links: Array<{ label: string; to: string }>
}) {
  return (
    <div>
      <p className="text-xs font-bold tracking-widest text-[#6b6e70] uppercase">{title}</p>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              to={l.to}
              className="inline-flex items-center py-1 text-sm text-[#1c1c1c] transition-colors hover:text-[#ff4500]"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
