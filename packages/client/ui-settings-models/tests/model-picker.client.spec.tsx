// @vitest-environment jsdom
/** The reusable model chooser: selection, loading, empty, and error states. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ModelPicker } from '../src/client/ModelPicker.tsx'

afterEach(cleanup)

describe('ModelPicker', () => {
  it('lists the models and reports the chosen id', () => {
    const onChange = vi.fn()
    render(<ModelPicker label="Model" models={['llama3.3', 'qwen2.5']} value={undefined} onChange={onChange} />)
    const select = screen.getByLabelText('Model') as HTMLSelectElement
    expect([...select.options].map(option => option.value)).toContain('qwen2.5')
    fireEvent.change(select, { target: { value: 'qwen2.5' } })
    expect(onChange).toHaveBeenCalledWith('qwen2.5')
  })

  it('reflects the selected value', () => {
    render(<ModelPicker label="Model" models={['a', 'b']} value="b" onChange={vi.fn()} />)
    expect(screen.getByLabelText<HTMLSelectElement>('Model').value).toBe('b')
  })

  it('disables and hints when no models are available', () => {
    render(<ModelPicker
      label="Model"
      models={[]}
      value={undefined}
      onChange={vi.fn()}
      emptyHint="No models found"
    />)
    expect(screen.getByLabelText<HTMLSelectElement>('Model').disabled).toBe(true)
    expect(screen.getByText('No models found')).toBeTruthy()
  })

  it('shows an error over the empty hint', () => {
    render(<ModelPicker
      label="Model"
      models={[]}
      value={undefined}
      onChange={vi.fn()}
      emptyHint="No models found"
      error="Probe failed"
    />)
    expect(screen.getByText('Probe failed')).toBeTruthy()
    expect(screen.queryByText('No models found')).toBeNull()
  })

  it('disables while busy', () => {
    render(<ModelPicker label="Model" models={['a']} value={undefined} onChange={vi.fn()} busy />)
    expect(screen.getByLabelText<HTMLSelectElement>('Model').disabled).toBe(true)
  })
})
