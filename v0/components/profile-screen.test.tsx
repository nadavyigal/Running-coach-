import { render, screen, waitFor } from '@testing-library/react';
import { ProfileScreen } from './profile-screen';
import { dbUtils } from '@/lib/dbUtils';
import { vi } from 'vitest';

// Mock the BadgeCabinet component
vi.mock('./badge-cabinet', () => ({
  BadgeCabinet: ({ userId }: { userId: number }) => (
    <div data-testid="badge-cabinet">Badge Cabinet for user {userId}</div>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
    back: () => {},
    forward: () => {},
    refresh: () => {},
  }),
}))

// Mock dbUtils
vi.mock('@/lib/dbUtils', () => ({
  dbUtils: {
    getCurrentUser: vi.fn(),
    initializeDatabase: vi.fn(),
    checkAndUnlockBadges: vi.fn(),
  },
}));

// Mock useToast
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock auth context
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

describe('ProfileScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (dbUtils.initializeDatabase as vi.Mock).mockResolvedValue(true);
    (dbUtils.getCurrentUser as vi.Mock).mockResolvedValue({ id: 1 });
    (dbUtils.checkAndUnlockBadges as vi.Mock).mockResolvedValue([]);
  });

  it('renders badge cabinet and shows empty state', async () => {
    render(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('badge-cabinet')).toBeInTheDocument();
      expect(screen.getByText('Badge Cabinet for user 1')).toBeInTheDocument();
    });
  });
});
