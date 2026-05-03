import type { CSSProperties } from 'react'
import { useEffect, useRef } from 'react'

export function GridBackground() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const onMove = (e: MouseEvent) => {
      el.style.setProperty('--spot-x', `${e.clientX}px`)
      el.style.setProperty('--spot-y', `${e.clientY}px`)
    }
    const onScroll = () => {
      if (reduce) return
      const y = window.scrollY * 0.015
      el.style.setProperty('--grid-parallax', `${y}px`)
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed inset-0 z-0"
      style={
        {
          '--grid-parallax': '0px',
          backgroundImage: `
            linear-gradient(rgba(118, 237, 75, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(118, 237, 75, 0.04) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
          backgroundPosition: '0 var(--grid-parallax, 0px)',
          maskImage:
            'radial-gradient(ellipse 70% 60% at 50% 40%, black 20%, transparent 75%)',
        } as CSSProperties
      }
    >
      <div
        className="absolute inset-0 opacity-40"
        style={
          {
            background: `radial-gradient(600px circle at var(--spot-x, 50%) var(--spot-y, 40%), rgba(118, 237, 75, 0.07), transparent 55%)`,
          } as CSSProperties
        }
      />
    </div>
  )
}
