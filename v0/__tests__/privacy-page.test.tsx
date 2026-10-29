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
    expect(screen.getByText(/support@runsmart-ai\.com/i)).toBeInTheDocument()
  })

  it('distinguishes native account storage from browser-only data', () => {
    render(<PrivacyPolicy />)
    expect(screen.getByRole('heading', { name: 'Storage and service providers' })).toBeInTheDocument()
    expect(screen.getByText(/Clearing browser data or uninstalling the app does not delete your RunSmart account/i)).toBeInTheDocument()
    expect(screen.queryByText(/We do not maintain a central database/i)).not.toBeInTheDocument()
  })

  it('explains optional map sharing without advertising deferred Strava', () => {
    render(<PrivacyPolicy />)
    expect(screen.getByRole('heading', { name: 'Sharing a run' })).toBeInTheDocument()
    expect(screen.getByText(/first and last 200 metres/i)).toBeInTheDocument()
    expect(screen.getByText(/not a guarantee of anonymity/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Strava/i })).not.toBeInTheDocument()
  })

  it('discloses account-linked analytics and optional Health writes', () => {
    render(<PrivacyPolicy />)
    expect(screen.getByText(/usage events can be linked to your RunSmart account/i)).toBeInTheDocument()
    expect(screen.getByText(/route, pause events and estimated active calories/i)).toBeInTheDocument()
    expect(screen.queryByText(/These tools do not access your personal health or activity data/i)).not.toBeInTheDocument()
  })

  it('includes a working back-to-app link', () => {
    render(<PrivacyPolicy />)
    const backLink = screen.getByRole('link', { name: /back to app/i })
    expect(backLink).toHaveAttribute('href', '/')
  })
})

