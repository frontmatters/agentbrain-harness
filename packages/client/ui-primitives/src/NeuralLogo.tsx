// The official agentBrain logo: the animated neural node-graph from
// getagentbrain.com (its `initNeuralLogo` canvas) — one centre hub plus nine
// nodes on a sphere, linked hub-to-rim and around a rim ring, projected with a
// small perspective and spun slowly around the vertical axis on a canvas. Ink
// follows the element's currentColor, so it stays monochrome with the
// surrounding brand ink; holds a static frame under prefers-reduced-motion and
// pauses while off-screen. BrainMark is the flat, static counterpart.

import { useEffect, useRef } from 'react'
import type { IconProps } from './icons/props.ts'

/** Unit-sphere node positions; index 0 is the centre hub. */
const NODES: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [0.95, 0.25, 0.15], [-0.85, 0.35, -0.25], [0.2, 0.92, -0.35],
  [-0.25, -0.85, 0.3], [0.55, -0.55, -0.65], [-0.6, -0.15, 0.8],
  [0.72, 0.55, -0.5], [-0.5, 0.7, 0.55], [0.1, -0.45, 0.85],
]

/** Edges: every rim node to the hub, then a ring threading the rim. */
const EDGES: readonly (readonly [number, number])[] = [
  [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 9],
  [1, 7], [7, 3], [3, 8], [8, 2], [2, 6], [6, 9], [9, 5], [5, 1], [4, 9], [4, 5],
]

/**
 * Render the animated agentBrain logo.
 * @param props.size - width and height in px (default 24; the mark is square).
 * @param props.className - extra class for layout placement.
 * @returns the animated logo canvas (aria-hidden; pair with the wordmark for accessibility).
 */
export function NeuralLogo({ size = 24, className }: IconProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    cv.width = size * dpr
    cv.height = size * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    let ang = 0.6
    let raf = 0
    let onScreen = true
    const frame = (): void => {
      raf = 0
      if (!reduce) ang += 0.005
      const col = getComputedStyle(cv).color || '#888888'
      const cx = size / 2
      const cy = size / 2
      const R = size * 0.32
      const f = 3.2
      const ca = Math.cos(ang)
      const sa = Math.sin(ang)
      const P = NODES.map(([x, y, z]) => {
        const xr = x * ca + z * sa
        const zr = -x * sa + z * ca
        const s = f / (f - zr)
        return [cx + xr * R * s, cy + y * R * s, zr, s] as const
      })
      ctx.clearRect(0, 0, size, size)
      ctx.lineCap = 'round'
      ctx.strokeStyle = col
      for (const [i, j] of EDGES) {
        const a = P[i]
        const b = P[j]
        if (!a || !b) continue
        const depth = (a[2] + b[2]) / 2
        ctx.globalAlpha = 0.22 + 0.33 * ((depth + 1) / 2)
        ctx.lineWidth = 0.85 * ((a[3] + b[3]) / 2)
        ctx.beginPath()
        ctx.moveTo(a[0], a[1])
        ctx.lineTo(b[0], b[1])
        ctx.stroke()
      }
      const order = P.map((_, i) => i).sort((i, j) => (P[i]?.[2] ?? 0) - (P[j]?.[2] ?? 0))
      ctx.fillStyle = col
      for (const idx of order) {
        const p = P[idx]
        if (!p) continue
        ctx.globalAlpha = 0.5 + 0.5 * ((p[2] + 1) / 2)
        const r = (idx === 0 ? 2.1 : 1.5) * p[3]
        ctx.beginPath()
        ctx.arc(p[0], p[1], r, 0, 6.283)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      if (!reduce && onScreen) raf = requestAnimationFrame(frame)
    }
    const wake = (): void => {
      if (!raf && onScreen) raf = requestAnimationFrame(frame)
    }

    let io: IntersectionObserver | undefined
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          onScreen = entry.isIntersecting
          if (onScreen && !reduce) wake()
        }
      })
      io.observe(cv)
    }
    frame()
    return () => {
      if (raf) cancelAnimationFrame(raf)
      io?.disconnect()
    }
  }, [size])

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      style={{ width: size, height: size }}
    />
  )
}
