import { animate } from 'motion'

// Apple ships two spring shapes: critically damped for most UI, a little
// bounce only when the gesture itself carried momentum.
export const SPRING = { type: 'spring', bounce: 0, duration: 0.4 }
export const SPRING_BOUNCY = { type: 'spring', bounce: 0.28, duration: 0.45 }

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Springs animate from the element's current on-screen value, so a press
// that lands mid-animation is picked up and redirected rather than jumping.
export function pressIn(el) {
  if (!el || prefersReducedMotion()) return
  animate(el, { scale: 0.97 }, { ...SPRING, duration: 0.2 })
}

export function pressOut(el) {
  if (!el || prefersReducedMotion()) return
  // Bounce on release only — the press carried momentum into it
  animate(el, { scale: 1 }, SPRING_BOUNCY)
}

// Enters along the same axis it will leave by, so the path stays symmetric.
export function enter(el, { y = 8, delay = 0 } = {}) {
  if (!el) return
  if (prefersReducedMotion()) {
    animate(el, { opacity: [0, 1] }, { duration: 0.2 })
    return
  }
  animate(el, { opacity: [0, 1], transform: [`translateY(${y}px)`, 'translateY(0px)'] },
    { ...SPRING, delay })
}

// Cards arrive in sequence rather than all at once, so the eye is led down
// the page. The stagger stays short — this is hierarchy, not choreography.
export function enterStaggered(root, selector = '.stat-card, .card', step = 0.035) {
  if (!root) return
  const els = root.querySelectorAll(selector)
  if (!els.length) return

  if (prefersReducedMotion()) {
    els.forEach(el => animate(el, { opacity: [0, 1] }, { duration: 0.2 }))
    return
  }

  els.forEach((el, i) => {
    animate(
      el,
      { opacity: [0, 1], transform: ['translateY(10px) scale(0.995)', 'translateY(0px) scale(1)'] },
      { ...SPRING, delay: i * step }
    )
  })
}
