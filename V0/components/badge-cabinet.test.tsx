import { render, screen } from '@testing-library/react';
import { BadgeCabinet } from './badge-cabinet';
import { Badge, dbUtils } from '@/lib/db';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/db', async () => {
    const actual = await vi.importActual('@/lib/db');
    return {
        ...actual,
        dbUtils: {
            ...actual.dbUtils,
            getUserBadges: vi.fn(),
        },
    };
});


describe('BadgeCabinet', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

  it('shows empty state when no badges are returned', async () => {
    (dbUtils.getUserBadges as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    render(<BadgeCabinet userId={123} />);
    expect(await screen.findByText(/No badges earned yet/i)).toBeInTheDocument();
  });

  it('renders badges when provided', async () => {
    const badges: Badge[] = [
      { id: 1, userId: 123, type: 'bronze', milestone: 3, unlockedAt: new Date(), streakValueAchieved: 3 },
      { id: 2, userId: 123, type: 'silver', milestone: 7, unlockedAt: new Date(), streakValueAchieved: 7 },
    ];
    (dbUtils.getUserBadges as ReturnType<typeof vi.fn>).mockResolvedValue(badges);
    render(<BadgeCabinet userId={123} />);

    expect(await screen.findByText(/Bronze Badge/i)).toBeInTheDocument();
    expect(await screen.findByText(/Silver Badge/i)).toBeInTheDocument();
  });
});