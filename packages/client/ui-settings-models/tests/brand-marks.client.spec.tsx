// @vitest-environment jsdom
/** ProviderMark renders an inline logomark for the shipped assets and a monogram otherwise. */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ProviderMark } from '../src/client/BrandMarks.tsx'

afterEach(cleanup)

describe('ProviderMark', () => {
  it('renders the inline logomark for each shipped logo id', () => {
    for (const logo of ['openai', 'anthropic', 'xai', 'github', 'kimi', 'openrouter'] as const) {
      const { container, unmount } = render(<ProviderMark logo={logo} name="X" />)
      const svg = container.querySelector('svg')
      expect(svg).not.toBeNull()
      // The logomark carries a path; the monogram carries a rect + text instead.
      expect(svg?.querySelector('path')).not.toBeNull()
      expect(svg?.querySelector('text')).toBeNull()
      unmount()
    }
  })

  it('renders a monogram from the name when the logo is unknown or absent', () => {
    for (const logo of [undefined, 'unknown-logo']) {
      const { container, unmount } = render(<ProviderMark logo={logo} name="kimi" />)
      const svg = container.querySelector('svg')
      expect(svg?.querySelector('rect')).not.toBeNull()
      expect(svg?.querySelector('text')?.textContent).toBe('K')
      unmount()
    }
  })

  it('falls back to a placeholder letter for an empty name', () => {
    const { container } = render(<ProviderMark name="  " />)
    expect(container.querySelector('svg text')?.textContent).toBe('?')
  })
})
