import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrivacyPolicy from '@/app/privacy/page'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => {
    const resolvedHref =
      typeof href === 'string' ? href : typeof href?.pathname === 'string' ? href.pathname : ''
    return (
      <a href={resolvedHref} {...props}>
        {children}
      </a>
    )
  },
}))

describe('/privacy page', () => {
  it('renders the privacy policy content', () => {
    render(<PrivacyPolicy />)
    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument()
    expect(screen.getByText(/support@runsmart\.app/i)).toBeInTheDocument()
  })

  it('includes a working back-to-app link', () => {
    render(<PrivacyPolicy />)
    const backLink = screen.getByRole('link', { name: /back to app/i })
    expect(backLink).toHaveAttribute('href', '/')
  })
})

