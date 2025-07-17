import { render, screen, waitFor } from '@testing-library/react';
import { ProfileScreen } from './profile-screen';
import { dbUtils } from '@/lib/db';
import { vi } from 'vitest';

// Mock the BadgeCabinet component
vi.mock('./badge-cabinet', () => ({
  BadgeCabinet: ({ userId }: { userId: number }) => (
    <div data-testid="badge-cabinet">Badge Cabinet for user {userId}</div>
  ),
}));

// Mock dbUtils
vi.mock('@/lib/db', () => ({
  dbUtils: {
    getCurrentUser: vi.fn(),
    checkAndUnlockBadges: vi.fn(),
  },
}));

// Mock useToast
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('ProfileScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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