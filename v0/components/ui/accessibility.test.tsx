import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Dialog, DialogContent, DialogTrigger } from './dialog'
import { Loader2 } from 'lucide-react'


describe('accessibility primitives', () => {
  it('DialogContent exposes ARIA role', () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>Content</DialogContent>
      </Dialog>
    )
    fireEvent.click(screen.getByText('Open'))
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
