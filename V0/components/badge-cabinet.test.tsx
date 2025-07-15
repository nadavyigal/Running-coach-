import { render, screen } from '@testing-library/react';
import { BadgeCabinet } from './badge-cabinet';
import { Badge } from '@/lib/db';

describe('BadgeCabinet', () => {
  it('shows empty state when no badges', () => {
    render(<BadgeCabinet userId={123} />);
    expect(screen.getByText(/No badges earned yet/i)).toBeInTheDocument();
  });
  it('renders badges when provided', () => {
    const badges: Badge[] = [
      { id: 1, userId: 123, type: 'bronze', milestone: 3, unlockedAt: new Date(), streakValueAchieved: 3 },
      { id: 2, userId: 123, type: 'silver', milestone: 7, unlockedAt: new Date(), streakValueAchieved: 7 },
    ];
    jest.spyOn(require('@/lib/db').dbUtils, 'getUserBadges').mockResolvedValueOnce(badges);
    render(<BadgeCabinet userId={123} />);
    expect(screen.getByText(/bronze badge/i)).toBeInTheDocument();
    expect(screen.getByText(/silver badge/i)).toBeInTheDocument();
  });
}); 