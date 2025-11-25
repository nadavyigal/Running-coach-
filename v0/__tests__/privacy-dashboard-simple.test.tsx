import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PrivacyDashboard, UserPrivacySettings } from '@/components/privacy-dashboard'

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn().mockReturnValue({
    toast: vi.fn()
  })
}))

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-url')
global.URL.revokeObjectURL = vi.fn()

// Mock document methods for file download
const mockCreateElement = vi.fn()
const mockAppendChild = vi.fn()
const mockRemoveChild = vi.fn()
const mockClick = vi.fn()

global.document.createElement = mockCreateElement.mockReturnValue({
  click: mockClick,
  href: '',
  download: ''
})

global.document.body.appendChild = mockAppendChild
global.document.body.removeChild = mockRemoveChild

describe('PrivacyDashboard - Basic Functionality', () => {
  const mockOnSettingsChange = vi.fn()

  const defaultUser = {
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
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    const { container } = render(
      <PrivacyDashboard
        user={defaultUser}
        onSettingsChange={mockOnSettingsChange}
      />
    )
    expect(container).toBeDefined()
  })

  it('displays privacy dashboard title', () => {
    render(
      <PrivacyDashboard
        user={defaultUser}
        onSettingsChange={mockOnSettingsChange}
      />
    )

    expect(screen.getByText('Privacy & Data Control')).toBeInTheDocument()
  })

  it('shows GDPR compliance section', () => {
    render(
      <PrivacyDashboard
        user={defaultUser}
        onSettingsChange={mockOnSettingsChange}
      />
    )

    expect(screen.getByText('GDPR Compliance')).toBeInTheDocument()
  })
})