import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PrivacyDashboard, UserPrivacySettings } from '@/components/privacy-dashboard'
import { useToast } from '@/hooks/use-toast'

// Test setup will be handled by vitest.setup.ts

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn()
}))

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-url')
global.URL.revokeObjectURL = vi.fn()

// Mock document.createElement and appendChild
const mockClick = vi.fn()
const originalCreateElement = document.createElement.bind(document)
let createElementSpy: ReturnType<typeof vi.spyOn>

describe('PrivacyDashboard', () => {
  const mockToast = vi.fn()
  const mockOnSettingsChange = vi.fn()

  const buildDefaultUser = () => ({
    id: 1,
    name: 'Test User',
    privacySettings: {
      dataCollection: {
        location: true,
        performance: true,
        analytics: true,
        coaching: true,
      },
      consentHistory: [],
      exportData: false,
      deleteData: false,
    }
  })

  let defaultUser = buildDefaultUser()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useToast as any).mockReturnValue({ toast: mockToast })
    defaultUser = buildDefaultUser()
    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName)
      if (tagName.toLowerCase() === 'a') {
        ;(element as HTMLAnchorElement).click = mockClick
      }
      return element
    })
  })

  afterEach(() => {
    createElementSpy.mockRestore()
  })

  it('renders privacy dashboard with correct title', () => {
    render(
      <PrivacyDashboard
        user={defaultUser}
        onSettingsChange={mockOnSettingsChange}
      />
    )

    expect(screen.getByText('Privacy & Data Control')).toBeInTheDocument()
    expect(screen.getByText('Control what data we collect and how it\'s used to improve your running experience')).toBeInTheDocument()
  })

  it('displays all data collection categories', () => {
    render(
      <PrivacyDashboard
        user={defaultUser}
        onSettingsChange={mockOnSettingsChange}
      />
    )

    expect(screen.getByText('Location Data')).toBeInTheDocument()
    expect(screen.getByText('Performance Metrics')).toBeInTheDocument()
    expect(screen.getByText('Analytics & Insights')).toBeInTheDocument()
    expect(screen.getByText('AI Coaching Data')).toBeInTheDocument()
  })

  it('shows required badges for required categories', () => {
    render(
      <PrivacyDashboard
        user={defaultUser}
        onSettingsChange={mockOnSettingsChange}
      />
    )

    const requiredBadges = screen.getAllByText('Required')
    expect(requiredBadges).toHaveLength(2) // Location and Performance are required
  })

  it('allows toggling non-required data collection settings', async () => {
    render(
      <PrivacyDashboard
        user={defaultUser}
        onSettingsChange={mockOnSettingsChange}
      />
    )

    const analyticsSwitch = screen.getByRole('switch', { name: /Analytics & Insights data collection/i })
    fireEvent.click(analyticsSwitch)

    await waitFor(() => {
      expect(mockOnSettingsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          dataCollection: expect.objectContaining({
            analytics: false
          })
        })
      )
    })

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Privacy Setting Updated',
      description: 'analytics data collection disabled'
    })
  })

  it('prevents toggling required data collection settings', () => {
    render(
      <PrivacyDashboard
        user={defaultUser}
        onSettingsChange={mockOnSettingsChange}
      />
    )

    const locationSwitch = screen.getByRole('switch', { name: /Location Data data collection/i })
    expect(locationSwitch).toBeDisabled()
  })

  it('displays consent history when available', () => {
    const userWithHistory = {
      ...defaultUser,
      privacySettings: {
        ...defaultUser.privacySettings,
        consentHistory: [
          {
            timestamp: new Date('2024-01-01'),
            consentType: 'analytics',
            granted: true
          },
          {
            timestamp: new Date('2024-01-02'),
            consentType: 'coaching',
            granted: false
          }
        ]
      }
    }

    render(
      <PrivacyDashboard
        user={userWithHistory}
        onSettingsChange={mockOnSettingsChange}
      />
    )

    const accordionTrigger = screen.getByText('View Consent History')
    fireEvent.click(accordionTrigger)

    expect(screen.getByText('analytics')).toBeInTheDocument()
    expect(screen.getByText('coaching')).toBeInTheDocument()
    expect(screen.getByText('Granted')).toBeInTheDocument()
    expect(screen.getByText('Denied')).toBeInTheDocument()
  })

  it('shows empty state for consent history when none exists', async () => {
    render(
      <PrivacyDashboard
        user={defaultUser}
        onSettingsChange={mockOnSettingsChange}
      />
    )

    const accordionTrigger = screen.getByText('View Consent History')
    fireEvent.click(accordionTrigger)

    await waitFor(() => {
      expect(screen.getByText('No consent changes recorded yet.')).toBeInTheDocument()
    })
  })

  it('handles data export functionality', async () => {
    render(
      <PrivacyDashboard
        user={defaultUser}
        onSettingsChange={mockOnSettingsChange}
      />
    )

    const exportButton = screen.getByText('Export Data')
    fireEvent.click(exportButton)

    expect(screen.getByText('Exporting...')).toBeInTheDocument()

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Data Exported',
        description: 'Your privacy data has been downloaded successfully.'
      })
    })
  })

  it('handles data deletion functionality', async () => {
    render(
      <PrivacyDashboard
        user={defaultUser}
        onSettingsChange={mockOnSettingsChange}
      />
    )

    const deleteButton = screen.getByText('Request Deletion')
    fireEvent.click(deleteButton)

    expect(screen.getByText('Processing...')).toBeInTheDocument()

    await waitFor(() => {
      expect(mockOnSettingsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          dataCollection: {
            location: false,
            performance: false,
            analytics: false,
            coaching: false,
          },
          deleteData: true
        })
      )
    })

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Data Deletion Requested',
      description: 'Your data deletion request has been submitted. This process may take up to 30 days.'
    })
  })

  it('displays GDPR compliance notice', () => {
    render(
      <PrivacyDashboard
        user={defaultUser}
        onSettingsChange={mockOnSettingsChange}
      />
    )

    expect(screen.getByText('GDPR Compliance')).toBeInTheDocument()
    expect(screen.getByText(/Run-Smart is committed to protecting your privacy/)).toBeInTheDocument()
  })

  it('initializes with default settings when user has no privacy settings', () => {
    const userWithoutSettings = {
      id: 1,
      name: 'Test User'
    }

    render(
      <PrivacyDashboard
        user={userWithoutSettings}
        onSettingsChange={mockOnSettingsChange}
      />
    )

    // Should still render all the components
    expect(screen.getByText('Privacy & Data Control')).toBeInTheDocument()
    expect(screen.getByText('Data Collection Preferences')).toBeInTheDocument()
  })

  it('tracks consent history when settings are changed', async () => {
    render(
      <PrivacyDashboard
        user={defaultUser}
        onSettingsChange={mockOnSettingsChange}
      />
    )

    const analyticsSwitch = screen.getByRole('switch', { name: /Analytics & Insights data collection/i })
    fireEvent.click(analyticsSwitch)

    await waitFor(() => {
      expect(mockOnSettingsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          consentHistory: expect.arrayContaining([
            expect.objectContaining({
              consentType: 'analytics',
              granted: false
            })
          ])
        })
      )
    })
  })
}) 
