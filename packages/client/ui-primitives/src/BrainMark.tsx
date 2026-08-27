// agentBrain neural mark, static: a single frozen frame of the official
// animated NeuralLogo — the same 3D node-graph, projected once at a fixed
// rotation so the still mark and the moving logo read as one brand. The
// per-edge opacity/width and per-node radius/opacity are the projection's
// depth cues, baked as constants (viewBox 40x40). Ink follows the element's
// currentColor, so the mark stays monochrome with the surrounding brand ink.

import type { IconProps } from './icons/props.ts'

/** Projected edges as `[x1, y1, x2, y2, strokeOpacity, strokeWidth]`. */
const LINES: readonly (readonly [number, number, number, number, number, number])[] = [
  [20, 20, 24.92, 22.54, 0.32, 0.76],
  [20, 20, 11.13, 25.74, 0.44, 0.97],
  [20, 20, 17.04, 30.73, 0.36, 0.81],
  [20, 20, 22.71, 7.82, 0.41, 0.9],
  [20, 20, 15.78, 14.29, 0.32, 0.77],
  [20, 20, 29.2, 17.39, 0.46, 1],
  [20, 20, 17.93, 25.56, 0.31, 0.76],
  [20, 20, 25.36, 31.31, 0.44, 0.96],
  [20, 20, 31.37, 13.83, 0.4, 0.88],
  [24.92, 22.54, 17.93, 25.56, 0.25, 0.67],
  [17.93, 25.56, 17.04, 30.73, 0.29, 0.72],
  [17.04, 30.73, 25.36, 31.31, 0.41, 0.92],
  [25.36, 31.31, 11.13, 25.74, 0.5, 1.08],
  [11.13, 25.74, 29.2, 17.39, 0.51, 1.12],
  [29.2, 17.39, 31.37, 13.83, 0.47, 1.03],
  [31.37, 13.83, 15.78, 14.29, 0.34, 0.8],
  [15.78, 14.29, 24.92, 22.54, 0.25, 0.68],
  [22.71, 7.82, 31.37, 13.83, 0.43, 0.93],
  [22.71, 7.82, 15.78, 14.29, 0.35, 0.82],
]

/** Projected nodes, back-to-front, as `[cx, cy, r, fillOpacity]`. */
const NODES: readonly (readonly [number, number, number, number])[] = [
  [17.93, 25.56, 1.18, 0.54],
  [24.92, 22.54, 1.19, 0.54],
  [15.78, 14.29, 1.22, 0.56],
  [17.04, 30.73, 1.37, 0.67],
  [20, 20, 2.1, 0.75],
  [31.37, 13.83, 1.61, 0.8],
  [22.71, 7.82, 1.68, 0.84],
  [25.36, 31.31, 1.89, 0.92],
  [11.13, 25.74, 1.92, 0.93],
  [29.2, 17.39, 2.04, 0.96],
]

/**
 * Render the static agentBrain mark.
 * @param props.size - width and height in px (default 24; the mark is square).
 * @param props.className - extra class for layout placement.
 * @returns the static mark SVG (aria-hidden; pair with the wordmark for accessibility).
 */
export function BrainMark({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <g stroke="currentColor" strokeLinecap="round">
        {LINES.map(([x1, y1, x2, y2, opacity, width]) => (
          <line
            key={`${x1}-${y1}-${x2}-${y2}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            strokeOpacity={opacity}
            strokeWidth={width}
          />
        ))}
      </g>
      <g fill="currentColor">
        {NODES.map(([cx, cy, r, opacity]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fillOpacity={opacity} />
        ))}
      </g>
    </svg>
  )
}
