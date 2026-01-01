/**
 * Run Breakdowns - Tier-specific workout guidance
 *
 * Provides detailed workout structure based on user experience level (beginner/intermediate/advanced)
 * for different run types. Each breakdown includes warm-up, drills, main set, total time,
 * frequency recommendations, and coach notes.
 */

export interface RunBreakdown {
  warmup: string;
  drills: string;
  mainSet: string;
  totalTime: string;
  frequency: string;
  coachNotes: string;
}

export interface TierBreakdowns {
  beginner: RunBreakdown;
  intermediate: RunBreakdown;
  advanced: RunBreakdown;
}

/**
 * Complete breakdown data for all supported workout types across experience levels
 */
export const RUN_BREAKDOWNS: Record<string, TierBreakdowns> = {
  easy: {
    beginner: {
      warmup: "5-8 min easy (or walk-run start)",
      drills: "Optional: 2 min (leg swings + ankle rolls)",
      mainSet: "Continuous easy run",
      totalTime: "20-40 min",
      frequency: "2-4×/week",
      coachNotes: "You should finish feeling better than you started."
    },
    intermediate: {
      warmup: "8-10 min",
      drills: "Optional: 3-4 min",
      mainSet: "Continuous easy run",
      totalTime: "35-70 min",
      frequency: "3-6×/week",
      coachNotes: "Keep easy truly easy; protect quality days"
    },
    advanced: {
      warmup: "10-15 min",
      drills: "Optional: 4-6 min",
      mainSet: "Continuous easy run",
      totalTime: "45-90+ min",
      frequency: "4-7×/week",
      coachNotes: "Easy days are the engine of consistency"
    }
  },

  recovery: {
    beginner: {
      warmup: "5 min very easy",
      drills: "None needed",
      mainSet: "10-20 min very easy (walk breaks ok)",
      totalTime: "15-25 min",
      frequency: "0-1×/week",
      coachNotes: "Keep it short; prioritize freshness"
    },
    intermediate: {
      warmup: "8 min very easy",
      drills: "None needed",
      mainSet: "Very easy continuous run",
      totalTime: "20-40 min",
      frequency: "1-2×/week (after hard days)",
      coachNotes: "Shuffle is fine"
    },
    advanced: {
      warmup: "10 min very easy",
      drills: "None needed",
      mainSet: "Very easy continuous run",
      totalTime: "30-45 min",
      frequency: "1-3×/week",
      coachNotes: "Never chase pace on recovery"
    }
  },

  steady: {
    beginner: {
      warmup: "10 min easy",
      drills: "Optional: 2-3 min",
      mainSet: "10-20 min steady (RPE 4-5)",
      totalTime: "30-50 min",
      frequency: "0-1×/week (only after consistency)",
      coachNotes: "Should feel 'controlled,' not strained"
    },
    intermediate: {
      warmup: "12-15 min easy",
      drills: "Optional: 3-4 min",
      mainSet: "20-45 min steady",
      totalTime: "45-75 min",
      frequency: "0-1×/week",
      coachNotes: "Comfortably hard, sustainable pace"
    },
    advanced: {
      warmup: "15 min",
      drills: "Optional: 4-5 min",
      mainSet: "40-75 min steady (or within medium-long run)",
      totalTime: "60-100 min",
      frequency: "0-1×/week (depends on overall intensity plan)",
      coachNotes: "Use as progression within long runs when appropriate"
    }
  },

  tempo: {
    beginner: {
      warmup: "12-15 min + light drills",
      drills: "Light drills (2-3 min)",
      mainSet: "2-4 reps of 5-8 min tempo with 2-3 min easy recoveries",
      totalTime: "40-60 min",
      frequency: "0-1×/week (often every other week)",
      coachNotes: "Finish feeling like you could do a little more"
    },
    intermediate: {
      warmup: "15 min + 3×20s strides",
      drills: "3×20s strides",
      mainSet: "15-30 min tempo continuous OR 2×12-15 min with 2-3 min recovery",
      totalTime: "55-80 min",
      frequency: "0-1×/week",
      coachNotes: "Comfortably hard pace - about 80-85% effort"
    },
    advanced: {
      warmup: "15-20 min + strides",
      drills: "4-6 strides (20s each)",
      mainSet: "25-40 min tempo continuous OR 3×12 min (short recoveries)",
      totalTime: "70-95 min",
      frequency: "0-1×/week (alternates with threshold/VO₂ focus)",
      coachNotes: "This should feel challenging but sustainable"
    }
  },

  threshold: {
    beginner: {
      warmup: "15 min + drills",
      drills: "3-4 min activation drills + 4x20s strides",
      mainSet: "3-5×5 min threshold with 2 min easy recoveries",
      totalTime: "50-70 min",
      frequency: "0-1×/week",
      coachNotes: "Controlled hard, never desperate"
    },
    intermediate: {
      warmup: "15 min + 3-4 strides",
      drills: "3-4 strides (20s each)",
      mainSet: "2×15 min OR 3×10 min threshold with 2-3 min easy recoveries",
      totalTime: "60-85 min",
      frequency: "1×/week in endurance blocks",
      coachNotes: "Threshold pace should feel like 'controlled discomfort'"
    },
    advanced: {
      warmup: "20 min + strides",
      drills: "4-6 strides (20s each)",
      mainSet: "4×10 min (short recoveries) OR 30-35 min continuous",
      totalTime: "75-100 min",
      frequency: "1×/week (or alternating with VO₂ focus)",
      coachNotes: "About 85-90% effort - comfortably hard"
    }
  },

  intervals: {
    beginner: {
      warmup: "15 min + drills",
      drills: "3-4 min activation drills",
      mainSet: "8-12×1 min fast with 1-2 min easy recoveries",
      totalTime: "45-65 min",
      frequency: "0-1×/week (only after base)",
      coachNotes: "Anaerobic focus, fast but repeatable; form stays smooth"
    },
    intermediate: {
      warmup: "15-20 min + strides",
      drills: "4-6 strides (20s each) + light drills",
      mainSet: "6-10 reps (e.g., 400-600m) with 200m jog or 90-150s easy",
      totalTime: "60-80 min",
      frequency: "0-1×/week (more in 5K blocks)",
      coachNotes: "Anaerobic focus with full recovery. Warm up well and cool down properly."
    },
    advanced: {
      warmup: "20 min + strides",
      drills: "6-8 strides (20s each) + light drills",
      mainSet: "10-14 reps (e.g., 400m) or 6-10×600m with controlled, consistent recoveries",
      totalTime: "70-95 min",
      frequency: "1×/week during sharpening",
      coachNotes: "Anaerobic focus. Maintain form throughout all reps"
    }
  },

  vo2max: {
    beginner: {
      warmup: "15-20 min + strides (optional)",
      drills: "Optional: 2-3 strides",
      mainSet: "5-7×2 min hard with 2 min easy recoveries",
      totalTime: "50-75 min",
      frequency: "Occasional (not year-round)",
      coachNotes: "Stop 1 notch before 'all-out'"
    },
    intermediate: {
      warmup: "20 min + strides",
      drills: "4-6 strides (20s each)",
      mainSet: "4-6×3 min OR 4×4 min with 2-3 min easy recoveries",
      totalTime: "60-85 min",
      frequency: "1×/week in speed blocks",
      coachNotes: "Near-maximal effort - about 95% max heart rate"
    },
    advanced: {
      warmup: "20-25 min + strides",
      drills: "6-8 strides (20s each)",
      mainSet: "5-6×4 min OR 5×5 min with 2-3 min easy recoveries",
      totalTime: "70-95 min",
      frequency: "1×/week (manage overall load)",
      coachNotes: "Very high intensity - critical for race performance"
    }
  },

  long: {
    beginner: {
      warmup: "10 min easy",
      drills: "None needed",
      mainSet: "Easy continuous or walk-run",
      totalTime: "50-80 min",
      frequency: "1×/week",
      coachNotes: "Keep it gentle; build durability"
    },
    intermediate: {
      warmup: "10-15 min",
      drills: "None needed",
      mainSet: "Easy continuous run",
      totalTime: "80-120 min",
      frequency: "1×/week",
      coachNotes: "Practice fueling if >75-90 min"
    },
    advanced: {
      warmup: "15 min",
      drills: "None needed",
      mainSet: "Easy continuous run",
      totalTime: "100-150+ min",
      frequency: "1×/week",
      coachNotes: "Most long runs stay easy to protect quality"
    }
  },

  'long-progression': {
    beginner: {
      warmup: "Included in total time",
      drills: "None needed",
      mainSet: "Easy start, finish with last 8-12 min steady (RPE 4-5)",
      totalTime: "60-85 min",
      frequency: "Once every 2-4 weeks max",
      coachNotes: "Keep it controlled; protect recovery"
    },
    intermediate: {
      warmup: "Included in total time",
      drills: "None needed",
      mainSet: "Easy start, finish with last 15-25 min steady (RPE 5) or light tempo (RPE 6) rarely",
      totalTime: "90-120 min",
      frequency: "Once every 2-3 weeks",
      coachNotes: "Progression should feel natural, not forced"
    },
    advanced: {
      warmup: "Included in total time",
      drills: "None needed",
      mainSet: "Easy start, finish with last 20-40 min steady-tempo (RPE 5-6.5)",
      totalTime: "100-150 min",
      frequency: "Once every 2-3 weeks (alternate with easy long runs)",
      coachNotes: "Use to practice race-day pacing and mental strength"
    }
  },

  progression: {
    beginner: {
      warmup: "Included in total time",
      drills: "None needed",
      mainSet: "Easy start, finish with last 8-15 min steady",
      totalTime: "35-55 min",
      frequency: "0-1×/week",
      coachNotes: "Gradually increase pace - don't start too fast"
    },
    intermediate: {
      warmup: "Included in total time",
      drills: "None needed",
      mainSet: "Easy start, finish with last 15-25 min steady (sometimes touches tempo)",
      totalTime: "50-75 min",
      frequency: "0-1×/week",
      coachNotes: "Listen to your body and adjust pace naturally"
    },
    advanced: {
      warmup: "Included in total time",
      drills: "None needed",
      mainSet: "Easy start, finish with last 20-35 min steady/tempo",
      totalTime: "60-90 min",
      frequency: "0-1×/week",
      coachNotes: "Excellent for building mental toughness and finishing strength"
    }
  },

  hill: {
    beginner: {
      warmup: "Easy run, then 4-6×8s hill sprints with full walk back",
      drills: "None needed for sprints",
      mainSet: "4-6×8s uphill, full recovery OR 6-8×30-45s uphill strong, easy down (4-6 min total hard time)",
      totalTime: "30-45 min total (including easy run)",
      frequency: "0-1×/week",
      coachNotes: "Focus on form and power, not speed"
    },
    intermediate: {
      warmup: "Easy run, then 6-8×10s hill sprints with full recovery",
      drills: "None needed for sprints",
      mainSet: "6-8×10s sprints OR 6-10×60s uphill, jog down (6-10 min total hard time)",
      totalTime: "40-55 min total",
      frequency: "0-1×/week in blocks",
      coachNotes: "Hills build strength and running economy"
    },
    advanced: {
      warmup: "Easy run, then 8-10×10-12s hill sprints with full recovery",
      drills: "None needed for sprints",
      mainSet: "8-10×10-12s sprints OR 8-12×60-75s or 6×2 min (12-20+ min total hard time)",
      totalTime: "50-70 min total",
      frequency: "1×/week in hill blocks",
      coachNotes: "Powerful tool for strength and neuromuscular development"
    }
  },

  strides: {
    beginner: {
      warmup: "After easy run",
      drills: "None needed",
      mainSet: "4×15s post-run strides with 60-90s easy recovery",
      totalTime: "Add 5-8 min to run",
      frequency: "0-2×/week",
      coachNotes: "Smooth, relaxed speed - not sprinting"
    },
    intermediate: {
      warmup: "After easy run",
      drills: "None needed",
      mainSet: "6×20s post-run strides with 60s easy recovery",
      totalTime: "Add 8-10 min to run",
      frequency: "1-3×/week",
      coachNotes: "Focus on form and turnover, stay relaxed"
    },
    advanced: {
      warmup: "After easy run",
      drills: "None needed",
      mainSet: "8-10×20s post-run strides with 45-60s easy recovery",
      totalTime: "Add 10-12 min to run",
      frequency: "1-3×/week",
      coachNotes: "Great for maintaining leg speed and neuromuscular fitness"
    }
  },

  fartlek: {
    beginner: {
      warmup: "10-12 min easy",
      drills: "Optional: 2-3 min",
      mainSet: "20-30 min with 6-8 surges (30-90s faster efforts, easy between)",
      totalTime: "40-55 min",
      frequency: "0-1×/week",
      coachNotes: "Play with pace - no structured intervals needed"
    },
    intermediate: {
      warmup: "12-15 min easy",
      drills: "Optional: 3-4 min",
      mainSet: "30-45 min with 8-12 surges (varied durations and intensities)",
      totalTime: "55-75 min",
      frequency: "0-1×/week",
      coachNotes: "Embrace the unstructured nature - listen to how you feel"
    },
    advanced: {
      warmup: "15-20 min easy",
      drills: "Optional: 4-6 min",
      mainSet: "40-60 min with 10-15 surges (mix of short/long, easy/hard)",
      totalTime: "70-95 min",
      frequency: "0-1×/week",
      coachNotes: "Excellent for mental flexibility and varied pace work"
    }
  },

  'cross-training': {
    beginner: {
      warmup: "5 min easy",
      drills: "None needed",
      mainSet: "20-40 min easy effort (cycling, swimming, elliptical)",
      totalTime: "20-40 min",
      frequency: "1-3×/week as optional support",
      coachNotes: "Low-impact alternative to build fitness without running impact"
    },
    intermediate: {
      warmup: "5-8 min easy",
      drills: "None needed",
      mainSet: "30-60 min easy effort (often replaces an easy run)",
      totalTime: "30-60 min",
      frequency: "1-3×/week",
      coachNotes: "Great for active recovery and maintaining aerobic fitness"
    },
    advanced: {
      warmup: "8-10 min easy",
      drills: "None needed",
      mainSet: "40-90 min easy (or structured if replacing a run workout)",
      totalTime: "40-90 min",
      frequency: "1-4×/week as needed",
      coachNotes: "Can include structured workouts for variety and injury prevention"
    }
  },

  'race-pace': {
    beginner: {
      warmup: "15 min easy + light drills",
      drills: "Light activation drills (3-4 min)",
      mainSet: "2-3×5-8 min at goal race pace with 2-3 min easy recoveries",
      totalTime: "45-60 min",
      frequency: "0-1×/week (final 3-4 weeks before race)",
      coachNotes: "Practice running at your goal race pace"
    },
    intermediate: {
      warmup: "15 min easy + 3-4 strides",
      drills: "3-4 strides (20s each)",
      mainSet: "3-4×8-10 min at goal race pace with 2 min easy recoveries",
      totalTime: "60-75 min",
      frequency: "0-1×/week (during race-specific phase)",
      coachNotes: "Dial in your race effort and pacing strategy"
    },
    advanced: {
      warmup: "20 min easy + strides",
      drills: "4-6 strides (20s each)",
      mainSet: "4-5×10-12 min at goal race pace with 90s-2 min easy recoveries",
      totalTime: "70-90 min",
      frequency: "1×/week (final 4-6 weeks before race)",
      coachNotes: "Critical for race preparation - practice pacing and fueling"
    }
  }
};

/**
 * Workout type mapping from database types to breakdown types
 */
const WORKOUT_TYPE_MAP: Record<string, string> = {
  'easy': 'easy',
  'recovery': 'recovery',
  'tempo': 'tempo',
  'steady': 'steady',
  'intervals': 'intervals',
  'long': 'long',
  'time-trial': 'threshold',
  'hill': 'hill',
  'fartlek': 'fartlek',
  'race-pace': 'race-pace',
  'rest': 'rest'
};

/**
 * Retrieves the appropriate run breakdown based on workout type and user experience level
 *
 * @param workoutType - The type of workout (e.g., 'easy', 'tempo', 'intervals')
 * @param userExperience - User's experience level ('beginner', 'intermediate', or 'advanced')
 * @returns RunBreakdown object or null if not available
 */
export function getRunBreakdown(
  workoutType: string,
  userExperience: 'beginner' | 'intermediate' | 'advanced'
): RunBreakdown | null {
  // Map database workout type to breakdown type
  const breakdownType = WORKOUT_TYPE_MAP[workoutType.toLowerCase()] || workoutType.toLowerCase();

  // Rest days don't have breakdowns
  if (breakdownType === 'rest') {
    return null;
  }

  // Get the tier breakdowns for this workout type
  const tierBreakdowns = RUN_BREAKDOWNS[breakdownType];

  if (!tierBreakdowns) {
    // Return a generic fallback if workout type not found
    return {
      warmup: "10-15 min easy",
      drills: "Optional: 3-5 min dynamic stretches",
      mainSet: "Follow your training plan guidance",
      totalTime: "Varies by workout type",
      frequency: "As prescribed in your plan",
      coachNotes: "Listen to your body and adjust intensity as needed"
    };
  }

  // Return the breakdown for the user's experience level
  return tierBreakdowns[userExperience];
}

/**
 * Gets all available workout types that have breakdowns
 */
export function getAvailableWorkoutTypes(): string[] {
  return Object.keys(RUN_BREAKDOWNS);
}

/**
 * Checks if a breakdown exists for a given workout type
 */
export function hasBreakdown(workoutType: string): boolean {
  const breakdownType = WORKOUT_TYPE_MAP[workoutType.toLowerCase()] || workoutType.toLowerCase();
  return breakdownType !== 'rest' && breakdownType in RUN_BREAKDOWNS;
}
