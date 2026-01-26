import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoricRunUploadModal } from './historic-run-upload-modal';
import { HistoricRunCard } from './historic-run-card';
import type { HistoricRunEntry } from './types';

// Mock the AI activity client
vi.mock('@/lib/ai-activity-client', () => ({
  analyzeActivityImage: vi.fn(),
  AiActivityAnalysisError: class extends Error {
    errorCode?: string;
    constructor(message: string, options?: { errorCode?: string }) {
      super(message);
      this.errorCode = options?.errorCode;
    }
  },
}));

// Mock toast
vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn(),
}));

describe('HistoricRunCard', () => {
  const mockRun: HistoricRunEntry = {
    distance: 10.5,
    time: 3600, // 1 hour
    date: new Date('2024-01-15'),
    type: 'long',
    notes: 'Great morning run',
  };

  it('renders run details correctly', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(<HistoricRunCard run={mockRun} onEdit={onEdit} onDelete={onDelete} />);

    expect(screen.getByText(/10.5 km in 1:00:00/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
    expect(screen.getByText(/Great morning run/)).toBeInTheDocument();
    expect(screen.getByText(/Long/i)).toBeInTheDocument();
  });

  it('formats pace correctly', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    // 10.5 km in 3600 seconds = 5:42/km pace
    render(<HistoricRunCard run={mockRun} onEdit={onEdit} onDelete={onDelete} />);

    expect(screen.getByText(/5:42\/km/)).toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(<HistoricRunCard run={mockRun} onEdit={onEdit} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when remove button is clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(<HistoricRunCard run={mockRun} onEdit={onEdit} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /remove/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('handles run without type gracefully', () => {
    const runWithoutType: HistoricRunEntry = {
      distance: 5,
      time: 1800,
      date: new Date('2024-01-10'),
    };
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(<HistoricRunCard run={runWithoutType} onEdit={onEdit} onDelete={onDelete} />);

    expect(screen.getByText(/5 km in 30:00/)).toBeInTheDocument();
    expect(screen.queryByText(/Easy|Tempo|Long|Intervals|Race/)).not.toBeInTheDocument();
  });

  it('handles run without notes gracefully', () => {
    const runWithoutNotes: HistoricRunEntry = {
      distance: 5,
      time: 1800,
      date: new Date('2024-01-10'),
      type: 'easy',
    };
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(<HistoricRunCard run={runWithoutNotes} onEdit={onEdit} onDelete={onDelete} />);

    expect(screen.getByText(/5 km in 30:00/)).toBeInTheDocument();
    expect(screen.getByText(/Easy/)).toBeInTheDocument();
  });
});

describe('HistoricRunUploadModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders upload step by default', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();

    render(<HistoricRunUploadModal onClose={onClose} onSave={onSave} />);

    expect(screen.getByText(/Add historical run/)).toBeInTheDocument();
    expect(screen.getByText(/Upload a workout screenshot/)).toBeInTheDocument();
    expect(screen.getByText(/Drag and drop or click to browse/)).toBeInTheDocument();
  });

  it('renders review step when initialRun is provided', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    const initialRun: HistoricRunEntry = {
      distance: 10,
      time: 3000,
      date: new Date('2024-01-15'),
      type: 'tempo',
      notes: 'Test notes',
    };

    render(<HistoricRunUploadModal onClose={onClose} onSave={onSave} initialRun={initialRun} />);

    expect(screen.getByText(/Edit historical run/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('10')).toBeInTheDocument();
    expect(screen.getByDisplayValue('50:00')).toBeInTheDocument();
    expect(screen.getByText(/Test notes/)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSave = vi.fn();

    render(<HistoricRunUploadModal onClose={onClose} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when back arrow is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSave = vi.fn();

    render(<HistoricRunUploadModal onClose={onClose} onSave={onSave} />);

    // Find the back arrow button (first button with ArrowLeft icon)
    const backButton = screen.getAllByRole('button')[0];
    await user.click(backButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe('Form validation in review step', () => {
    it('shows error toast for invalid distance', async () => {
      const { toast } = await import('@/components/ui/use-toast');
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSave = vi.fn();
      const initialRun: HistoricRunEntry = {
        distance: 10,
        time: 3000,
        date: new Date('2024-01-15'),
        type: 'easy',
      };

      render(<HistoricRunUploadModal onClose={onClose} onSave={onSave} initialRun={initialRun} />);

      // Clear distance field
      const distanceInput = screen.getByDisplayValue('10');
      await user.clear(distanceInput);
      await user.type(distanceInput, '0');

      // Click save
      await user.click(screen.getByRole('button', { name: /save run/i }));

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          title: 'Invalid distance',
        })
      );
      expect(onSave).not.toHaveBeenCalled();
    });

    it('shows error toast for invalid duration', async () => {
      const { toast } = await import('@/components/ui/use-toast');
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSave = vi.fn();
      const initialRun: HistoricRunEntry = {
        distance: 10,
        time: 3000,
        date: new Date('2024-01-15'),
        type: 'easy',
      };

      render(<HistoricRunUploadModal onClose={onClose} onSave={onSave} initialRun={initialRun} />);

      // Clear duration field
      const durationInput = screen.getByDisplayValue('50:00');
      await user.clear(durationInput);

      // Click save
      await user.click(screen.getByRole('button', { name: /save run/i }));

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          title: 'Invalid duration',
        })
      );
      expect(onSave).not.toHaveBeenCalled();
    });

    it('calls onSave with valid data', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSave = vi.fn();
      const initialRun: HistoricRunEntry = {
        distance: 10,
        time: 3000,
        date: new Date('2024-01-15'),
        type: 'easy',
      };

      render(<HistoricRunUploadModal onClose={onClose} onSave={onSave} initialRun={initialRun} />);

      // Click save with valid data
      await user.click(screen.getByRole('button', { name: /save run/i }));

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          distance: 10,
          time: 3000,
          type: 'easy',
        })
      );
    });
  });

  describe('Run type selection', () => {
    it('allows selecting different run types', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSave = vi.fn();
      const initialRun: HistoricRunEntry = {
        distance: 10,
        time: 3000,
        date: new Date('2024-01-15'),
        type: 'easy',
      };

      render(<HistoricRunUploadModal onClose={onClose} onSave={onSave} initialRun={initialRun} />);

      // Click on Tempo type
      const tempoButton = screen.getByRole('button', { name: /tempo/i });
      await user.click(tempoButton);

      // Click save
      await user.click(screen.getByRole('button', { name: /save run/i }));

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tempo',
        })
      );
    });
  });

  describe('Duration parsing', () => {
    it('parses mm:ss format correctly', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSave = vi.fn();
      const initialRun: HistoricRunEntry = {
        distance: 10,
        time: 3000,
        date: new Date('2024-01-15'),
        type: 'easy',
      };

      render(<HistoricRunUploadModal onClose={onClose} onSave={onSave} initialRun={initialRun} />);

      // Update duration to 42:30 (42 min 30 sec = 2550 seconds)
      const durationInput = screen.getByDisplayValue('50:00');
      await user.clear(durationInput);
      await user.type(durationInput, '42:30');

      await user.click(screen.getByRole('button', { name: /save run/i }));

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          time: 2550,
        })
      );
    });

    it('parses h:mm:ss format correctly', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSave = vi.fn();
      const initialRun: HistoricRunEntry = {
        distance: 42.2,
        time: 14400, // 4 hours
        date: new Date('2024-01-15'),
        type: 'race',
      };

      render(<HistoricRunUploadModal onClose={onClose} onSave={onSave} initialRun={initialRun} />);

      // Update duration to 3:45:30 (3h 45m 30s = 13530 seconds)
      const durationInput = screen.getByDisplayValue('4:00:00');
      await user.clear(durationInput);
      await user.type(durationInput, '3:45:30');

      await user.click(screen.getByRole('button', { name: /save run/i }));

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          time: 13530,
        })
      );
    });
  });

  describe('Notes handling', () => {
    it('includes notes when provided', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSave = vi.fn();
      const initialRun: HistoricRunEntry = {
        distance: 10,
        time: 3000,
        date: new Date('2024-01-15'),
        type: 'easy',
      };

      render(<HistoricRunUploadModal onClose={onClose} onSave={onSave} initialRun={initialRun} />);

      // Add notes
      const notesInput = screen.getByPlaceholderText(/Add anything memorable/);
      await user.type(notesInput, 'Beautiful sunrise run');

      await user.click(screen.getByRole('button', { name: /save run/i }));

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: 'Beautiful sunrise run',
        })
      );
    });

    it('omits notes when empty or whitespace', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSave = vi.fn();
      const initialRun: HistoricRunEntry = {
        distance: 10,
        time: 3000,
        date: new Date('2024-01-15'),
        type: 'easy',
        notes: 'Original notes',
      };

      render(<HistoricRunUploadModal onClose={onClose} onSave={onSave} initialRun={initialRun} />);

      // Clear notes
      const notesInput = screen.getByText('Original notes').closest('textarea')!;
      await user.clear(notesInput);
      await user.type(notesInput, '   '); // Just whitespace

      await user.click(screen.getByRole('button', { name: /save run/i }));

      const savedData = onSave.mock.calls[0][0];
      expect(savedData.notes).toBeUndefined();
    });
  });

  describe('Pace calculation', () => {
    it('displays calculated pace', async () => {
      const onClose = vi.fn();
      const onSave = vi.fn();
      const initialRun: HistoricRunEntry = {
        distance: 10,
        time: 3000, // 50 minutes = 5:00/km
        date: new Date('2024-01-15'),
        type: 'easy',
      };

      render(<HistoricRunUploadModal onClose={onClose} onSave={onSave} initialRun={initialRun} />);

      expect(screen.getByText(/Pace: 5:00\/km/)).toBeInTheDocument();
    });

    it('shows placeholder for invalid distance/duration', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSave = vi.fn();
      const initialRun: HistoricRunEntry = {
        distance: 10,
        time: 3000,
        date: new Date('2024-01-15'),
        type: 'easy',
      };

      render(<HistoricRunUploadModal onClose={onClose} onSave={onSave} initialRun={initialRun} />);

      // Clear distance to make pace invalid
      const distanceInput = screen.getByDisplayValue('10');
      await user.clear(distanceInput);

      expect(screen.getByText(/Pace: --:--\/km/)).toBeInTheDocument();
    });
  });
});
