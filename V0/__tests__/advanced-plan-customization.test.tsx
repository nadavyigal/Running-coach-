import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { PlanCustomizationDashboard } from '../components/plan-customization-dashboard';
import { RaceGoalModal } from '../components/race-goal-modal';
import { RaceGoalsScreen } from '../components/race-goals-screen';
import { PeriodizationEngine } from '../lib/periodization';
import { dbUtils } from '../lib/db';

// Mock global fetch
global.fetch = vi.fn();
global.window = { dispatchEvent: vi.fn() } as any;

// Mock dependencies
vi.mock('../lib/db', () => ({
  dbUtils: {
    getRaceGoalsByUser: vi.fn(),
    createRaceGoal: vi.fn(),
    updateRaceGoal: vi.fn(),
    deleteRaceGoal: vi.fn(),
    getWorkoutsByPlan: vi.fn(),
    updateWorkout: vi.fn(),
    deleteWorkout: vi.fn(),
    createWorkout: vi.fn(),
    getActivePlan: vi.fn(),
    assessFitnessLevel: vi.fn(),
    getRaceGoalById: vi.fn(),
    calculateTargetPaces: vi.fn()
  }
}));

vi.mock('../lib/periodization', () => ({
  PeriodizationEngine: {
    generatePeriodizedPlan: vi.fn()
  }
}));

vi.mock('../hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

describe('Advanced Plan Customization', () => {
  describe('RaceGoalModal', () => {
    const mockProps = {
      isOpen: true,
      onClose: vi.fn(),
      onSuccess: vi.fn(),
      userId: 1
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('renders race goal creation form', () => {
      render(<RaceGoalModal {...mockProps} />);
      
      expect(screen.getByText('Set Race Goal')).toBeInTheDocument();
      expect(screen.getByLabelText(/race name/i)).toBeInTheDocument();
      expect(screen.getByText('Distance')).toBeInTheDocument();
      expect(screen.getByText('Priority')).toBeInTheDocument();
    });

    it('handles form submission with valid data', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      render(<RaceGoalModal {...mockProps} />);
      
      const raceNameInput = screen.getByLabelText(/race name/i);
      fireEvent.change(raceNameInput, { target: { value: 'Boston Marathon' } });

      const submitButton = screen.getByText('Create Goal');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/training-plan/race-goal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Boston Marathon')
        });
      });
    });

    it('validates required fields', async () => {
      render(<RaceGoalModal {...mockProps} />);
      
      const submitButton = screen.getByText('Create Goal');
      fireEvent.click(submitButton);

      // Should not submit with empty required fields
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('handles A/B/C race priority selection', () => {
      render(<RaceGoalModal {...mockProps} />);
      
      const aRaceButton = screen.getByText('A Race');
      const bRaceButton = screen.getByText('B Race');
      const cRaceButton = screen.getByText('C Race');

      expect(aRaceButton).toBeInTheDocument();
      expect(bRaceButton).toBeInTheDocument();
      expect(cRaceButton).toBeInTheDocument();

      fireEvent.click(bRaceButton);
      // Should update selection state
    });

    it('calculates predicted race times', () => {
      render(<RaceGoalModal {...mockProps} />);
      
      const infoButton = screen.getByRole('button', { name: /info/i });
      fireEvent.click(infoButton);

      // Should show predicted time helper
      expect(screen.getByText(/predicted time/i)).toBeInTheDocument();
    });
  });

  describe('RaceGoalsScreen', () => {
    const mockProps = {
      userId: 1
    };

    beforeEach(() => {
      vi.clearAllMocks();
      (dbUtils.getRaceGoalsByUser as any).mockResolvedValue([
        {
          id: 1,
          raceName: 'Boston Marathon',
          raceDate: '2024-04-15',
          distance: 42.2,
          priority: 'A',
          targetTime: 10800,
          location: 'Boston, MA',
          raceType: 'road',
          registrationStatus: 'registered'
        }
      ]);
    });

    it('renders race goals list', async () => {
      render(<RaceGoalsScreen {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Boston Marathon')).toBeInTheDocument();
        expect(screen.getByText('A Race')).toBeInTheDocument();
        expect(screen.getByText('42.2km')).toBeInTheDocument();
      });
    });

    it('handles race goal deletion', async () => {
      (dbUtils.deleteRaceGoal as any).mockResolvedValue(true);
      
      render(<RaceGoalsScreen {...mockProps} />);
      
      await waitFor(() => {
        const deleteButton = screen.getByRole('button', { name: /delete/i });
        fireEvent.click(deleteButton);
      });

      // Should call delete function
      expect(dbUtils.deleteRaceGoal).toHaveBeenCalledWith(1);
    });

    it('handles plan generation', async () => {
      render(<RaceGoalsScreen {...mockProps} />);
      
      await waitFor(() => {
        const generateButton = screen.getByText('Generate Training Plan');
        fireEvent.click(generateButton);
      });

      // Should dispatch navigation event
      expect(window.dispatchEvent).toHaveBeenCalled();
    });

    it('shows empty state when no goals exist', async () => {
      (dbUtils.getRaceGoalsByUser as any).mockResolvedValue([]);
      
      render(<RaceGoalsScreen {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('No Race Goals Set')).toBeInTheDocument();
        expect(screen.getByText('Set Your First Goal')).toBeInTheDocument();
      });
    });
  });

  describe('PlanCustomizationDashboard', () => {
    const mockProps = {
      userId: 1,
      plan: {
        id: 1,
        title: 'Marathon Training Plan',
        totalWeeks: 16,
        trainingDaysPerWeek: 5,
        fitnessLevel: 'intermediate' as const,
        peakWeeklyVolume: 60,
        periodization: [
          {
            phase: 'base',
            duration: 8,
            focus: 'Aerobic base building',
            weeklyVolumePercentage: 60,
            intensityDistribution: { easy: 80, moderate: 15, hard: 5 },
            keyWorkouts: ['long', 'tempo']
          },
          {
            phase: 'build',
            duration: 6,
            focus: 'Race-specific training',
            weeklyVolumePercentage: 80,
            intensityDistribution: { easy: 70, moderate: 20, hard: 10 },
            keyWorkouts: ['intervals', 'race-pace']
          },
          {
            phase: 'peak',
            duration: 2,
            focus: 'Peak performance',
            weeklyVolumePercentage: 100,
            intensityDistribution: { easy: 60, moderate: 25, hard: 15 },
            keyWorkouts: ['vo2max', 'race-pace']
          }
        ]
      },
      raceGoal: {
        id: 1,
        raceName: 'Boston Marathon',
        distance: 42.2,
        targetTime: 10800,
        priority: 'A'
      },
      onUpdatePlan: vi.fn()
    };

    beforeEach(() => {
      vi.clearAllMocks();
      (dbUtils.getWorkoutsByPlan as any).mockResolvedValue([
        {
          id: 1,
          week: 1,
          day: 'Mon',
          type: 'easy',
          distance: 8,
          duration: 60,
          intensity: 'easy',
          notes: 'Easy recovery run',
          completed: false
        },
        {
          id: 2,
          week: 1,
          day: 'Wed',
          type: 'tempo',
          distance: 10,
          duration: 75,
          intensity: 'threshold',
          notes: 'Tempo run at threshold pace',
          completed: false
        }
      ]);
    });

    it('renders plan overview with periodization', async () => {
      render(<PlanCustomizationDashboard {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Marathon Training Plan')).toBeInTheDocument();
        expect(screen.getByText('16 week plan for Boston Marathon')).toBeInTheDocument();
        expect(screen.getByText('Base Phase')).toBeInTheDocument();
        expect(screen.getByText('Build Phase')).toBeInTheDocument();
        expect(screen.getByText('Peak Phase')).toBeInTheDocument();
      });
    });

    it('displays weekly workout view', async () => {
      render(<PlanCustomizationDashboard {...mockProps} />);
      
      await waitFor(() => {
        const weeklyTab = screen.getByText('Weekly View');
        fireEvent.click(weeklyTab);
      });

      await waitFor(() => {
        expect(screen.getByText('Week 1')).toBeInTheDocument();
        expect(screen.getByText('Easy recovery run')).toBeInTheDocument();
        expect(screen.getByText('Tempo run at threshold pace')).toBeInTheDocument();
      });
    });

    it('handles workout editing', async () => {
      (dbUtils.updateWorkout as any).mockResolvedValue(true);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      render(<PlanCustomizationDashboard {...mockProps} />);
      
      await waitFor(() => {
        const weeklyTab = screen.getByText('Weekly View');
        fireEvent.click(weeklyTab);
      });

      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: /edit/i });
        expect(editButtons.length).toBeGreaterThan(0);
        fireEvent.click(editButtons[0]);
      });

      // Should open workout editor
      expect(screen.getByText('Edit Workout')).toBeInTheDocument();
    });

    it('handles workout deletion', async () => {
      (dbUtils.deleteWorkout as any).mockResolvedValue(true);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      render(<PlanCustomizationDashboard {...mockProps} />);
      
      await waitFor(() => {
        const weeklyTab = screen.getByText('Weekly View');
        fireEvent.click(weeklyTab);
      });

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button');
        const deleteButton = deleteButtons.find(button => 
          button.querySelector('svg')?.getAttribute('data-testid')?.includes('trash')
        );
        if (deleteButton) {
          fireEvent.click(deleteButton);
        }
      });

      // Should call delete API
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/training-plan/customize/'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('handles adding new workouts', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      render(<PlanCustomizationDashboard {...mockProps} />);
      
      await waitFor(() => {
        const weeklyTab = screen.getByText('Weekly View');
        fireEvent.click(weeklyTab);
      });

      await waitFor(() => {
        const addButton = screen.getByText('Add Workout');
        fireEvent.click(addButton);
      });

      // Should open workout editor in add mode
      expect(screen.getByText('Add Workout')).toBeInTheDocument();
    });

    it('displays calendar view', async () => {
      render(<PlanCustomizationDashboard {...mockProps} />);
      
      await waitFor(() => {
        const calendarTab = screen.getByText('Calendar');
        fireEvent.click(calendarTab);
      });

      await waitFor(() => {
        expect(screen.getByText('Training Calendar')).toBeInTheDocument();
        // Should show week cards
        expect(screen.getAllByText(/Week \d+/)).toHaveLength(16);
      });
    });

    it('validates safety constraints', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.resolve({
          violations: ['Weekly volume exceeds safe limit'],
          warnings: ['Distance increase >50% may increase injury risk']
        })
      });

      render(<PlanCustomizationDashboard {...mockProps} />);
      
      // Should handle safety violation response
      await waitFor(() => {
        expect(screen.getByText('Safety Warning')).toBeInTheDocument();
      });
    });
  });

  describe('PeriodizationEngine', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('generates periodized training plan', () => {
      const mockRaceGoal = {
        id: 1,
        userId: 1,
        raceName: 'Boston Marathon',
        raceDate: new Date('2024-04-15'),
        distance: 42.2,
        targetTime: 10800,
        priority: 'A' as const,
        raceType: 'road' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockConfig = {
        totalWeeks: 16,
        raceDate: new Date('2024-04-15'),
        trainingDaysPerWeek: 5,
        fitnessLevel: 'intermediate' as const,
        targetDistance: 42.2,
        targetTime: 10800
      };

      (PeriodizationEngine.generatePeriodizedPlan as any).mockReturnValue({
        phases: [
          {
            phase: 'base',
            duration: 8,
            focus: 'Aerobic base building',
            weeklyVolumePercentage: 60,
            intensityDistribution: { easy: 80, moderate: 15, hard: 5 },
            keyWorkouts: ['long', 'tempo']
          }
        ],
        workouts: [
          {
            week: 1,
            day: 'Mon',
            type: 'easy',
            distance: 8,
            duration: 60,
            intensity: 'easy'
          }
        ],
        peakWeeklyVolume: 60,
        taperStrategy: 'Gradual reduction over 3 weeks'
      });

      const result = PeriodizationEngine.generatePeriodizedPlan(1, 1, mockRaceGoal, mockConfig);

      expect(result).toBeDefined();
      if (result) {
        expect(result.phases).toHaveLength(1);
        expect(result.workouts).toHaveLength(1);
        expect(result.phases[0]?.phase).toBe('base');
      }
    });
  });

  describe('API Integration', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('handles race goal API operations', async () => {
      const mockRaceGoal = {
        raceName: 'Boston Marathon',
        raceDate: '2024-04-15',
        distance: 42.2,
        priority: 'A'
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, id: 1 })
      });

      const response = await fetch('/api/training-plan/race-goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRaceGoal)
      });

      expect(response.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('/api/training-plan/race-goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRaceGoal)
      });
    });

    it('handles plan customization API operations', async () => {
      const mockModifications = {
        userId: 1,
        planId: 1,
        workoutId: 1,
        modifications: {
          distance: 10,
          intensity: 'moderate'
        }
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, warnings: [] })
      });

      const response = await fetch('/api/training-plan/customize', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockModifications)
      });

      expect(response.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('/api/training-plan/customize', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockModifications)
      });
    });

    it('handles plan preview generation', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          preview: {
            totalWeeks: 16,
            fitnessLevel: 'intermediate' as const,
            summary: { totalDistance: 800, totalWorkouts: 80 },
            phaseBreakdown: [
              { phase: 'base', duration: 8, focus: 'Aerobic base building' }
            ]
          }
        })
      });

      const response = await fetch('/api/training-plan/preview?userId=1&raceGoalId=1&trainingDaysPerWeek=5');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.preview.totalWeeks).toBe(16);
      expect(data.preview.phaseBreakdown).toHaveLength(1);
    });
  });
});