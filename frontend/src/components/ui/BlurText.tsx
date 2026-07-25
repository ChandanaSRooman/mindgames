import { motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type ElementType } from 'react'

/**
 * BlurText — from React Bits (https://reactbits.dev), ported to TypeScript.
 *
 * Deviations from the reference implementation, all deliberate:
 *  - `as` prop: the original hardcodes a <p>, which is invalid inside a heading
 *    (<h1> takes phrasing content only). Rendering it as a <span> keeps the
 *    markup valid and the single-<h1> document outline intact.
 *  - Honours `prefers-reduced-motion`: the reference animates regardless. The
 *    rest of this page opts out of motion, so this must too.
 *  - Accessible name: split text reads word-by-word to some screen readers, so
 *    the container carries the full string and the fragments are aria-hidden.
 *  - `spanClassName` lets the caller style each fragment (used for per-word
 *    gradient fills).
 */

type Snapshot = Record<string, string | number>

const buildKeyframes = (from: Snapshot, steps: Snapshot[]): Record<string, Array<string | number>> => {
  const keys = new Set<string>([...Object.keys(from), ...steps.flatMap((s) => Object.keys(s))])
  const keyframes: Record<string, Array<string | number>> = {}
  keys.forEach((k) => {
    keyframes[k] = [from[k], ...steps.map((s) => s[k])]
  })
  return keyframes
}

export interface BlurTextProps {
  text?: string
  delay?: number
  className?: string
  spanClassName?: string
  animateBy?: 'words' | 'letters'
  direction?: 'top' | 'bottom'
  threshold?: number
  rootMargin?: string
  animationFrom?: Snapshot
  animationTo?: Snapshot[]
  easing?: (t: number) => number
  onAnimationComplete?: () => void
  stepDuration?: number
  as?: ElementType
  /** Offset before this instance's first fragment starts, in ms. Lets stacked
   *  lines cascade instead of animating in lockstep. */
  startDelay?: number
  /**
   * Emit a visually-hidden copy of `text` so the element has an accessible name
   * (the animated fragments are aria-hidden). Keep this on when BlurText stands
   * alone. Turn it off when an ancestor already names the content — otherwise
   * the string appears twice in the DOM's text.
   */
  srOnlyText?: boolean
}

export function BlurText({
  text = '',
  delay = 200,
  className = '',
  spanClassName = '',
  animateBy = 'words',
  direction = 'top',
  threshold = 0.1,
  rootMargin = '0px',
  animationFrom,
  animationTo,
  easing = (t) => t,
  onAnimationComplete,
  stepDuration = 0.35,
  as,
  startDelay = 0,
  srOnlyText = true,
}: BlurTextProps) {
  const Tag = (as ?? 'p') as ElementType
  const elements = animateBy === 'words' ? text.split(' ') : text.split('')
  const [inView, setInView] = useState(false)
  const [reduced, setReduced] = useState(false)
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.unobserve(el)
        }
      },
      { threshold, rootMargin },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, rootMargin])

  const defaultFrom = useMemo<Snapshot>(
    () =>
      direction === 'top'
        ? { filter: 'blur(10px)', opacity: 0, y: -50 }
        : { filter: 'blur(10px)', opacity: 0, y: 50 },
    [direction],
  )

  const defaultTo = useMemo<Snapshot[]>(
    () => [
      { filter: 'blur(5px)', opacity: 0.5, y: direction === 'top' ? 5 : -5 },
      { filter: 'blur(0px)', opacity: 1, y: 0 },
    ],
    [direction],
  )

  const fromSnapshot = animationFrom ?? defaultFrom
  const toSnapshots = animationTo ?? defaultTo

  const stepCount = toSnapshots.length + 1
  const totalDuration = stepDuration * (stepCount - 1)
  const times = Array.from({ length: stepCount }, (_, i) => (stepCount === 1 ? 0 : i / (stepCount - 1)))

  // Reduced motion: render the text plainly, no fragments, no animation.
  if (reduced) {
    return (
      <Tag ref={ref} className={className} style={{ display: 'flex', flexWrap: 'wrap' }}>
        <span className={spanClassName}>{text}</span>
      </Tag>
    )
  }

  return (
    <Tag ref={ref} className={className} style={{ display: 'flex', flexWrap: 'wrap' }}>
      {/*
        The real accessible text. The animated fragments below are aria-hidden, so
        without this (or an ancestor that names the content) the element has an
        EMPTY accessible name — an aria-label on a plain <span> is not reliably
        exposed, which silently hid the <h1> from screen readers and the outline.
      */}
      {srOnlyText && <span className="sr-only">{text}</span>}
      {elements.map((segment, index) => {
        const animateKeyframes = buildKeyframes(fromSnapshot, toSnapshots)

        return (
          <motion.span
            aria-hidden="true"
            className={`inline-block will-change-[transform,filter,opacity] ${spanClassName}`}
            key={index}
            initial={fromSnapshot}
            animate={inView ? animateKeyframes : fromSnapshot}
            transition={{
              duration: totalDuration,
              times,
              delay: (startDelay + index * delay) / 1000,
              ease: easing,
            }}
            onAnimationComplete={index === elements.length - 1 ? onAnimationComplete : undefined}
          >
            {segment === ' ' ? ' ' : segment}
            {animateBy === 'words' && index < elements.length - 1 && ' '}
          </motion.span>
        )
      })}
    </Tag>
  )
}

export default BlurText
