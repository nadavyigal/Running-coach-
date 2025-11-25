import { render, screen, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Toaster } from './toaster'
import { toast } from '@/hooks/use-toast'

describe('toast system', () => {
  it('renders success toast', async () => {
    render(<Toaster />)

    act(() => {
      toast({ title: 'Saved', description: 'Run saved' })
    })

    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })
})
