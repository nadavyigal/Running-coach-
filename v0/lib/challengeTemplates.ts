import { type ChallengeTemplate } from './db';

/**
 * Challenge Templates - Seed data for Challenge-Led Growth Engine
 * Three flagship challenges designed for maximum stickiness and retention
 */

export const CHALLENGE_TEMPLATES: Omit<ChallengeTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    slug: 'start-running',
    name: '21-Day Start Running',
    tagline: 'From zero to running 30 minutes comfortably',
    description: 'Perfect for brand-new runners. Build a sustainable running habit with zero pressure. We\'ll guide you from your first steps to running confidently for 30 minutes.',
    targetAudience: 'brand-new runners struggling with fear and inconsistency',
    promise: 'You\'ll transform from "I can\'t run" to "I\'m a runner" in just 21 days',
    durationDays: 21,
    difficulty: 'beginner',
    category: 'habit',
    workoutPattern: 'Progressive walk/run ratios starting with 1min run / 2min walk, gradually building to continuous 30min runs. Emphasis on consistency over intensity.',
    coachTone: 'gentle',
    dailyThemes: [
      'Day 1: Just show up - Your only goal today is to start',
      'Day 2: Celebrate showing up twice',
      'Day 3: Building momentum - Three days makes a pattern',
      'Day 4: You\'re doing this!',
      'Day 5: Five days stronger',
      'Day 6: Almost a week',
      'Day 7: First week complete! You\'re a runner now',
      'Day 8: Starting strong again',
      'Day 9: Finding your rhythm',
      'Day 10: Double digits!',
      'Day 11: More than a fluke',
      'Day 12: Your body is adapting',
      'Day 13: Lucky day 13',
      'Day 14: Halfway milestone - Look how far you\'ve come',
      'Day 15: Over the hump',
      'Day 16: Muscle memory building',
      'Day 17: You\'re consistent now',
      'Day 18: Three days from history',
      'Day 19: Almost there',
      'Day 20: Final push',
      'Day 21: You did it! You\'re a runner now',
    ],
    thumbnailUrl: '/images/challenges/start-running.jpg',
    isActive: true,
    isFeatured: true,
    sortOrder: 1,
  },
  {
    slug: 'morning-ritual',
    name: '21-Day Morning Guided Run',
    tagline: 'Turn running into a calm morning ritual',
    description: 'For runners who want more than exercise. Transform your morning runs into a mindful practice that sets the tone for your entire day. Includes guided breathing, focus cues, and reflection prompts.',
    targetAudience: 'casual runners seeking meaning, routine, and mental clarity',
    promise: 'Start every day centered, energized, and with a sense of accomplishment',
    durationDays: 21,
    difficulty: 'beginner',
    category: 'mindful',
    workoutPattern: 'Easy-paced morning runs (30-40min) with guided mindfulness cues, breathing exercises, and intention-setting. Focus on the experience, not the pace.',
    coachTone: 'calm',
    dailyThemes: [
      'Day 1: Set your intention - What do you want from these 21 days?',
      'Day 2: Notice your breath',
      'Day 3: Morning gratitude practice',
      'Day 4: Body scan awareness',
      'Day 5: Finding stillness in motion',
      'Day 6: Breathing rhythm',
      'Day 7: First week of presence',
      'Day 8: Setting daily intentions',
      'Day 9: Mindful transitions',
      'Day 10: Observing without judgment',
      'Day 11: Your morning anchor',
      'Day 12: Breath as your guide',
      'Day 13: Halfway reflection',
      'Day 14: The meditation effect',
      'Day 15: Running as meditation',
      'Day 16: Present moment awareness',
      'Day 17: Your personal ritual',
      'Day 18: Consistency creates calm',
      'Day 19: Almost complete',
      'Day 20: Tomorrow is day 21',
      'Day 21: Morning ritual complete - This is who you are now',
    ],
    thumbnailUrl: '/images/challenges/morning-ritual.jpg',
    isActive: true,
    isFeatured: true,
    sortOrder: 2,
  },
  {
    slug: 'plateau-breaker',
    name: '21-Day Plateau Breaker',
    tagline: 'Feel progress again in 3 weeks',
    description: 'Stuck at the same 3 runs per week? Break through with structured variety. Introduce strides, hills, and easy tempo work to reignite your progress. Data-driven and adaptive.',
    targetAudience: 'casual runners stuck at same routine for 3+ months',
    promise: 'Breakthrough to a new level of fitness with smart, progressive training',
    durationDays: 21,
    difficulty: 'intermediate',
    category: 'performance',
    workoutPattern: 'Strategic mix of easy runs (60%), speed work (20%), and hill sessions (20%). Introduces strides, fartlek, and threshold efforts. Adaptive difficulty based on feedback.',
    coachTone: 'analytical',
    dailyThemes: [
      'Day 1: Diagnostic run - Let\'s see where you are',
      'Day 2: Easy baseline',
      'Day 3: First strides',
      'Day 4: Recovery matters',
      'Day 5: Building aerobic base',
      'Day 6: Rest with purpose',
      'Day 7: First speed session - 4x400m',
      'Day 8: Active recovery',
      'Day 9: Tempo introduction',
      'Day 10: Easy run',
      'Day 11: Hills workout',
      'Day 12: Recovery',
      'Day 13: Fartlek fun',
      'Day 14: Halfway check-in - Feeling the difference?',
      'Day 15: Easy endurance',
      'Day 16: Speed session 2',
      'Day 17: Recovery',
      'Day 18: Tempo progression',
      'Day 19: Easy run',
      'Day 20: Final speed session',
      'Day 21: Breakthrough confirmed - You\'re faster now',
    ],
    thumbnailUrl: '/images/challenges/plateau-breaker.jpg',
    isActive: true,
    isFeatured: true,
    sortOrder: 3,
  },
];

/**
 * Get all active challenge templates sorted by sort order
 */
export function getActiveChallengeTemplates(): typeof CHALLENGE_TEMPLATES {
  return CHALLENGE_TEMPLATES.filter(t => t.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Get featured challenge templates for promotion
 */
export function getFeaturedChallengeTemplates(): typeof CHALLENGE_TEMPLATES {
  return CHALLENGE_TEMPLATES.filter(t => t.isActive && t.isFeatured).sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Get challenge template by slug
 */
export function getChallengeTemplateBySlug(slug: string): (typeof CHALLENGE_TEMPLATES)[0] | undefined {
  return CHALLENGE_TEMPLATES.find(t => t.slug === slug);
}

/**
 * Get challenge templates by category
 */
export function getChallengeTemplatesByCategory(category: ChallengeTemplate['category']): typeof CHALLENGE_TEMPLATES {
  return CHALLENGE_TEMPLATES.filter(t => t.isActive && t.category === category).sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Get challenge templates by difficulty
 */
export function getChallengeTemplatesByDifficulty(difficulty: ChallengeTemplate['difficulty']): typeof CHALLENGE_TEMPLATES {
  return CHALLENGE_TEMPLATES.filter(t => t.isActive && t.difficulty === difficulty).sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Get recommended next challenge based on completed challenge
 */
export function getNextChallengeRecommendation(completedSlug: string): (typeof CHALLENGE_TEMPLATES)[0] | null {
  const progressionPaths: Record<string, string> = {
    'start-running': 'morning-ritual',      // Habit → Mindful
    'morning-ritual': 'plateau-breaker',    // Mindful → Performance
    'plateau-breaker': null,                // End of progression (custom goals next)
  };

  const nextSlug = progressionPaths[completedSlug];
  if (!nextSlug) return null;

  return getChallengeTemplateBySlug(nextSlug) || null;
}
