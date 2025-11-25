export interface UserProfile {
  name: string;
  experience: 'beginner' | 'intermediate' | 'advanced';
  goal: 'habit' | 'performance' | 'race';
  daysPerWeek: number;
}

export interface RunData {
  distance: number; // km
  duration: number; // minutes
  pace: number; // min/km
  type?: 'easy' | 'tempo' | 'long' | 'recovery';
}

export class TestDataFactory {
  createBeginnerProfile(): UserProfile {
    return {
      name: 'Sarah Beginner',
      experience: 'beginner',
      goal: 'habit',
      daysPerWeek: 3
    };
  }

  createIntermediateProfile(): UserProfile {
    return {
      name: 'Mike Intermediate',
      experience: 'intermediate',
      goal: 'performance',
      daysPerWeek: 4
    };
  }

  createAdvancedProfile(): UserProfile {
    return {
      name: 'Alex Advanced',
      experience: 'advanced',
      goal: 'race',
      daysPerWeek: 5
    };
  }

  createBeginnerRun(): RunData {
    return {
      distance: 2,
      duration: 20,
      pace: 10,
      type: 'easy'
    };
  }

  createIntermediateRun(): RunData {
    return {
      distance: 5,
      duration: 30,
      pace: 6,
      type: 'tempo'
    };
  }

  createAdvancedRun(): RunData {
    return {
      distance: 8,
      duration: 48,
      pace: 6,
      type: 'long'
    };
  }

  createSlowRun(): RunData {
    return {
      distance: 1,
      duration: 15,
      pace: 15,
      type: 'easy'
    };
  }

  createFastRun(): RunData {
    return {
      distance: 10,
      duration: 45,
      pace: 4.5,
      type: 'tempo'
    };
  }

  createIncompleteRun(): RunData {
    return {
      distance: 3,
      duration: 18,
      pace: 6,
      type: 'easy'
    };
  }

  createWeatherData() {
    return {
      temperature: 20,
      humidity: 60,
      windSpeed: 10,
      conditions: 'sunny'
    };
  }

  createGPSData() {
    return {
      coordinates: [
        { lat: 40.7128, lng: -74.0060 },
        { lat: 40.7129, lng: -74.0061 },
        { lat: 40.7130, lng: -74.0062 }
      ],
      elevation: [10, 12, 15],
      accuracy: 5
    };
  }
}

export const testDataFactory = new TestDataFactory(); 