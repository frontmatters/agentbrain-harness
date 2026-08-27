import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const DIST_ROOT = fileURLToPath(new URL('../dist', import.meta.url))

it('ships install metadata with the built web application', async () => {
  const index = await readFile(join(DIST_ROOT, 'index.html'), 'utf8')
  expect(index).toContain('<link rel="manifest" href="/manifest.webmanifest" />')

  const manifest: unknown = JSON.parse(await readFile(join(DIST_ROOT, 'manifest.webmanifest'), 'utf8'))
  expect(manifest).toEqual({
    id: '/',
    name: 'agentBrain Harness',
    short_name: 'ABH',
    start_url: '/',
    scope: '/',
    display: 'fullscreen',
    icons: [{
      src: '/favicon.svg',
      sizes: 'any',
      type: 'image/svg+xml',
      purpose: 'any',
    }],
  })
})

it('ships the self-contained agentBrain favicon chip', async () => {
  const favicon = await readFile(join(DIST_ROOT, 'favicon.svg'), 'utf8')
  // The mark is a self-contained chip: its own dark rounded-rect background
  // carries the light node-graph marks, so it stays legible on light and dark
  // tab bars without a prefers-color-scheme switch.
  expect(favicon).toContain('fill="#1f2126"')
  expect(favicon).toContain('stroke="#e8e8ea"')
  expect(favicon).not.toContain('prefers-color-scheme')
})
