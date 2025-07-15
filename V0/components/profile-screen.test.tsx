import { render, screen, waitFor } from '@testing-library/react';
import { ProfileScreen } from './profile-screen';
import { dbUtils } from '@/lib/db';

describe('ProfileScreen Badge Cabinet', () => {
  it('renders badge cabinet and shows empty state', async () => {
    render(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Badge Cabinet/i)).toBeInTheDocument();
      expect(screen.getByText(/No badges earned yet/i)).toBeInTheDocument();
    });
  });
}); 