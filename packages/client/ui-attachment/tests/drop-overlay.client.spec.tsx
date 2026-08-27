// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { DropOverlay } from '../src/DropOverlay.tsx'

afterEach(cleanup)

describe('DropOverlay', () => {
  it('portals the invitation with its title and limits desc to the body', () => {
    const view = render(
      <DropOverlay disabled={false} labels={{ title: 'Sleep afbeeldingen hierheen om ze toe te voegen', desc: 'Tot 20 afbeeldingen, 5MB per stuk' }} />,
    )
    const overlay = view.getByRole('status')
    expect(overlay.parentElement).toBe(document.body)
    expect(overlay.textContent).toContain('Sleep afbeeldingen hierheen om ze toe te voegen')
    expect(overlay.textContent).toContain('Tot 20 afbeeldingen, 5MB per stuk')
  })

  it('omits the desc line when none is resolved', () => {
    const view = render(<DropOverlay disabled={false} labels={{ title: 'Sleep afbeeldingen hierheen om ze toe te voegen' }} />)
    expect(view.getByRole('status').textContent).toBe('Sleep afbeeldingen hierheen om ze toe te voegen')
  })

  it('drops the desc and switches the illustration while disabled', () => {
    const enabled = render(
      <DropOverlay disabled={false} labels={{ title: 'Slepen', desc: 'Limiet' }} />,
    )
    const enabledSvg = enabled.getByRole('status').querySelector('svg')!.innerHTML
    enabled.unmount()
    const disabled = render(
      <DropOverlay disabled labels={{ title: 'Afbeeldingen kunnen nu niet worden toegevoegd', desc: 'Limiet' }} />,
    )
    const overlay = disabled.getByRole('status')
    expect(overlay.textContent).toBe('Afbeeldingen kunnen nu niet worden toegevoegd')
    expect(overlay.querySelector('svg')!.innerHTML).not.toBe(enabledSvg)
  })
})
