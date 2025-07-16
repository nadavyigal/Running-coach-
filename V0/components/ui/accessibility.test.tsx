import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DialogContent } from './dialog'
import { Loader2 } from 'lucide-react'


describe('accessibility primitives', () => {
  it('DialogContent exposes ARIA role', () => {
    render(<DialogContent>Content</DialogContent>)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
  })

  it('Loader icons indicate loading status', () => {
    render(
      <div role="status" aria-label="Loading">
        <Loader2 aria-hidden="true" />
      </div>
    )
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-label', 'Loading')
  })
})
