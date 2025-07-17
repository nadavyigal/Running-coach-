import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { JoinCohortModal } from './join-cohort-modal';
import { useToast } from '@/hooks/use-toast';

// Mock the useToast hook
import { vi } from 'vitest';

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(),
}));

// Mock the fetch API
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ message: 'Successfully joined cohort!' }),
  })
) as vi.Mock;

describe('JoinCohortModal', () => {
  const mockOnClose = vi.fn();
  const mockToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as vi.Mock).mockReturnValue({ toast: mockToast });
  });

  it('renders correctly when open', () => {
    render(<JoinCohortModal isOpen={true} onClose={mockOnClose} userId={1} />);
    expect(screen.getByText('Join a Community Cohort')).toBeInTheDocument();
    expect(screen.getByLabelText('Invite Code')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join Cohort' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<JoinCohortModal isOpen={false} onClose={mockOnClose} userId={1} />);
    expect(screen.queryByText('Join a Community Cohort')).not.toBeInTheDocument();
  });

  it('updates invite code on input change', () => {
    render(<JoinCohortModal isOpen={true} onClose={mockOnClose} userId={1} />);
    const input = screen.getByLabelText('Invite Code');
    fireEvent.change(input, { target: { value: 'TESTCODE' } });
    expect(input).toHaveValue('TESTCODE');
  });

  it('calls onClose when Cancel button is clicked', () => {
    render(<JoinCohortModal isOpen={true} onClose={mockOnClose} userId={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('shows error toast if invite code is empty on join attempt', async () => {
    render(<JoinCohortModal isOpen={true} onClose={mockOnClose} userId={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Join Cohort' }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Please enter an invite code.',
        variant: 'destructive',
      });
    });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('successfully joins cohort and calls onClose', async () => {
    render(<JoinCohortModal isOpen={true} onClose={mockOnClose} userId={1} />);
    const input = screen.getByLabelText('Invite Code');
    fireEvent.change(input, { target: { value: 'VALIDCODE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join Cohort' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/cohort/join',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ inviteCode: 'VALIDCODE', userId: 1 }),
        })
      );
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Successfully joined cohort!',
      });
    });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('shows error toast on API failure', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ message: 'Invalid invite code' }),
      })
    );

    render(<JoinCohortModal isOpen={true} onClose={mockOnClose} userId={1} />);
    const input = screen.getByLabelText('Invite Code');
    fireEvent.change(input, { target: { value: 'INVALID' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join Cohort' }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Invalid invite code',
        variant: 'destructive',
      });
    });
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('disables button while loading', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve({
      ok: true,
      json: () => Promise.resolve({ message: 'Successfully joined cohort!' }),
    }), 500)));

    render(<JoinCohortModal isOpen={true} onClose={mockOnClose} userId={1} />);
    const input = screen.getByLabelText('Invite Code');
    fireEvent.change(input, { target: { value: 'VALIDCODE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join Cohort' }));

    expect(screen.getByRole('button', { name: 'Joining...' })).toBeDisabled();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Join Cohort' })).not.toBeDisabled();
    });
  });
});
