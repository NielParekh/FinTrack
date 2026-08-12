import { useState, useEffect } from 'react'

// Chart.js paints to canvas, so it can't read CSS variables — the axis and
// grid colors have to be passed in as literals that match the active theme.
export const CHART_COLORS = {
  light: { tick: '#71717a', grid: '#e4e4e7' },
  dark:  { tick: '#a1a1aa', grid: '#27272a' },
}

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light'
}

// The theme lives on a DOM attribute set by App, not in React state, so
// charts observe the attribute to know when to recolor.
export function useTheme() {
  const [theme, setTheme] = useState(currentTheme)

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(currentTheme()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  return { theme, colors: CHART_COLORS[theme] || CHART_COLORS.light }
}
