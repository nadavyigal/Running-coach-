import { OnboardingProfile } from './onboardingManager';
import { dbUtils } from '@/lib/dbUtils';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export async function validateOnboardingState(profile: OnboardingProfile, userId: number | null): Promise<ValidationResult> {
  const errors: string[] = [];

  // Basic profile data validation (can be extended based on requirements)
  if (!profile.goal || !['habit', 'distance', 'speed'].includes(profile.goal)) {
    errors.push('Invalid or missing goal');
  }

  if (!profile.experience || !['beginner', 'intermediate', 'advanced'].includes(profile.experience)) {
    errors.push('Invalid or missing experience level');
  }

  if (!profile.preferredTimes || profile.preferredTimes.length === 0) {
    errors.push('At least one preferred time must be selected');
  }

  if (!profile.daysPerWeek || profile.daysPerWeek < 2 || profile.daysPerWeek > 7) {
    errors.push('Days per week must be between 2 and 7');
  }

  if (!profile.consents.data || !profile.consents.gdpr) {
    errors.push('Data usage and GDPR consent are required');
  }

  if (profile.age && (profile.age < 10 || profile.age > 100)) {
    errors.push('Age must be between 10 and 100 if provided');
  }

  // Database consistency checks
  if (userId) {
    try {
      const user = await dbUtils.getUserById(userId);
      if (!user) {
        errors.push(`User with ID ${userId} not found in database.`);
      } else if (!user.onboardingComplete && profile.onboardingComplete) {
        // If profile says onboarding is complete but DB says otherwise, it's inconsistent
        errors.push('Onboarding completion status mismatch with database.');
      }
      // Add more consistency checks as needed, e.g., plan existence, workout data
    } catch (dbError) {
      console.error('Database consistency check failed:', dbError);
      errors.push('Failed to verify database consistency.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
