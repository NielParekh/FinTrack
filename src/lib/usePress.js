import { useEffect, useRef } from 'react'
import { pressIn, pressOut } from './motion'

// Attaches spring press feedback to every button inside a subtree.
// Delegated via Pointer Events so it covers buttons rendered later, and
// fires on pointer-DOWN — waiting for click makes the UI feel dead.
export function usePressFeedback(ref) {
  useEffect(() => {
    const root = ref.current
    if (!root) return

    const pressed = new Map()

    function target(e) {
      return e.target.closest('button:not(:disabled), .stat-card--link')
    }

    function onDown(e) {
      const el = target(e)
      if (!el) return
      // Capture keeps tracking even if the pointer leaves the element
      try { el.setPointerCapture(e.pointerId) } catch { /* not capturable */ }
      pressed.set(e.pointerId, el)
      pressIn(el)
    }

    function release(e) {
      const el = pressed.get(e.pointerId)
      if (!el) return
      pressed.delete(e.pointerId)
      pressOut(el)
    }

    root.addEventListener('pointerdown', onDown)
    root.addEventListener('pointerup', release)
    root.addEventListener('pointercancel', release)

    return () => {
      root.removeEventListener('pointerdown', onDown)
      root.removeEventListener('pointerup', release)
      root.removeEventListener('pointercancel', release)
    }
  }, [ref])
}

// Re-runs an enter animation whenever `key` changes.
export function useEnterOnChange(key, fn) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) fn(ref.current)
  }, [key])
  return ref
}
